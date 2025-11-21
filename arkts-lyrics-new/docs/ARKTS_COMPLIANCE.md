# ArkTS 严格规范合规说明

## 修复的问题

### 1. 对象字面量类型错误

**问题**：
```typescript
// ❌ 错误 - 对象字面量不能作为类型声明
config: {
  enableEmphasize: boolean,
  enableGlow: boolean
}
```

**解决方案**：
创建明确的类型类
```typescript
// ✅ 正确 - 使用类定义
export class RendererConfig {
  enableEmphasize: boolean = true;
  enableGlow: boolean = true;
  showTranslation: boolean = true;
  showRoman: boolean = false;

  constructor(/*...*/) {
    // ...
  }
}
```

文件位置：`src/models/LyricModels.ets:190`

### 2. requestAnimationFrame 不存在

**问题**：
```typescript
// ❌ 错误 - 鸿蒙中没有这个API
requestAnimationFrame(() => this.render());
cancelAnimationFrame(id);
```

**解决方案**：
使用鸿蒙的 Animator API
```typescript
// ✅ 正确 - 使用createAnimator
this.animator = this.getUIContext().createAnimator({
  duration: 400,
  easing: 'linear',
  delay: 0,
  fill: 'forwards',
  direction: 'normal',
  iterations: 1,
  begin: 0,
  end: 1
});

this.animator.onFrame = (progress: number) => {
  this.drawFrame();
};

this.animator.play();
```

文件位置：`src/components/CanvasLyricPlayerComponent.ets:118`

### 3. 字体使用

**更新前**：
```typescript
fontFamily = 'sans-serif';
```

**更新后**：
```typescript
// 普通字体
private readonly normalFont: string = 'HarmonyHeiTi';
// 加粗字体
private readonly boldFont: string = 'HarmonyHeiTi-Bold';

// 使用
ctx.font = `${fontWeight} ${fontSize}vp ${fontFamily}`;
```

文件位置：`src/canvas/CanvasLyricRenderer.ets:33-35`

### 4. 类型声明完整性

所有变量都显式声明类型：
```typescript
// ✅ 正确
const width: number = 100;
const name: string = 'hello';
const enabled: boolean = true;
const items: LyricWord[] = [];

// ❌ 错误
const width = 100;  // 不能依赖类型推断
```

## 技术实现细节

### Animator API 使用

```typescript
/**
 * 启动滚动动画
 */
private startScrollAnimator(): void {
  if (!this.controller) {
    return;
  }

  // 停止之前的动画
  if (this.animator) {
    this.animator.finish();
  }

  // 创建新的动画器
  this.animator = this.getUIContext().createAnimator({
    duration: 400,      // 动画时长（毫秒）
    easing: 'linear',   // 缓动函数
    delay: 0,           // 延迟（毫秒）
    fill: 'forwards',   // 填充模式
    direction: 'normal',// 方向
    iterations: 1,      // 迭代次数
    begin: 0,           // 起始值
    end: 1              // 结束值
  });

  // 设置帧回调
  this.animator.onFrame = (progress: number) => {
    // progress: 0-1 的动画进度
    if (this.controller) {
      this.controller.update(16.67); // 更新弹簧动画
      this.drawFrame();              // 绘制帧
    }
  };

  // 设置完成回调
  this.animator.onFinish = () => {
    this.drawFrame();
  };

  // 播放动画
  this.animator.play();
}
```

### 渲染循环逻辑

与Web版本的区别：

**Web版本**：
```typescript
function renderLoop() {
  update();
  render();
  requestAnimationFrame(renderLoop);
}
renderLoop();
```

**ArkTS版本**：
```typescript
// 不使用持续的渲染循环
// 仅在需要时触发动画

setCurrentTime(time: number) {
  const oldLine = this.currentLine;
  updateState(time);
  const newLine = this.currentLine;

  if (oldLine !== newLine) {
    // 行切换时启动动画
    this.startScrollAnimator();
  } else {
    // 否则直接绘制
    this.drawFrame();
  }
}
```

### 字体渲染

使用鸿蒙系统字体：

