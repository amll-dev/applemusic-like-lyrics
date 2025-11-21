/**
 * Canvas歌词播放器组件
 * 使用Canvas渲染，完全符合ArkTS规范
 */

import { LyricLine, LyricPlayerConfig, LyricLineRenderState, InterludeState, CanvasRenderContext } from '../models/LyricModels';
import { LyricPlayerController } from '../core/LyricPlayerController';
import { CanvasLyricRenderer } from '../canvas/CanvasLyricRenderer';

@Component
export struct CanvasLyricPlayerComponent {
  @State private canvasWidth: number = 0;
  @State private canvasHeight: number = 0;
  @State private needsRedraw: boolean = false;

  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  private controller: LyricPlayerController | null = null;
  private renderer: CanvasLyricRenderer | null = null;
  private animationFrameId: number = -1;
  private lastFrameTime: number = 0;

  public playerConfig: LyricPlayerConfig = LyricPlayerConfig.create();

  aboutToAppear(): void {
    this.controller = new LyricPlayerController(this.playerConfig);

    const renderContext: CanvasRenderContext = new CanvasRenderContext(
      this.canvasWidth,
      this.canvasHeight,
      1.0
    );
    this.renderer = new CanvasLyricRenderer(renderContext);
    this.renderer.setCanvasContext(this.canvasContext);

    this.startRenderLoop();
  }

  aboutToDisappear(): void {
    this.stopRenderLoop();
  }

  /**
   * 设置歌词数据
   */
  public setLyricLines(lines: LyricLine[]): void {
    if (this.controller) {
      this.controller.setLyricLines(lines);
      this.needsRedraw = true;
    }
  }

  /**
   * 设置当前时间
   */
  public setCurrentTime(timeMs: number): void {
    if (this.controller) {
      this.controller.setCurrentTime(timeMs);
      this.needsRedraw = true;
    }
  }

  /**
   * 启动渲染循环
   */
  private startRenderLoop(): void {
    this.lastFrameTime = Date.now();
    this.renderFrame();
  }

  /**
   * 停止渲染循环
   */
  private stopRenderLoop(): void {
    if (this.animationFrameId !== -1) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = -1;
    }
  }

  /**
   * 渲染帧
   */
  private renderFrame(): void {
    const now: number = Date.now();
    const deltaTime: number = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (this.controller) {
      this.controller.update(deltaTime);
    }

    if (this.needsRedraw) {
      this.draw();
      this.needsRedraw = false;
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.renderFrame();
    });
  }

  /**
   * 绘制Canvas内容
   */
  private draw(): void {
    if (!this.renderer || !this.controller) {
      return;
    }

    this.renderer.clear();

    const lineStates: LyricLineRenderState[] = this.controller.getLineStates();
    const scrollOffset: number = this.controller.getScrollOffset();
    const config = this.controller.getConfig();

    this.canvasContext.save();
    this.canvasContext.translate(0, -scrollOffset);

    lineStates.forEach((state: LyricLineRenderState) => {
      if (state.isInView) {
        this.renderer!.renderLine(state, this.controller!.setCurrentTime, {
          enableEmphasize: config.enableEmphasize,
          enableGlow: config.enableGlow,
          showTranslation: config.showTranslation,
          showRoman: config.showRoman
        });
      }
    });

    const interludeState: InterludeState = this.controller.getInterludeState();
    if (interludeState.visible) {
      this.renderer.renderInterlude(
        interludeState.positionY,
        interludeState.dotOpacities,
        interludeState.dotScales
      );
    }

    this.canvasContext.restore();
  }

  /**
   * 处理尺寸变化
   */
  private handleSizeChange(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;

    if (this.controller) {
      this.controller.setContainerHeight(height);
    }

    if (this.renderer) {
      const newContext: CanvasRenderContext = new CanvasRenderContext(width, height, 1.0);
      this.renderer = new CanvasLyricRenderer(newContext);
      this.renderer.setCanvasContext(this.canvasContext);
    }

    this.needsRedraw = true;
  }

  build() {
    Stack() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .backgroundColor('#000000')
        .onReady(() => {
          if (this.renderer) {
            this.renderer.setCanvasContext(this.canvasContext);
          }
          this.needsRedraw = true;
        })
        .onAreaChange((_oldArea: Area, newArea: Area) => {
          const width: number = newArea.width as number;
          const height: number = newArea.height as number;
          this.handleSizeChange(width, height);
        })
    }
    .width('100%')
    .height('100%')
  }
}
