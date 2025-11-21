# 🔧 架构问题修复方案

## 🔴 当前问题

您发现了一个**关键的架构问题**：

```typescript
// ❌ 错误的用法
@Component
struct DemoPage {
  private lyricPlayerComponent: CanvasLyricPlayerComponent | null = null;

  build() {
    // 实例 1：这个组件显示在屏幕上
    CanvasLyricPlayerComponent({ ... })
      .onAppear(() => {
        // 实例 2：这是一个新的、不同的实例！
        this.lyricPlayerComponent = new CanvasLyricPlayerComponent();  // ❌ 错误！
        this.lyricPlayerComponent.setLyricLines(lines);  // ❌ 操作的不是屏幕上的组件！
      })
  }
}
```

### 问题分析

1. **两个不同的实例**：
   - `build()` 中的 `CanvasLyricPlayerComponent({ ... })` 创建实例 A（显示在屏幕上）
   - `new CanvasLyricPlayerComponent()` 创建实例 B（保存在变量中）
   - 实例 A 和实例 B 完全不同！

2. **不能用 `new` 创建组件**：
   - ArkTS 的 `@Component` struct 不能通过 `new` 实例化
   - 这会导致 `this` 上下文未正确初始化
   - 生命周期方法不会被调用
   - `@State`/`@Prop` 等装饰器不会生效

3. **方法调用无效**：
   - `this.lyricPlayerComponent.setLyricLines(lines)` 操作的是实例 B
   - 但屏幕上显示的是实例 A
   - 所以实例 A 从未收到任何数据！

## ✅ 解决方案：两种模式

### 方案 1：声明式 UI 模式（推荐）

**原理**：通过 `@Prop` 和 `@Watch` 传递数据，完全符合 ArkTS 最佳实践。

#### 步骤 1：修改 `CanvasLyricPlayerComponent` 添加 @Prop

```typescript
@Component
export struct CanvasLyricPlayerComponent {
  // ✅ 添加 @Prop 接收父组件传递的数据
  @Prop lyricLines: LyricLine[] = [];
  @Prop @Watch('onCurrentTimeChanged') currentTime: number = 0;

  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  private controller: LyricPlayerController | null = null;
  private renderer: CanvasLyricRenderer | null = null;

  /** 播放器配置 */
  @Prop playerConfig: LyricPlayerConfig = LyricPlayerConfig.create();

  aboutToAppear(): void {
    // 初始化控制器
    this.controller = new LyricPlayerController(this.playerConfig);

    // 初始化渲染器
    const renderContext: CanvasRenderContext = new CanvasRenderContext(
      this.canvasWidth,
      this.canvasHeight,
      1.0
    );
    this.renderer = new CanvasLyricRenderer(renderContext);
    this.renderer.setCanvasContext(this.canvasContext);

    // 🔥 关键：在初始化时设置歌词
    if (this.controller && this.lyricLines.length > 0) {
      this.controller.setLyricLines(this.lyricLines);
    }
  }

  /**
   * 监听 currentTime 变化
   */
  onCurrentTimeChanged(): void {
    if (this.controller) {
      this.controller.setCurrentTime(this.currentTime);
      this.drawFrame();
    }
  }

  /**
   * 监听 lyricLines 变化
   */
  aboutToUpdate(): void {
    // 当 @Prop lyricLines 变化时，ArkTS 会自动调用此方法
    if (this.controller && this.lyricLines.length > 0) {
      this.controller.setLyricLines(this.lyricLines);
      this.drawFrame();
    }
  }

  // ... 其他代码保持不变

  build() {
    Stack() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .onAreaChange((oldArea: Area, newArea: Area): void => {
          const newWidth = Number.parseFloat(newArea.width.toString());
          const newHeight = Number.parseFloat(newArea.height.toString());

          if (newWidth > 0 && newHeight > 0) {
            this.handleSizeChange(newWidth, newHeight);
          }
        })
    }
    .width('100%')
    .height('100%')
  }
}
```

#### 步骤 2：修改 Demo 使用声明式模式

