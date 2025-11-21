/**
 * Canvas歌词播放器组件
 * 使用Canvas渲染，使用Animator API进行动画
 * 严格符合ArkTS规范，完整实现所有特效
 */

import { AnimatorResult } from '@kit.ArkUI';
import {
  LyricLine,
  LyricPlayerConfig,
  LyricLineRenderState,
  InterludeState,
  CanvasRenderContext,
  RendererConfig
} from '../models/LyricModels';
import { LyricPlayerController } from '../core/LyricPlayerController';
import { CanvasLyricRenderer } from '../canvas/CanvasLyricRenderer';

/**
 * Canvas歌词播放器组件
 */
@Component
export struct CanvasLyricPlayerComponent {
  /** Canvas渲染设置 */
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  /** Canvas 2D上下文 */
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  /** Canvas宽度 */
  private canvasWidth: number = 0;
  /** Canvas高度 */
  private canvasHeight: number = 0;

  /** 播放器控制器 */
  private controller: LyricPlayerController | null = null;
  /** Canvas渲染器 */
  private renderer: CanvasLyricRenderer | null = null;
  /** 动画器 */
  private animator: AnimatorResult | null = null;
  /** 当前播放时间 */
  private currentPlayTime: number = 0;

  /** 播放器配置 */
  public playerConfig: LyricPlayerConfig = LyricPlayerConfig.create();

  /**
   * 组件即将出现
   */
  aboutToAppear(): void {
    // 创建控制器
    this.controller = new LyricPlayerController(this.playerConfig);

    // 创建渲染器
    const renderContext: CanvasRenderContext = new CanvasRenderContext(
      this.canvasWidth,
      this.canvasHeight,
      1.0
    );
    this.renderer = new CanvasLyricRenderer(renderContext);
    this.renderer.setCanvasContext(this.canvasContext);
  }

  /**
   * 组件即将消失
   */
  aboutToDisappear(): void {
    this.stopAnimator();
  }

  /**
   * 设置歌词数据
   * @param lines 歌词行数组
   */
  public setLyricLines(lines: LyricLine[]): void {
    if (this.controller) {
      this.controller.setLyricLines(lines);
      this.drawFrame();
    }
  }

  /**
   * 设置当前播放时间
   * @param timeMs 时间（毫秒）
   */
  public setCurrentTime(timeMs: number): void {
    this.currentPlayTime = timeMs;
    if (this.controller) {
      const oldLineIndex: number = this.controller.getCurrentLineIndex();
      this.controller.setCurrentTime(timeMs);
      const newLineIndex: number = this.controller.getCurrentLineIndex();

      // 如果行切换，启动滚动动画
      if (oldLineIndex !== newLineIndex && newLineIndex !== -1) {
        this.startScrollAnimator();
      } else {
        // 否则直接绘制
        this.drawFrame();
      }
    }
  }

  /**
   * 启动滚动动画
   */
  private startScrollAnimator(): void {
    if (!this.controller) {
      return;
    }

    const scrollOffset: number = this.controller.getScrollOffset();

    // 停止之前的动画
    if (this.animator) {
      this.animator.finish();
    }

    // 创建新的动画器
    this.animator = this.getUIContext().createAnimator({
      duration: 400, // 动画时长400ms
      easing: 'linear', // 线性缓动
      delay: 0,
      fill: 'forwards',
      direction: 'normal',
      iterations: 1,
      begin: 0,
      end: 1
    });

    // 设置帧回调
    this.animator.onFrame = (progress: number) => {
      if (this.controller) {
        // 更新控制器（弹簧动画会在update中计算）
        this.controller.update(16.67); // 假设60fps
        this.drawFrame();
      }
    };

    // 设置完成回调
    this.animator.onFinish = () => {
      // 动画完成，绘制最终状态
      this.drawFrame();
    };

    // 播放动画
    this.animator.play();
  }

  /**
   * 停止动画器
   */
  private stopAnimator(): void {
    if (this.animator) {
      this.animator.finish();
      this.animator = null;
    }
  }

  /**
   * 绘制帧
   */
  private drawFrame(): void {
    if (!this.renderer || !this.controller) {
      return;
    }

    // 清空画布
    this.renderer.clear();

    // 获取状态
    const lineStates: LyricLineRenderState[] = this.controller.getLineStates();
    const scrollOffset: number = this.controller.getScrollOffset();
    const config: LyricPlayerConfig = this.controller.getConfig();

    // 创建渲染器配置
    const rendererConfig: RendererConfig = RendererConfig.fromPlayerConfig(config);

    // 保存画布状态
    this.canvasContext.save();

    // 应用滚动偏移
    this.canvasContext.translate(0, -scrollOffset);

    // 渲染每一行歌词
    lineStates.forEach((state: LyricLineRenderState) => {
      if (state.isInView) {
        this.renderer!.renderLine(state, this.currentPlayTime, rendererConfig);
      }
    });

    // 渲染间奏动画
    const interludeState: InterludeState = this.controller.getInterludeState();
    if (interludeState.visible) {
      this.renderer!.renderInterlude(
        interludeState.positionY,
        interludeState.dotOpacities,
        interludeState.dotScales
      );
    }

    // 恢复画布状态
    this.canvasContext.restore();
  }

  /**
   * 处理尺寸变化
   * @param width 新宽度
   * @param height 新高度
   */
  private handleSizeChange(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;

    // 更新控制器容器高度
    if (this.controller) {
      this.controller.setContainerHeight(height);
    }

    // 重新创建渲染器
    if (this.renderer) {
      const newContext: CanvasRenderContext = new CanvasRenderContext(width, height, 1.0);
      this.renderer = new CanvasLyricRenderer(newContext);
      this.renderer.setCanvasContext(this.canvasContext);
    }

    // 重绘
    this.drawFrame();
  }

  build() {
    Stack() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .backgroundColor('#000000')
        .onReady(() => {
          // Canvas准备就绪
          if (this.renderer) {
            this.renderer.setCanvasContext(this.canvasContext);
          }
          this.drawFrame();
        })
        .onAreaChange((_oldArea: Area, newArea: Area) => {
          // 尺寸变化
          const width: number = newArea.width as number;
          const height: number = newArea.height as number;
          this.handleSizeChange(width, height);
        })
    }
    .width('100%')
    .height('100%')
  }
}
