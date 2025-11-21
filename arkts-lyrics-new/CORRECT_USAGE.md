# ✅ 正确的组件使用方式

## 问题分析

错误 `Cannot read property canvasWidth of undefined` 中的 "of undefined" 表明**不是 `canvasWidth` 未定义，而是 `this` 为 undefined**。

这通常发生在：
1. 组件属性使用了 `@Prop` 或 `@State`，但初始化时机不对
2. 在父组件中传递属性时出现了问题
3. 组件的生命周期方法调用时机不对

## ✅ 正确的组件定义

```typescript
@Component
export struct CanvasLyricPlayerComponent {
  // ❌ 错误：不要在组件内部使用 @State 或 @Prop 来定义 Canvas 尺寸
  // @State canvasWidth: number = 0;
  // @State canvasHeight: number = 0;

  // ✅ 正确：使用 private 属性
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  // 如果需要从父组件接收数据，使用 @Prop（但不是 Canvas 尺寸）
  @Prop lyrics: LyricLine[] = [];
  @Prop currentTime: number = 0;

  // 组件生命周期
  aboutToAppear(): void {
    // 不要在这里访问 canvasWidth/Height，它们此时还是 0
    console.info('[Component] aboutToAppear called');
  }

  build() {
    Column() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .onReady((): void => {
          // Canvas 已准备好，但还没有尺寸
          console.info('[Canvas] onReady');
        })
        .onAreaChange((oldArea: Area, newArea: Area): void => {
          // ✅ 这里获取真实的 Canvas 尺寸
          this.canvasWidth = Number.parseFloat(newArea.width.toString());
          this.canvasHeight = Number.parseFloat(newArea.height.toString());

          console.info('[Canvas] Size:', this.canvasWidth, 'x', this.canvasHeight);

          // 现在可以安全地使用 canvasWidth 和 canvasHeight 了
          if (this.canvasWidth > 0 && this.canvasHeight > 0) {
            this.initializeRenderer();
          }
        })
    }
  }

  private initializeRenderer(): void {
    // 在这里使用 canvasWidth 和 canvasHeight
    console.info('[Renderer] Initialize with size:', this.canvasWidth, 'x', this.canvasHeight);
  }
}
```

## ✅ 正确的父组件使用方式

```typescript
@Entry
@Component
struct ParentPage {
  @State lyrics: LyricLine[] = [];
  @State currentTime: number = 0;

  aboutToAppear(): void {
    // 加载歌词数据
    this.lyrics = this.loadLyrics();
  }

  build() {
    Column() {
      // ✅ 正确：通过 @Prop 传递数据
      CanvasLyricPlayerComponent({
        lyrics: this.lyrics,
        currentTime: this.currentTime
      })
        .width('100%')
        .height('100%')
    }
  }

  private loadLyrics(): LyricLine[] {
    // 加载歌词...
    return [];
  }
}
```

## ❌ 常见错误

### 错误 1：在 aboutToAppear() 中使用 Canvas 尺寸

```typescript
// ❌ 错误
aboutToAppear(): void {
  const context = new CanvasRenderContext(
    this.canvasWidth,  // 此时还是 0！
    this.canvasHeight  // 此时还是 0！
  );
}

// ✅ 正确：等到 onAreaChange 获取尺寸后再初始化
```

### 错误 2：混用 @State 和 private

```typescript
// ❌ 错误：@State private 是非法的
@State private canvasWidth: number = 0;

// ❌ 错误：Canvas 尺寸不需要 @State（不需要触发 UI 更新）
@State canvasWidth: number = 0;

// ✅ 正确：使用 private
private canvasWidth: number = 0;
```

### 错误 3：在属性初始化时访问其他属性

```typescript
// ❌ 错误：初始化顺序问题
private canvasWidth: number = 0;
private someValue: number = this.canvasWidth * 2;  // this 可能未定义！

// ✅ 正确：在方法中计算
private canvasWidth: number = 0;
private someValue: number = 0;

aboutToAppear(): void {
  this.someValue = this.canvasWidth * 2;
}
```

## 🔍 调试步骤

如果您还在遇到错误，请按照以下步骤调试：

### 步骤 1：检查组件定义

确保您的组件中：
- ✅ `canvasWidth` 和 `canvasHeight` 是 `private`（不是 `@State`）
- ✅ Canvas 上下文在声明时创建：`private canvasContext = new CanvasRenderingContext2D(...)`
- ✅ 属性初始化不依赖其他实例属性

### 步骤 2：检查生命周期使用

- ✅ 不要在 `aboutToAppear()` 中访问 Canvas 尺寸
- ✅ 在 `onAreaChange` 回调中获取尺寸
- ✅ 只在获得有效尺寸后才初始化渲染器

### 步骤 3：检查父组件

- ✅ 确保父组件正确传递 `@Prop` 属性
- ✅ 不要直接修改子组件的内部状态

### 步骤 4：添加日志

在关键位置添加日志：

```typescript
aboutToAppear(): void {
  console.info('[DEBUG] aboutToAppear: canvasWidth =', this.canvasWidth);
  console.info('[DEBUG] aboutToAppear: this =', this);
}

build() {
  Column() {
    Canvas(this.canvasContext)
      .onAreaChange((oldArea: Area, newArea: Area): void => {
        console.info('[DEBUG] onAreaChange called');
        console.info('[DEBUG] this =', this);
        console.info('[DEBUG] New size:', newArea.width, 'x', newArea.height);
      })
  }
}
```

## 📋 完整检查清单

- [ ] `canvasWidth` 和 `canvasHeight` 是 `private`（不是 `@State`）
- [ ] Canvas 上下文在声明时创建
- [ ] 不在 `aboutToAppear()` 中使用 Canvas 尺寸
- [ ] 在 `onAreaChange` 中获取尺寸
- [ ] 所有回调函数使用箭头函数保持 `this` 上下文
- [ ] 父组件正确使用 `@Prop` 传递数据
- [ ] 清理项目缓存并重新构建
- [ ] 检查编译错误和警告

## 💡 如果问题仍然存在

请提供：
1. 完整的组件代码（前50行）
2. 父组件的使用代码
3. 完整的错误堆栈（包括所有行号）
4. HarmonyOS SDK 版本

这样我可以更准确地帮助您定位问题。
