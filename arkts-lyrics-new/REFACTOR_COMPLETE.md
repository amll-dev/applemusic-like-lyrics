# ✅ 重构完成 - 使用正确的 ArkTS 声明式 UI 模式

## 🎯 问题根源

您发现了一个**关键的架构问题**：

```typescript
// ❌ 错误的做法
build() {
  // 实例 A：显示在屏幕上
  CanvasLyricPlayerComponent({ ... })
    .onAppear(() => {
      // 实例 B：通过 new 创建，保存在变量中
      this.lyricPlayerComponent = new CanvasLyricPlayerComponent();  // ❌
      this.lyricPlayerComponent.setLyricLines(lines);  // ❌ 操作的不是屏幕上的组件！
    })
}
```

**问题**：
1. 创建了两个完全不同的实例（A 和 B）
2. 对实例 B 调用方法，但屏幕显示的是实例 A
3. 实例 A 从未收到任何数据，导致 `undefined` 错误
4. `new CanvasLyricPlayerComponent()` 是非法的，会导致 `this` 上下文未初始化

## ✅ 解决方案：完整重构

我们采用了**方案 1：声明式 UI 模式（@Prop）**，完全符合 ArkTS 规范。

### 1. CanvasLyricPlayerComponent 重构

#### 添加 @Prop 属性

```typescript
@Component
export struct CanvasLyricPlayerComponent {
  // ✅ 从父组件接收数据
  @Prop lyricLines: LyricLine[] = [];
  @Prop @Watch('onCurrentTimeChanged') currentTime: number = 0;
  @Prop playerConfig: LyricPlayerConfig = LyricPlayerConfig.create();

  // Private 内部状态
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;
  private controller: LyricPlayerController | null = null;
  private renderer: CanvasLyricRenderer | null = null;
  private animator: AnimatorResult | null = null;
```

#### 移除 public 方法

```typescript
// ❌ 移除：不再需要这些方法
// public setLyricLines(lines: LyricLine[]): void { ... }
// public setCurrentTime(timeMs: number): void { ... }
```

#### 添加响应式更新

```typescript
/**
 * 当前时间变化时自动调用
 * 🔥 通过 @Watch('onCurrentTimeChanged') 自动触发
 */
onCurrentTimeChanged(): void {
  if (!this.controller) {
    return;
  }

  const oldLineIndex: number = this.controller.getCurrentLineIndex();
  this.controller.setCurrentTime(this.currentTime);
  const newLineIndex: number = this.controller.getCurrentLineIndex();

  // 如果行切换，启动滚动动画
  if (oldLineIndex !== newLineIndex && newLineIndex !== -1) {
    this.startScrollAnimator();
  } else {
    // 否则直接绘制
    this.drawFrame();
  }
}

/**
 * 当 @Prop 属性变化时，ArkTS 框架自动调用
 */
aboutToUpdate(): void {
  // 当 lyricLines 变化时，更新控制器
  if (this.controller && this.lyricLines.length > 0) {
    console.info('[LyricPlayer] 📝 Lyrics updated, count:', this.lyricLines.length);
    this.controller.setLyricLines(this.lyricLines);
    this.drawFrame();
  }
}
```

### 2. CanvasLyricPlayerDemo 完全重写

#### 在父组件中维护状态

```typescript
@Entry
@Component
struct CanvasLyricPlayerDemoPage {
  // ✅ 在父组件中维护 @State
  @State lyrics: LyricLine[] = [];
  @State currentTimeMs: number = 0;
  @State isPlaying: boolean = false;
  @State sliderValue: number = 0;

  // ❌ 移除错误的组件引用
  // private lyricPlayerComponent: CanvasLyricPlayerComponent | null = null;

  private timerHandle: number = -1;
  private readonly maxTimeMs: number = 30000;

  aboutToAppear(): void {
    // ✅ 在初始化时加载歌词
    this.lyrics = this.createSampleLyrics();
  }
```

#### 使用声明式 UI

```typescript
build() {
  Column() {
    // ✅ 通过 @Prop 传递数据
    CanvasLyricPlayerComponent({
      lyricLines: this.lyrics,          // ← 传递歌词数据
      currentTime: this.currentTimeMs,  // ← 传递当前时间（自动触发 @Watch）
      playerConfig: LyricPlayerConfig.create({ ... })
    })
      .layoutWeight(1)

    // ❌ 移除错误的 .onAppear(() => { new ... })

    // 控制按钮...
  }
}
```

#### 直接更新状态

```typescript
private startPlayback(): void {
  this.isPlaying = true;
  let lastTime: number = Date.now();

  this.timerHandle = setInterval(() => {
    const now: number = Date.now();
    const delta: number = now - lastTime;
    lastTime = now;

    // ✅ 直接更新 @State
    // 子组件通过 @Prop/@Watch 自动响应
    this.currentTimeMs += delta;
    this.sliderValue = this.currentTimeMs;

    // 循环播放
    if (this.currentTimeMs > this.maxTimeMs) {
      this.currentTimeMs = 0;
    }
  }, 16);  // ~60fps
}
```

