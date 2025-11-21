/**
 * 间奏点动画组件
 * 在歌词间隔显示三个跳动的圆点
 */

@Component
export struct InterludeDots {
  @State dotOpacities: number[] = [0.3, 0.3, 0.3];
  @State dotScales: number[] = [1, 1, 1];
  private timer: number = -1;
  private animationIndex: number = 0;

  aboutToAppear() {
    this.startAnimation();
  }

  aboutToDisappear() {
    if (this.timer !== -1) {
      clearInterval(this.timer);
    }
  }

  /**
   * 启动动画
   */
  startAnimation() {
    this.timer = setInterval(() => {
      this.animateDot(this.animationIndex % 3);
      this.animationIndex++;
    }, 400);
  }

  /**
   * 动画单个圆点
   */
  animateDot(index: number) {
    // 放大并提高透明度
    this.dotScales[index] = 1.5;
    this.dotOpacities[index] = 1;

    // 400ms后恢复
    setTimeout(() => {
      this.dotScales[index] = 1;
      this.dotOpacities[index] = 0.3;
    }, 400);
  }

  build() {
    Row({ space: 12 }) {
      ForEach([0, 1, 2], (index: number) => {
        Circle({ width: 8, height: 8 })
          .fill(Color.White)
          .opacity(this.dotOpacities[index])
          .scale({
            x: this.dotScales[index],
            y: this.dotScales[index]
          })
          .animation({
            duration: 400,
            curve: Curve.EaseInOut
          })
      }, (index: number) => `dot-${index}`)
    }
    .justifyContent(FlexAlign.Center)
    .width('100%')
    .padding({ top: 20, bottom: 20 })
  }
}
