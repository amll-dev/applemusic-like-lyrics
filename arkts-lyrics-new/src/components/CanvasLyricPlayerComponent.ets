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
  /** 动画器 */
  private animator: AnimatorResult | null = null;

  // ============================================================
  // 生命周期方法
  // ============================================================

  /**
   * 组件即将出现
   */
  aboutToAppear(): void {
    console.info('[LyricPlayer] ========================================');
    console.info('[LyricPlayer] 🎬 aboutToAppear START');
    console.info('[LyricPlayer] ========================================');
    console.info('[LyricPlayer] 📊 Initial State:');
    console.info('[LyricPlayer]   - Lyrics count:', this.lyricLines.length);
    console.info('[LyricPlayer]   - Current time:', this.currentTime);
    console.info('[LyricPlayer]   - Canvas size:', this.canvasWidth, 'x', this.canvasHeight);
    console.info('[LyricPlayer]   - Canvas context:', this.canvasContext ? 'EXISTS' : 'NULL');

    // 创建控制器
    console.info('[LyricPlayer] 🔧 Creating controller...');
    this.controller = new LyricPlayerController(this.playerConfig);
    console.info('[LyricPlayer] ✓ Controller created:', this.controller ? 'SUCCESS' : 'FAILED');

    // 创建渲染器
    console.info('[LyricPlayer] 🔧 Creating renderer...');
    const renderContext: CanvasRenderContext = new CanvasRenderContext(
      this.canvasWidth,
      this.canvasHeight,
      1.0
    );
    this.renderer = new CanvasLyricRenderer(renderContext);
    this.renderer.setCanvasContext(this.canvasContext);
    console.info('[LyricPlayer] ✓ Renderer created:', this.renderer ? 'SUCCESS' : 'FAILED');

    // 🔥 关键：如果初始化时就有歌词数据，设置进控制器
    if (this.controller && this.lyricLines.length > 0) {
      console.info('[LyricPlayer] 🎵 Setting initial lyrics...');
      this.controller.setLyricLines(this.lyricLines);
      console.info('[LyricPlayer] ✓ Lyrics set to controller');
    } else {
      console.warn('[LyricPlayer] ⚠️ No lyrics to set (count:', this.lyricLines.length, ')');
    }

    // 设置初始播放时间
    if (this.controller && this.currentTime > 0) {
      console.info('[LyricPlayer] ⏱️ Setting initial time:', this.currentTime);
      this.controller.setCurrentTime(this.currentTime);
      console.info('[LyricPlayer] ✓ Initial time set');
    }

    console.info('[LyricPlayer] ========================================');
    console.info('[LyricPlayer] 🎬 aboutToAppear END');
    console.info('[LyricPlayer] ========================================');
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
    console.info('[LyricPlayer] 👋 aboutToDisappear');
    this.stopAnimator();
  }

  // ============================================================
  // @Watch 回调方法
  // ============================================================

  /**
   * 歌词数据变化时调用
   * 🔥 通过 @Watch('onLyricLinesChanged') 自动触发
   */
  onLyricLinesChanged(): void {
    console.info('[LyricPlayer] ========================================');
    console.info('[LyricPlayer] 🔄 onLyricLinesChanged() TRIGGERED');
    console.info('[LyricPlayer]   - New lyrics count:', this.lyricLines.length);
    console.info('[LyricPlayer] ========================================');

    if (!this.controller) {
      console.warn('[LyricPlayer] ⚠️ Controller not initialized yet');
      return;
    }

    if (this.lyricLines.length === 0) {
      console.warn('[LyricPlayer] ⚠️ Lyrics array is empty');
      return;
    }

    // 重新设置歌词数据到控制器
    console.info('[LyricPlayer] 📝 Setting new lyrics to controller...');
    this.controller.setLyricLines(this.lyricLines);
    console.info('[LyricPlayer] ✓ Lyrics set successfully');

    // 立即重绘
    console.info('[LyricPlayer] 🎨 Calling drawFrame after lyrics change...');
    this.drawFrame();
    console.info('[LyricPlayer] ========================================');
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

    // 如果行切换，启动滚动动画
    if (oldLineIndex !== newLineIndex && newLineIndex !== -1) {
      this.startScrollAnimator();
    } else {
      // 否则直接绘制
      this.drawFrame();
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

  // ============================================================
  // 渲染方法
  // ============================================================

  /**
   * 绘制帧
   */
  private drawFrame(): void {
    console.info('[LyricPlayer] ----------------------------------------');
    console.info('[LyricPlayer] 🎨 drawFrame() CALLED');
    console.info('[LyricPlayer] ----------------------------------------');

    // 检查渲染器和控制器
    console.info('[LyricPlayer] 🔍 Checking components:');
    console.info('[LyricPlayer]   - renderer:', this.renderer ? 'EXISTS' : 'NULL');
    console.info('[LyricPlayer]   - controller:', this.controller ? 'EXISTS' : 'NULL');
    console.info('[LyricPlayer]   - canvasContext:', this.canvasContext ? 'EXISTS' : 'NULL');
    console.info('[LyricPlayer]   - canvasWidth:', this.canvasWidth);
    console.info('[LyricPlayer]   - canvasHeight:', this.canvasHeight);

    if (!this.renderer || !this.controller) {
      console.error('[LyricPlayer] ❌ Cannot draw: renderer or controller is null!');
      return;
    }

    // 清空画布
    console.info('[LyricPlayer] 🧹 Clearing canvas...');
    this.renderer.clear();
    console.info('[LyricPlayer] ✓ Canvas cleared');

    // 获取状态
    console.info('[LyricPlayer] 📊 Getting render states...');
    const lineStates: LyricLineRenderState[] = this.controller.getLineStates();
    const scrollOffset: number = this.controller.getScrollOffset();
    const config: LyricPlayerConfig = this.controller.getConfig();
    console.info('[LyricPlayer]   - Line states count:', lineStates.length);
    console.info('[LyricPlayer]   - Scroll offset:', scrollOffset);

    // 创建渲染器配置
    const rendererConfig: RendererConfig = RendererConfig.fromPlayerConfig(config);

    // 保存画布状态
    this.canvasContext.save();

    // 应用滚动偏移
    this.canvasContext.translate(0, -scrollOffset);

    // 渲染每一行歌词
    console.info('[LyricPlayer] 🖊️ Rendering lyric lines...');
    let renderedCount = 0;
    lineStates.forEach((state: LyricLineRenderState, index: number) => {
      if (state.isInView) {
        console.info('[LyricPlayer]   - Rendering line', index, ':', state.line.words.map(w => w.word).join(''));
        // 🔥 使用 @Prop currentTime 而不是 private currentPlayTime
        this.renderer!.renderLine(state, this.currentTime, rendererConfig);
        renderedCount++;
      }
    });
    console.info('[LyricPlayer] ✓ Rendered', renderedCount, 'lines');

    // 渲染间奏动画
    const interludeState: InterludeState = this.controller.getInterludeState();
    if (interludeState.visible) {
      console.info('[LyricPlayer] 🎵 Rendering interlude animation');
      this.renderer!.renderInterlude(
        interludeState.positionY,
        interludeState.dotOpacities,
        interludeState.dotScales
      );
    }

    // 恢复画布状态
    this.canvasContext.restore();

    console.info('[LyricPlayer] ✅ drawFrame() COMPLETE');
    console.info('[LyricPlayer] ----------------------------------------');
  }

  /**
   * 处理尺寸变化
   * @param width 新宽度
   * @param height 新高度
   */
  private handleSizeChange(width: number, height: number): void {
    console.info('[LyricPlayer] 📏 Size changed:', width, 'x', height);

    this.canvasWidth = width;
    this.canvasHeight = height;

    // 更新控制器容器高度
    if (this.controller) {
      this.controller.setContainerHeight(height);
      console.info('[LyricPlayer] ✓ Controller height updated');
    }

    // 重新创建渲染器
    if (this.renderer) {
      const newContext: CanvasRenderContext = new CanvasRenderContext(width, height, 1.0);
      this.renderer = new CanvasLyricRenderer(newContext);
      this.renderer.setCanvasContext(this.canvasContext);
      console.info('[LyricPlayer] ✓ Renderer recreated');
    }

    // 🔥 关键：如果有歌词数据，确保已设置到控制器
    // 这解决了首次渲染黑屏的问题
    if (this.controller && this.lyricLines.length > 0) {
      console.info('[LyricPlayer] 🔄 Re-setting lyrics after size change');
      this.controller.setLyricLines(this.lyricLines);
    }

    // 🔥 关键：立即绘制一次（参考华为官方做法）
    // 确保在获得有效尺寸后立即显示内容
    console.info('[LyricPlayer] 🎨 Drawing initial frame after size change...');
    this.drawFrame();
  }

  build() {
    Stack() {
      Canvas(this.canvasContext)
        .width('100%')
        .height('100%')
        .backgroundColor('#000000')
        .onReady(() => {
          console.info('[LyricPlayer] ========================================');
          console.info('[LyricPlayer] 🎨 Canvas.onReady() TRIGGERED');
          console.info('[LyricPlayer] ========================================');
          console.info('[LyricPlayer] 🔍 Canvas state:');
          console.info('[LyricPlayer]   - canvasContext:', this.canvasContext ? 'EXISTS' : 'NULL');
          console.info('[LyricPlayer]   - renderer:', this.renderer ? 'EXISTS' : 'NULL');
          console.info('[LyricPlayer]   - canvasWidth:', this.canvasWidth);
          console.info('[LyricPlayer]   - canvasHeight:', this.canvasHeight);

          // Canvas准备就绪
          if (this.renderer) {
            console.info('[LyricPlayer] 🔄 Setting canvas context to renderer...');
            this.renderer.setCanvasContext(this.canvasContext);
            console.info('[LyricPlayer] ✓ Canvas context set');
          } else {
            console.warn('[LyricPlayer] ⚠️ Renderer is null, cannot set canvas context');
          }

          console.info('[LyricPlayer] 🎨 Calling drawFrame from onReady...');
          this.drawFrame();
          console.info('[LyricPlayer] ========================================');
        })
        .onAreaChange((_oldArea: Area, newArea: Area) => {
          console.info('[LyricPlayer] ========================================');
          console.info('[LyricPlayer] 📐 Canvas.onAreaChange() TRIGGERED');
          console.info('[LyricPlayer] ========================================');

          // 尺寸变化
          const width: number = newArea.width as number;
          const height: number = newArea.height as number;

          console.info('[LyricPlayer] 📏 Area change details:');
          console.info('[LyricPlayer]   - Old area:', _oldArea.width, 'x', _oldArea.height);
          console.info('[LyricPlayer]   - New area:', width, 'x', height);

          this.handleSizeChange(width, height);
          console.info('[LyricPlayer] ========================================');
        })
    }
    .width('100%')
    .height('100%')
  }
}
