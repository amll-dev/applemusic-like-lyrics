# 性能优化计划

## 🔴 当前性能问题

用户反馈："卡的要死 根本看不了效果"

### 问题根源

当前实现与原版有**架构层面的差异**，导致严重的性能问题：

| 操作 | 原版（高性能） | 当前实现（低性能） | 性能差距 |
|------|----------------|-------------------|----------|
| 文本渲染 | 预渲染到离屏Canvas（一次） | 每帧重新渲染所有文本 | **100x+** |
| 模糊效果 | 应用于`drawImage` | 应用于每行文本 | **10x+** |
| 文本测量 | 预计算并缓存 | 每帧`measureText()` | **50x+** |
| 渐变创建 | 无（使用mask-image） | 每个单词创建渐变 | **20x+** |

### 具体瓶颈

#### 1. 每帧重新渲染所有文本
```typescript
// 当前实现 - CanvasLyricRenderer.ets
drawFrame() {
  lineStates.forEach(state => {
    this.renderLine(state, ...)  // 每行
    → renderMainLyric()           // 每个单词
      → ctx.fillText(word, x, y)  // ❌ 每帧绘制文本！
  });
}
```

假设：
- 10行可见歌词
- 每行平均10个单词
- 60fps

**每秒绘制次数**：10行 × 10单词 × 60fps = **6000次文本渲染/秒**

#### 2. 模糊效果性能杀手
```typescript
// 当前实现
ctx.filter = `blur(${blurRadius}px)`;  // ❌ 非常昂贵
ctx.fillText(...);  // 应用到每次文本绘制
```

Canvas的`filter`属性非常昂贵，特别是应用到文本渲染时。

#### 3. 重复的文本测量
```typescript
// calculateWordPositions() - 每帧被调用
line.words.forEach(word => {
  const metrics = ctx.measureText(word.word);  // ❌ 昂贵的操作
});
```

#### 4. 大量的渐变对象创建
```typescript
// renderWordWithGradientMask() - 每个播放中的单词
const gradient = ctx.createLinearGradient(...);  // ❌ 每帧创建对象
gradient.addColorStop(0, '#FFFFFF');
gradient.addColorStop(0.5, '#AAAAAA');
...
```

---

## ✅ 原版的高性能架构

### 核心设计：离屏Canvas缓存

参考：`packages/core/src/lyric-player/canvas/lyric-line.ts`

```typescript
export class CanvasLyricLine {
  // 1️⃣ 每行歌词有独立的离屏Canvas
  private lineCanvas: HTMLCanvasElement = document.createElement("canvas");

  // 2️⃣ 只在内容变化时重新渲染（relayout）
  relayout(): void {
    const lctx = this.lineCanvas.getContext("2d")!;
    lctx.scale(devicePixelRatio, devicePixelRatio);

    // 🎨 在离屏Canvas上绘制所有文本（一次性）
    for (const layout of this.translatedLayoutWords) {
      lctx.fillText(layout.text, layout.x, layout.y);
    }

    // ✅ 预渲染完成，存储在lineCanvas中
  }

  // 3️⃣ 每帧只需要复制图像 + 应用变换
  update(delta): void {
    if (!this.isInSight) return;  // 视口裁剪

    // 应用模糊（只对一个drawImage调用，而非多次文本）
    ctx.filter = `blur(${this.blur}px)`;
    ctx.globalAlpha = this.opacity;
    ctx.translate(0, this.posY);
    ctx.scale(1 / devicePixelRatio, 1 / devicePixelRatio);

    // ⚡ 超快！只是复制图像
    ctx.drawImage(this.lineCanvas, 0, 0);
  }
}
```

### 性能对比

| 操作 | 每帧耗时（估算） |
|------|------------------|
| **原版：drawImage × 10行** | **~0.5ms** ✅ |
| **当前：fillText × 100单词** | **~50ms** ❌ |

---

## 🎯 优化方案

### 方案A：完整重构（推荐）

实现离屏Canvas缓存系统，完全复制原版架构。

#### 需要创建的类：

```
arkts-lyrics-new/src/canvas/
  ├── OffscreenLyricLineCache.ets    # 离屏Canvas缓存管理
  └── CanvasLyricLineRenderer.ets     # 单行渲染器（带缓存）
```

#### 实现步骤：

1. **创建`OffscreenLyricLineCache`类**：
   ```typescript
   export class OffscreenLyricLineCache {
     private canvas: OffscreenCanvas;
     private ctx: OffscreenCanvasRenderingContext2D;
     private isDirty: boolean = true;

     // 预渲染到离屏Canvas
     render(line: LyricLine, config: RenderConfig): void {
       if (!this.isDirty) return;

       // 清空并重新绘制
       this.ctx.clearRect(0, 0, this.width, this.height);
       // ... 渲染文本
       this.isDirty = false;
     }

     // 获取缓存的图像
     getImage(): OffscreenCanvas {
       return this.canvas;
     }
   }
   ```