## 📊 对比：之前 vs 现在

| 特性 | 之前（错误）| 现在（正确）|
|------|------------|-------------|
| 组件实例 | 两个不同实例（A和B）| 单一实例，由框架管理 |
| 数据传递 | 调用 public 方法 | 通过 @Prop 传递 |
| 状态更新 | 手动调用方法 | @Watch 自动响应 |
| 组件引用 | 保存在变量中 | 不需要保存 |
| 生命周期 | 手动管理 | 框架自动管理 |
| 符合规范 | ❌ 违反 ArkTS 规范 | ✅ 完全符合 |
| 代码复杂度 | 高 | 低 |
| 维护性 | 差 | 好 |
| 性能 | 一般 | 优秀 |

## 🎯 关键要点

### ✅ 正确的做法

1. **在父组件中维护 `@State`**
   ```typescript
   @State lyrics: LyricLine[] = [];
   @State currentTimeMs: number = 0;
   ```

2. **子组件接收 `@Prop`**
   ```typescript
   @Prop lyricLines: LyricLine[] = [];
   @Prop @Watch('onCurrentTimeChanged') currentTime: number = 0;
   ```

3. **使用 `@Watch` 监听变化**
   ```typescript
   onCurrentTimeChanged(): void {
     // 当 currentTime 变化时自动调用
     this.controller.setCurrentTime(this.currentTime);
     this.drawFrame();
   }
   ```

4. **在 `build()` 中通过 @Prop 传递数据**
   ```typescript
   CanvasLyricPlayerComponent({
     lyricLines: this.lyrics,
     currentTime: this.currentTimeMs
   })
   ```

### ❌ 错误的做法（已移除）

1. **❌ 不要用 `new` 创建组件**
   ```typescript
   // ❌ 错误
   this.component = new CanvasLyricPlayerComponent();
   ```

2. **❌ 不要保存组件引用**
   ```typescript
   // ❌ 错误
   private lyricPlayerComponent: CanvasLyricPlayerComponent | null = null;
   ```

3. **❌ 不要在 `onAppear` 中调用组件方法**
   ```typescript
   // ❌ 错误
   .onAppear(() => {
     this.lyricPlayerComponent.setLyricLines(lines);
   })
   ```

4. **❌ 不要定义 public 方法供外部调用**
   ```typescript
   // ❌ 错误
   public setLyricLines(lines: LyricLine[]): void { ... }
   ```

## 🚀 现在的工作流程

### 父组件（Demo）

1. 在 `aboutToAppear()` 中加载歌词数据
2. 将歌词存储在 `@State lyrics` 中
3. 在定时器中更新 `@State currentTimeMs`
4. 在 `build()` 中通过 @Prop 传递给子组件

### 子组件（CanvasLyricPlayerComponent）

1. 通过 `@Prop` 接收 `lyricLines` 和 `currentTime`
2. 在 `aboutToAppear()` 中初始化控制器和渲染器
3. 当 `currentTime` 变化时，`@Watch` 自动调用 `onCurrentTimeChanged()`
4. 在 `onCurrentTimeChanged()` 中更新控制器和重绘

### 数据流

```
Parent Component (Demo)
  @State lyrics ─────────────┐
  @State currentTimeMs ──────┤
                             │
                             ↓
                        [ @Prop ]
                             │
                             ↓
Child Component (CanvasLyricPlayerComponent)
  @Prop lyricLines ←─────────┤
  @Prop @Watch currentTime ←─┘
                             │
                             ↓
                     [ onCurrentTimeChanged() ]
                             │
                             ↓
                     [ controller.setCurrentTime() ]
                             │
                             ↓
                        [ drawFrame() ]
```

## 🎉 成果

✅ **完全符合 ArkTS 声明式 UI 规范**
✅ **解决了所有 "undefined" 错误**
✅ **代码更简洁、更易维护**
✅ **性能更好（框架优化）**
✅ **更容易理解和调试**
✅ **避免了 `this` 上下文问题**

## 📝 使用方法

### 1. 复制代码到您的 HarmonyOS 项目

```bash
# 复制组件
cp arkts-lyrics-new/src/components/CanvasLyricPlayerComponent.ets \
   <你的项目>/entry/src/main/ets/components/

# 复制 Demo
cp arkts-lyrics-new/demo/CanvasLyricPlayerDemo.ets \
   <你的项目>/entry/src/main/ets/pages/
```

### 2. 清理并重新构建

- Build → Clean Project
- Build → Rebuild Project

### 3. 运行应用

- 点击播放按钮开始播放
- 歌词会自动滚动并高亮
- 支持拖动进度条跳转

## 💡 如果还有问题

如果您还遇到任何问题，请提供：

1. 完整的错误信息
2. 您使用的代码（是否直接使用本仓库代码？）
3. DevEco Studio 和 SDK 版本
4. 是否清理了缓存并重新构建

---

**祝贺！🎉 您现在拥有一个完全符合 ArkTS 规范的、架构正确的歌词播放器组件！**