```typescript
// 普通歌词 - HarmonyHeiTi
ctx.font = 'normal 20vp HarmonyHeiTi';

// 激活歌词 - HarmonyHeiTi-Bold
ctx.font = 'bold 24vp HarmonyHeiTi-Bold';

// 翻译 - HarmonyHeiTi（小号）
ctx.font = 'normal 14vp HarmonyHeiTi';

// 音译 - HarmonyHeiTi（更小号）
ctx.font = 'normal 12vp HarmonyHeiTi';
```

## 类型系统总结

### 数据模型类

| 类名 | 作用 | 文件 |
|------|------|------|
| LyricWord | 歌词单词数据 | LyricModels.ets:9 |
| LyricLine | 歌词行数据 | LyricModels.ets:44 |
| LyricPlayerConfig | 播放器配置 | LyricModels.ets:90 |
| LyricLineRenderState | 渲染状态 | LyricModels.ets:121 |
| WordRenderInfo | 单词渲染信息 | LyricModels.ets:140 |
| InterludeState | 间奏动画状态 | LyricModels.ets:159 |
| CanvasRenderContext | Canvas上下文配置 | LyricModels.ets:174 |
| **RendererConfig** | **渲染器配置（新增）** | **LyricModels.ets:190** |

### 为什么需要 RendererConfig

原代码：
```typescript
renderLine(
  state: LyricLineRenderState,
  currentTime: number,
  config: {  // ❌ 对象字面量类型
    enableEmphasize: boolean,
    enableGlow: boolean
  }
)
```

ArkTS不允许对象字面量作为类型，必须使用明确的类或接口。但接口在某些场景有限制，所以使用类。

新代码：
```typescript
renderLine(
  state: LyricLineRenderState,
  currentTime: number,
  config: RendererConfig  // ✅ 使用类
)
```

## 性能考虑

### Animator vs RequestAnimationFrame

| 特性 | RequestAnimationFrame | Animator |
|------|----------------------|----------|
| 平台 | Web | HarmonyOS |
| 控制 | 手动控制每帧 | 系统管理 |
| 性能 | 依赖实现 | 系统优化 |
| 暂停/恢复 | 需要手动实现 | API支持 |

### 何时触发渲染

1. **歌词行切换** - 启动滚动动画
2. **动画进行中** - onFrame回调中绘制
3. **尺寸变化** - onAreaChange中重绘
4. **歌词数据更新** - 立即重绘

### 优化策略

1. **避免过度渲染**
   - 只在行切换时启动动画
   - 其他时间仅在数据变化时绘制

2. **虚拟滚动**
   - 只渲染可见行（isInView）
   - 减少不必要的绘制调用

3. **Canvas状态管理**
   - 使用 save()/restore() 管理状态
   - 避免状态泄漏

## 编译检查清单

- [x] 所有变量显式类型声明
- [x] 无对象字面量类型
- [x] 无类型推断依赖
- [x] 使用鸿蒙API（Animator）
- [x] 使用系统字体（HarmonyHeiTi）
- [x] 正确的生命周期管理
- [x] 资源清理（aboutToDisappear）

## 测试建议

### 类型检查
```bash
# 确保没有类型错误
hvigorw assembleHap
```

### 运行时测试
1. 歌词切换动画流畅度
2. 长文本换行正确性
3. 内存占用稳定性
4. 多次快速切换无卡顿

### 兼容性测试
- [ ] HarmonyOS 3.0
- [ ] HarmonyOS 4.0
- [ ] HarmonyOS NEXT

## 参考文档

- [ArkTS语法规范](https://developer.harmonyos.com/cn/docs/documentation/doc-guides-V3/arkts-basic-syntax-overview-0000001531611153-V3)
- [Animator API](https://developer.harmonyos.com/cn/docs/documentation/doc-references-V3/js-apis-animator-0000001427902720-V3)
- [Canvas API](https://developer.harmonyos.com/cn/docs/documentation/doc-references-V3/ts-components-canvas-canvas-0000001427902480-V3)
- [HarmonyOS字体](https://developer.harmonyos.com/cn/docs/design/des-guides/font-0000001157868841)