2. **修改`CanvasLyricRenderer.renderLine()`**：
   ```typescript
   private lineCaches: Map<number, OffscreenLyricLineCache> = new Map();

   renderLine(state: LyricLineRenderState, ...): void {
     // 获取或创建缓存
     let cache = this.lineCaches.get(state.lineIndex);
     if (!cache) {
       cache = new OffscreenLyricLineCache();
       cache.render(state.line, config);  // 预渲染
       this.lineCaches.set(state.lineIndex, cache);
     }

     // 应用变换和模糊
     ctx.save();
     ctx.filter = `blur(${state.blurRadius}px)`;
     ctx.globalAlpha = state.alphaValue;
     ctx.translate(0, state.positionY);
     ctx.scale(state.scaleRatio, state.scaleRatio);

     // ⚡ 超快！只是复制缓存的图像
     ctx.drawImage(cache.getImage(), 0, 0);

     ctx.restore();
   }
   ```

3. **缓存失效策略**：
   - 歌词内容变化时标记为脏
   - 窗口大小变化时重新渲染
   - 限制缓存数量（LRU）

#### 预期性能提升：

- **文本渲染**：100次/帧 → 0次/帧（预渲染）
- **模糊效果**：应用到10次文本 → 应用到10次drawImage
- **整体性能**：提升 **50-100倍**

---

### 方案B：临时优化（快速修复）

在不改变架构的情况下，做一些临时优化。

#### 1. ✅ 已完成：禁用模糊效果
```typescript
// 暂时注释掉
// ctx.filter = `blur(${state.blurRadius}px)`;
```

#### 2. 缓存单词位置计算
```typescript
private wordPositionCache: Map<string, WordRenderInfo[]> = new Map();

calculateWordPositions(...): WordRenderInfo[] {
  const cacheKey = `${line.id}_${fontSize}`;
  if (this.wordPositionCache.has(cacheKey)) {
    return this.wordPositionCache.get(cacheKey);
  }
  // ... 计算并缓存
}
```

#### 3. 减少渐变创建
```typescript
// 只为真正需要的单词创建渐变
if (isActive && progress > 0.05 && progress < 0.95) {
  this.renderWordWithGradientMask(ctx, wordInfo);
} else {
  // 简单颜色填充
  ctx.fillStyle = color;
  ctx.fillText(word, x, y);
}
```

#### 4. 添加视口裁剪
```typescript
// 只渲染视口内+overscan的行
const viewportTop = scrollOffset - overscan;
const viewportBottom = scrollOffset + canvasHeight + overscan;

if (state.positionY < viewportTop || state.positionY > viewportBottom) {
  return;  // 跳过不可见的行
}
```

#### 预期性能提升：

- **禁用模糊**：提升 ~30%
- **缓存**：提升 ~20%
- **减少渐变**：提升 ~15%
- **视口裁剪**：提升 ~25%
- **整体**：提升 **2-3倍**（仍然不够流畅）

---

## 📊 推荐的实施计划

### 阶段1：临时修复（立即）
- [x] 禁用模糊效果（已完成）
- [ ] 添加视口裁剪
- [ ] 减少渐变创建频率
- **预期**：达到基本可用的流畅度

### 阶段2：架构重构（推荐）
- [ ] 实现离屏Canvas缓存系统
- [ ] 迁移到预渲染架构
- [ ] 重新启用模糊效果
- **预期**：达到原版的流畅度

### 阶段3：进一步优化
- [ ] 实现LRU缓存淘汰
- [ ] 使用Web Worker离线预渲染（如果HarmonyOS支持）
- [ ] 优化渐变算法
- **预期**：超越原版性能

---

## 🔬 性能测试计划

### 测试指标：
1. **帧率（FPS）**：目标 ≥ 60fps
2. **帧时间**：目标 ≤ 16ms/帧
3. **渲染耗时**：目标 ≤ 5ms/帧
4. **内存占用**：目标 ≤ 100MB

### 测试场景：
- 10行歌词，5个单词/行
- 30行歌词，10个单词/行
- 滚动动画
- 间奏动画

---

## 📚 参考资料

### 原版代码：
- `packages/core/src/lyric-player/canvas/lyric-line.ts` - 离屏Canvas实现
- `packages/core/src/lyric-player/canvas/index.ts` - Canvas播放器主逻辑
- `packages/core/src/lyric-player/base.ts` - 基础架构

### HarmonyOS文档：
- Canvas性能优化指南
- OffscreenCanvas API文档

---

## 💡 结论

**当前性能问题是架构性的**，不是简单的代码优化能解决的。

**临时方案B** 可以让性能达到基本可用（~30-40fps），但要达到流畅体验（60fps+），**必须实施方案A的架构重构**。

建议：
1. 先使用方案B快速恢复基本可用性
2. 再投入时间实施方案A的完整重构
3. 最终达到与原版相当的性能表现
