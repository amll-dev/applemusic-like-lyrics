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
 * 🔥 使用 @Prop 模式，符合 ArkTS 声明式 UI 规范
 */
@Component
export struct CanvasLyricPlayerComponent {
  // ============================================================
  // @Prop 属性：从父组件接收数据（只读）
  // ============================================================

  /** 歌词数据 - 从父组件传入，使用 @Watch 监听变化 */
  @Prop @Watch('onLyricLinesChanged') lyricLines: LyricLine[] = [];

  /** 当前播放时间（毫秒）- 使用 @Watch 监听变化 */
  @Prop @Watch('onCurrentTimeChanged') currentTime: number = 0;

  /** 播放器配置 */
  @Prop playerConfig: LyricPlayerConfig = LyricPlayerConfig.create();

  // ============================================================
  // Private 属性：组件内部状态
  // ============================================================

  /** Canvas渲染设置 */
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  /** Canvas 2D上下文 - 必须在声明时初始化，因为 build() 在 aboutToAppear() 之前执行 */
  private canvasContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  /** Canvas宽度 */
  private canvasWidth: number = 0;
  /** Canvas高度 */
  private canvasHeight: number = 0;

  /** 播放器控制器 */
  private controller: LyricPlayerController | null = null;
  /** Canvas渲染器 */
  private renderer: CanvasLyricRenderer | null = null;
  /** 动画器 - 持续运行的渲染循环 */
  private animator: AnimatorResult | null = null;
  /** 上一帧的时间戳（ms） */
  private lastFrameTime: number = 0;
  /** 动画是否正在运行 */
  private isAnimating: boolean = false;

  // ============================================================
  // 生命周期方法
  // ============================================================

  /**
   * 组件即将出现
   */
  aboutToAppear(): void {
    console.info('[LyricPlayer] 🎬 Initialize - Lyrics:', this.lyricLines.length);

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

    // 如果初始化时就有歌词数据，设置进控制器
    if (this.controller && this.lyricLines.length > 0) {
      this.controller.setLyricLines(this.lyricLines);
      console.info('[LyricPlayer] ✓ Initial lyrics loaded:', this.lyricLines.length);
    } else if (this.lyricLines.length === 0) {
      console.warn('[LyricPlayer] ⚠️ No initial lyrics');
    }

    // 设置初始播放时间
    if (this.controller && this.currentTime > 0) {
      this.controller.setCurrentTime(this.currentTime);
    }

    // 🎨 启动持续渲染循环
    this.startRenderLoop();
  }

  /**
   * 组件即将更新
   * 🔥 注意：现在使用 @Watch 装饰器代替 aboutToUpdate
   * @Watch 会在具体的 @Prop 变化时立即触发，更可靠
   * 见 onLyricLinesChanged() 和 onCurrentTimeChanged()
   */
  // aboutToUpdate() 已被 @Watch 装饰器替代

  /**
   * 组件即将消失
   */
  aboutToDisappear(): void {
    this.stopRenderLoop();
  }

  // ============================================================
  // @Watch 回调方法
  // ============================================================

  /**
   * 歌词数据变化时调用
   * 🔥 通过 @Watch('onLyricLinesChanged') 自动触发
   */
  onLyricLinesChanged(): void {
    console.info('[LyricPlayer] 🔄 Lyrics changed:', this.lyricLines.length);

    if (!this.controller) {
      console.warn('[LyricPlayer] ⚠️ Controller not ready');
      return;
    }

    if (this.lyricLines.length === 0) {
      console.warn('[LyricPlayer] ⚠️ Empty lyrics');
      return;
    }

    // 重新设置歌词数据到控制器并重绘
    this.controller.setLyricLines(this.lyricLines);
    this.drawFrame();
  }

  /**
   * 当前时间变化时调用
   * 🔥 通过 @Watch('onCurrentTimeChanged') 自动触发
   */
  onCurrentTimeChanged(): void {
    if (!this.controller) {
      return;
    }

    const oldLineIndex: number = this.controller.getCurrentLineIndex();
    this.controller.setCurrentTime(this.currentTime);
    const newLineIndex: number = this.controller.getCurrentLineIndex();

    // 直接绘制（渲染循环会持续更新）
    this.drawFrame();
  }