```typescript
@Entry
@Component
struct CanvasLyricPlayerDemoPage {
  // ✅ 在父组件中维护状态
  @State lyrics: LyricLine[] = [];
  @State currentTimeMs: number = 0;
  @State isPlaying: boolean = false;

  private timerHandle: number = -1;

  aboutToAppear(): void {
    // ✅ 在组件初始化时加载歌词
    this.lyrics = this.createSampleLyrics();
  }

  private startPlayback(): void {
    this.isPlaying = true;
    let lastTime: number = Date.now();

    this.timerHandle = setInterval(() => {
      const now: number = Date.now();
      const delta: number = now - lastTime;
      lastTime = now;

      // ✅ 直接更新 @State，子组件自动响应
      this.currentTimeMs += delta;

      if (this.currentTimeMs > 30000) {
        this.currentTimeMs = 0;
      }
    }, 16);
  }

  build() {
    Column() {
      // ✅ 通过 @Prop 传递数据
      CanvasLyricPlayerComponent({
        lyricLines: this.lyrics,          // ← 传递歌词数据
        currentTime: this.currentTimeMs,  // ← 传递当前时间
        playerConfig: LyricPlayerConfig.create({
          alignAnchor: 'center',
          alignPosition: 0.4,
          enableScale: true,
          // ...
        })
      })
        .layoutWeight(1)

      // 控制按钮...
    }
  }
}
```

### 方案 2：引用模式（临时方案）

如果您暂时不想重构组件，可以使用**控制器模式**：

#### 修改 `CanvasLyricPlayerComponent` 暴露控制器

```typescript
@Component
export struct CanvasLyricPlayerComponent {
  // ...

  /**
   * 获取控制器的公开方法（用于外部调用）
   */
  public getController(): LyricPlayerController | null {
    return this.controller;
  }
}
```

#### 修改 Demo 使用 `@Link` 获取引用

```typescript
@Entry
@Component
struct CanvasLyricPlayerDemoPage {
  @State lyrics: LyricLine[] = [];
  @State currentTimeMs: number = 0;

  // ✅ 使用回调函数获取组件引用
  private componentController: LyricPlayerController | null = null;

  aboutToAppear(): void {
    this.lyrics = this.createSampleLyrics();
  }

  build() {
    Column() {
      CanvasLyricPlayerComponent({
        playerConfig: LyricPlayerConfig.create({ ... })
      })
        .layoutWeight(1)
        .onAppear(() => {
          // ⚠️ 警告：这仍然不是最佳实践！
          // 但比 new CanvasLyricPlayerComponent() 好一些
          // 需要在组件内部实现一个回调机制来传递控制器引用
        })
    }
  }
}
```

**注意**：方案 2 仍然不完美，只是临时解决方案。

## 📊 两种方案对比

| 特性 | 方案 1（声明式）| 方案 2（引用） |
|------|----------------|---------------|
| 符合 ArkTS 规范 | ✅ 完全符合 | ⚠️ 勉强可用 |
| 代码复杂度 | 低 | 中 |
| 维护性 | ✅ 好 | ⚠️ 一般 |
| 性能 | ✅ 最优 | ⚠️ 一般 |
| 推荐程度 | ⭐⭐⭐⭐⭐ | ⭐⭐ |

## 🎯 推荐做法

**强烈推荐使用方案 1（声明式 UI 模式）**：

1. ✅ 完全符合 HarmonyOS ArkTS 规范
2. ✅ 代码更简洁、更易维护
3. ✅ 性能更好（ArkTS 框架优化）
4. ✅ 更容易理解和调试
5. ✅ 避免 `this` 上下文问题

## 📝 总结

您发现的问题是：

> **不能用 `new CanvasLyricPlayerComponent()` 创建组件实例！**
>
> 这会创建一个与屏幕上显示的组件完全不同的实例，
> 导致所有方法调用都无效，从而出现 "undefined" 错误。

正确的做法是：

> **通过 `@Prop` 传递数据，让 ArkTS 框架管理组件的创建和生命周期。**

---

## 🚀 下一步

我可以帮您：

1. **完整重构** `CanvasLyricPlayerComponent` 使用 `@Prop` 模式（推荐）
2. **提供临时解决方案**，保持现有接口（不推荐）

请告诉我您希望采用哪种方案？
