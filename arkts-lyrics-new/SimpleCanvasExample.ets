/**
 * 最简化的 Canvas 组件示例
 * 用于验证 Canvas 上下文和尺寸的正确初始化
 *
 * 这个示例只做一件事：在 Canvas 上绘制文本
 * 如果这个能工作，说明基础设置是正确的
 */

/**
 * 简单的 Canvas 组件
 */
@Component
export struct SimpleCanvasComponent {
  // ✅ 关键1：在声明时创建 Canvas 上下文
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  // ✅ 关键2：Canvas 尺寸使用 private（不是 @State）
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  // ✅ 关键3：不在 aboutToAppear() 中使用 Canvas 尺寸
  aboutToAppear(): void {
    console.info('[SimpleCanvas] aboutToAppear called');
    console.info('[SimpleCanvas] Initial size:', this.canvasWidth, 'x', this.canvasHeight);
    // 此时尺寸还是 0，这是正常的
  }

  build() {
    Column() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .backgroundColor('#000000')
        .onReady((): void => {
          console.info('[SimpleCanvas] onReady called');
          // 注意：此时 Canvas 已准备好，但还没有尺寸信息
        })
        .onAreaChange((oldArea: Area, newArea: Area): void => {
          // ✅ 关键4：在 onAreaChange 中获取真实尺寸
          const newWidth = Number.parseFloat(newArea.width.toString());
          const newHeight = Number.parseFloat(newArea.height.toString());

          console.info('[SimpleCanvas] Area changed:');
          console.info('[SimpleCanvas]   Old:', oldArea.width, 'x', oldArea.height);
          console.info('[SimpleCanvas]   New:', newWidth, 'x', newHeight);

          // 更新尺寸
          this.canvasWidth = newWidth;
          this.canvasHeight = newHeight;

          // ✅ 关键5：只有在尺寸有效时才渲染
          if (this.canvasWidth > 0 && this.canvasHeight > 0) {
            console.info('[SimpleCanvas] Valid size obtained, drawing...');
            this.draw();
          }
        })
    }
    .width('100%')
    .height('100%')
  }

  /**
   * 绘制内容
   */
  private draw(): void {
    console.info('[SimpleCanvas] draw() called');
    console.info('[SimpleCanvas] Canvas size:', this.canvasWidth, 'x', this.canvasHeight);

    // ✅ 验证 Canvas 上下文存在
    if (!this.canvasContext) {
      console.error('[SimpleCanvas] ❌ Canvas context is null!');
      return;
    }

    try {
      // 清空画布
      this.canvasContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 绘制黑色背景
      this.canvasContext.fillStyle = '#000000';
      this.canvasContext.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 绘制白色文本
      this.canvasContext.fillStyle = '#FFFFFF';
      this.canvasContext.font = '32px sans-serif';
      this.canvasContext.textAlign = 'center';
      this.canvasContext.textBaseline = 'middle';
      this.canvasContext.fillText(
        'Canvas works! ✓',
        this.canvasWidth / 2,
        this.canvasHeight / 2
      );

      // 绘制尺寸信息
      this.canvasContext.font = '16px sans-serif';
      this.canvasContext.fillText(
        `Size: ${this.canvasWidth.toFixed(0)} x ${this.canvasHeight.toFixed(0)}`,
        this.canvasWidth / 2,
        this.canvasHeight / 2 + 40
      );

      console.info('[SimpleCanvas] ✓ Drawing complete');
    } catch (error) {
      console.error('[SimpleCanvas] ❌ Error in draw():', error);
    }
  }
}

/**
 * 测试页面 - 使用简单的 Canvas 组件
 */
@Entry
@Component
struct SimpleCanvasTestPage {
  aboutToAppear(): void {
    console.info('[TestPage] aboutToAppear called');
  }

  build() {
    Column() {
      // 标题
      Text('Simple Canvas Test')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 20, bottom: 10 })

      Text('If you see "Canvas works! ✓" below, the setup is correct')
        .fontSize(14)
        .fontColor('#888888')
        .margin({ bottom: 20 })

      // Canvas 组件
      SimpleCanvasComponent()
        .width('90%')
        .height(300)
        .border({ width: 2, color: '#FF0000' })  // 红色边框，方便看到 Canvas 区域
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Center)
  }
}