  /**
   * 启动持续渲染循环
   * 🎵 使用高帧率（目标120fps）确保流畅的动画效果
   */
  private startRenderLoop(): void {
    if (this.isAnimating) {
      return; // 已经在运行
    }

    this.isAnimating = true;
    this.lastFrameTime = Date.now();

    // 创建持续运行的动画器
    // 🎯 duration设置为一个很大的值，让动画持续运行
    this.animator = this.getUIContext().createAnimator({
      duration: 3600000, // 1小时，确保足够长
      easing: 'linear',
      delay: 0,
      fill: 'forwards',
      direction: 'normal',
      iterations: -1, // 无限循环
      begin: 0,
      end: 1
    });

    // 🎨 帧回调 - 每帧调用
    this.animator.onFrame = (_progress: number) => {
      if (!this.controller) {
        return;
      }

      // 计算实际的帧时间间隔（ms）
      const currentTime: number = Date.now();
      const deltaTimeMs: number = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      // 限制最大间隔，避免标签页切换后的巨大时间跳跃
      const cappedDelta: number = Math.min(deltaTimeMs, 100);

      // 更新控制器状态（弹簧动画、间奏动画等）
      this.controller.update(cappedDelta);

      // 渲染当前帧
      this.drawFrame();
    };

    // 播放动画循环
    this.animator.play();
  }

  /**
   * 停止渲染循环
   */
  private stopRenderLoop(): void {
    this.isAnimating = false;
    if (this.animator) {
      this.animator.finish();
      this.animator = null;
    }
  }

  // ============================================================
  // 渲染方法
  // ============================================================

  /**
   * 绘制帧
   */
  private drawFrame(): void {
    if (!this.renderer || !this.controller) {
      console.error('[LyricPlayer] ❌ Cannot draw: missing renderer/controller');
      return;
    }

    // 清空画布
    this.renderer.clear();

    // 获取状态
    const lineStates: LyricLineRenderState[] = this.controller.getLineStates();
    const scrollOffset: number = this.controller.getScrollOffset();
    const config: LyricPlayerConfig = this.controller.getConfig();
    const rendererConfig: RendererConfig = RendererConfig.fromPlayerConfig(config);

    // 保存画布状态并应用滚动偏移
    this.canvasContext.save();
    this.canvasContext.translate(0, -scrollOffset);

    // 渲染每一行歌词
    let renderedCount = 0;
    lineStates.forEach((state: LyricLineRenderState) => {
      if (state.isInView) {
        this.renderer!.renderLine(state, this.currentTime, rendererConfig);
        renderedCount++;
      }
    });

    // 渲染间奏动画
    const interludeState: InterludeState = this.controller.getInterludeState();
    if (interludeState.visible && interludeState.currentHeight > 0) {
      this.renderer!.renderInterlude(
        interludeState.positionY,
        interludeState.dotOpacities,
        interludeState.dotScales,
        interludeState.currentHeight  // 🎵 传入当前动态高度，用于垂直居中
      );
    }

    // 恢复画布状态
    this.canvasContext.restore();

    // 只在渲染0行时输出警告
    if (renderedCount === 0) {
      console.warn('[LyricPlayer] ⚠️ Rendered 0 lines (total:', lineStates.length, ')');
    }
  }

  /**
   * 处理尺寸变化
   * @param width 新宽度
   * @param height 新高度
   */
  private handleSizeChange(width: number, height: number): void {
    console.info('[LyricPlayer] 📏 Size:', width.toFixed(0), 'x', height.toFixed(0));

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

    // 如果有歌词数据，确保已设置到控制器
    if (this.controller && this.lyricLines.length > 0) {
      this.controller.setLyricLines(this.lyricLines);
    }

    // 立即绘制
    this.drawFrame();
  }

  build() {
    Stack() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .backgroundColor('#000000')
        .onReady(() => {
          // Canvas准备就绪，设置上下文
          if (this.renderer) {
            this.renderer.setCanvasContext(this.canvasContext);
          }
          this.drawFrame();
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
