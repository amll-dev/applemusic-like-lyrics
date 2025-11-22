/**
 * 歌词播放器控制器
 * 核心业务逻辑，管理歌词状态和动画
 */

import { LyricLine, LyricLineRenderState, LyricPlayerConfig, InterludeState, CanvasRenderContext } from '../models/LyricModels';
import { SpringAnimator, SpringAnimatorConfig } from '../utils/SpringAnimator';
import { InterludeAnimator } from '../utils/InterludeAnimator';
import { processLyricLines, calculateBlurRadius } from '../utils/LyricUtils';

export class LyricPlayerController {
  private lines: LyricLine[] = [];
  private lineStates: LyricLineRenderState[] = [];
  private currentLineIndex: number = -1;
  private currentTime: number = 0;
  private config: LyricPlayerConfig;

  private scrollAnimator: SpringAnimator;
  private scrollOffset: number = 0;
  private containerHeight: number = 0;

  private interludeState: InterludeState;
  private interludeAnimator: InterludeAnimator;

  // 🎵 行级弹簧动画：缩放和透明度
  private scaleAnimators: SpringAnimator[] = [];
  private alphaAnimators: SpringAnimator[] = [];

  constructor(config: LyricPlayerConfig) {
    this.config = config;

    const springConfig: SpringAnimatorConfig = new SpringAnimatorConfig(1.0, 100.0, 20.0);
    this.scrollAnimator = new SpringAnimator(springConfig);

    this.interludeState = new InterludeState();
    this.interludeAnimator = new InterludeAnimator(this.interludeState);
  }

  /**
   * 设置歌词数据
   */
  setLyricLines(lines: LyricLine[]): void {
    this.lines = processLyricLines(lines);
    this.initializeLineStates();
    this.updateLayout();
  }

  /**
   * 设置当前播放时间
   */
  setCurrentTime(timeMs: number): void {
    this.currentTime = timeMs;
    this.updateCurrentLine();
    this.updateLineStates();
    this.updateInterludeState();
  }

  /**
   * 更新容器高度
   */
  setContainerHeight(height: number): void {
    this.containerHeight = height;
    this.updateScrollTarget();
  }

  /**
   * 帧更新
   * @param deltaTimeMs 距离上一帧的时间（毫秒）
   */
  update(deltaTimeMs: number): void {
    const deltaSec: number = deltaTimeMs / 1000.0;

    // 更新滚动动画
    if (this.config.enableSpring) {
      this.scrollAnimator.update(deltaSec);
      this.scrollOffset = this.scrollAnimator.getPosition();
    }

    // 🎵 更新行级弹簧动画（缩放和透明度）
    this.updateLineSpringAnimations(deltaSec);

    // 🎵 更新间奏动画
    this.interludeAnimator.update(this.currentTime);

    // 🚫 暂时屏蔽逐行波动动画（调试用）
    // this.updateWaveAnimation(deltaSec);
  }

  /**
   * 更新行级弹簧动画
   * @param deltaSec 时间增量（秒）
   */
  private updateLineSpringAnimations(deltaSec: number): void {
    for (let i: number = 0; i < this.lineStates.length; i++) {
      const state: LyricLineRenderState = this.lineStates[i];

      // 更新缩放弹簧动画
      if (i < this.scaleAnimators.length) {
        this.scaleAnimators[i].update(deltaSec);
        state.scaleRatio = this.scaleAnimators[i].getPosition();
      }

      // 更新透明度弹簧动画
      if (i < this.alphaAnimators.length) {
        this.alphaAnimators[i].update(deltaSec);
        state.alphaValue = this.alphaAnimators[i].getPosition();
      }
    }
  }

  /**
   * 初始化行状态
   */
  private initializeLineStates(): void {
    this.lineStates = [];
    this.scaleAnimators = [];
    this.alphaAnimators = [];

    // 🎵 弹簧参数（参考原版 base.ts）
    // 缩放弹簧：mass=2, damping=25, stiffness=100
    const scaleSpringConfig: SpringAnimatorConfig = new SpringAnimatorConfig(2.0, 100.0, 25.0);
    // 透明度弹簧：略快一些
    const alphaSpringConfig: SpringAnimatorConfig = new SpringAnimatorConfig(1.0, 120.0, 20.0);

    this.lines.forEach((line: LyricLine, index: number) => {
      const state: LyricLineRenderState = new LyricLineRenderState(line, index);
      this.lineStates.push(state);

      // 为每行创建弹簧动画器
      const scaleAnimator: SpringAnimator = new SpringAnimator(scaleSpringConfig);
      scaleAnimator.setCurrent(0.97); // 初始缩放 97%（以百分比表示，0.97 = 97%）
      this.scaleAnimators.push(scaleAnimator);

      const alphaAnimator: SpringAnimator = new SpringAnimator(alphaSpringConfig);
      alphaAnimator.setCurrent(0.2); // 初始透明度 20%
      this.alphaAnimators.push(alphaAnimator);
    });
  }

  /**
   * 更新当前播放行
   * 注意：跳过空白歌词行（间奏），保持 currentLineIndex 在有效歌词行上
   */
  private updateCurrentLine(): void {
    let newIndex: number = -1;

    for (let i: number = 0; i < this.lines.length; i++) {
      const line: LyricLine = this.lines[i];
      if (this.currentTime >= line.startTime && this.currentTime < line.endTime) {
        // 跳过空白歌词行（间奏），保持上一个有效行的索引
        if (line.words.length === 0) {
          // 间奏行：不更新 currentLineIndex，保持在上一个有效行
          return;
        }
        newIndex = i;
        break;
      }
    }

    // 如果没找到当前行，尝试找到最后一个已播放完的有效行
    if (newIndex === -1) {
      for (let i: number = this.lines.length - 1; i >= 0; i--) {
        const line: LyricLine = this.lines[i];
        if (line.words.length > 0 && this.currentTime >= line.endTime) {
          newIndex = i;
          break;
        }
      }
    }

    if (newIndex !== this.currentLineIndex && newIndex !== -1) {
      const oldIndex: number = this.currentLineIndex;
      this.currentLineIndex = newIndex;
      this.updateScrollTarget();

      // 📊 过渡效果日志：歌词行切换时输出
      const newLine: LyricLine = this.lines[newIndex];
      const lineText: string = newLine.words.map(w => w.word).join('').substring(0, 15);
      console.info(`[过渡] 行切换 ${oldIndex} → ${newIndex} "${lineText}..." | ` +
        `scale: 0.97 → 1.0 | alpha: 变亮`);

      // 🚫 暂时屏蔽波动动画（调试用）
      // if (newIndex !== -1) {
      //   this.triggerWaveAnimation(newIndex, oldIndex);
      // }
    }
  }

  /**
   * 更新滚动目标
   */
  private updateScrollTarget(): void {
    if (this.currentLineIndex < 0 || this.containerHeight === 0) {
      return;
    }

    let targetOffset: number = 0;
    for (let i = 0; i < this.currentLineIndex; i++) {
      targetOffset += this.getLineHeight(i);
    }

    const alignOffset: number = this.containerHeight * this.config.alignPosition;
    targetOffset -= alignOffset;

    if (this.config.enableSpring) {
      this.scrollAnimator.setTarget(targetOffset);
    } else {
      this.scrollOffset = targetOffset;
    }
  }

  /**
   * 更新行状态
   * 包括：透明度、缩放、模糊、Y轴偏移等
   */
  private updateLineStates(): void {
    this.lineStates.forEach((state: LyricLineRenderState, index: number) => {
      const line: LyricLine = state.line;

      state.isActive = this.currentTime >= line.startTime && this.currentTime < line.endTime;

      const distance: number = Math.abs(index - this.currentLineIndex);

      // ========== 缩放效果 ==========
      // 🎵 设置目标值，由弹簧动画平滑过渡
      let targetScale: number = 1.0;
      if (this.config.enableScale) {
        targetScale = state.isActive ? 1.0 : 0.97;
      }
      // 设置弹簧动画目标值（实际值在 update 中更新）
      if (index < this.scaleAnimators.length) {
        this.scaleAnimators[index].setTarget(targetScale);
      }

      // ========== 透明度效果 ==========
      // 🎵 设置目标值，由弹簧动画平滑过渡
      let targetAlpha: number = 0.2;
      if (state.isActive) {
        targetAlpha = 1.0;
      } else if (this.config.hidePassed && index < this.currentLineIndex) {
        targetAlpha = 0;
      } else {
        targetAlpha = Math.max(0.2, 1.0 - distance * 0.15);
      }
      // 设置弹簧动画目标值（实际值在 update 中更新）
      if (index < this.alphaAnimators.length) {
        this.alphaAnimators[index].setTarget(targetAlpha);
      }

      // ========== 模糊效果 ==========
      // 🎵 参考原版 base.ts calcLayout 的模糊计算逻辑
      let blurLevel: number = 0;
      if (this.config.enableBlur) {
        if (state.isActive) {
          // 激活行：不模糊
          blurLevel = 0;
        } else {
          // 非激活行：基础模糊值为1
          blurLevel = 1;
          if (index < this.currentLineIndex) {
            // 已播放的歌词：距离越远，模糊越大
            blurLevel += Math.abs(this.currentLineIndex - index) + 1;
          } else {
            // 未播放的歌词：距离越远，模糊越大
            blurLevel += Math.abs(index - this.currentLineIndex);
          }
        }
      }
      state.blurRadius = blurLevel;

      // 📊 模糊调试日志（暂时禁用 - 模糊效果已禁用）
      // if (oldBlurRadius !== blurLevel && state.line.words.length > 0) {
      //   const lineText: string = state.line.words.map(w => w.word).join('').substring(0, 10);
      //   console.info(`[模糊] 行${index} "${lineText}..." | blurLevel: ${oldBlurRadius} → ${blurLevel}`);
      // }

      // ========== 行级 Y 偏移（保留用于未来扩展）==========
      // 注意：逐字抬升效果已移至 CanvasLyricRenderer.renderWord() 中实现
      // 这里的 yOffset 仅用于行级别的偏移（如波动动画等）
      state.yOffset = 0;

      // 🚫 暂时屏蔽波动动画（调试用）
      state.waveOffset = 0;
      state.waveTarget = 0;
      state.waveVelocity = 0;
    });
  }

  /**
   * 更新布局
   */
  private updateLayout(): void {
    let currentY: number = 0;

    this.lineStates.forEach((state: LyricLineRenderState, index: number) => {
      state.positionY = currentY;
      currentY += this.getLineHeight(index);
    });

    // 🎯 视口裁剪：标记可见行（性能优化）
    this.updateViewportVisibility();
  }

  /**
   * 更新视口可见性（性能优化）
   * 只渲染视口内+overscan的行
   */
  private updateViewportVisibility(): void {
    const overscan: number = 300; // 预渲染区域（像素）
    const viewportTop: number = this.scrollOffset - overscan;
    const viewportBottom: number = this.scrollOffset + this.containerHeight + overscan;

    this.lineStates.forEach((state: LyricLineRenderState) => {
      const lineTop: number = state.positionY + state.yOffset + state.waveOffset;
      const lineBottom: number = lineTop + this.getLineHeight(state.index);

      // 行是否在视口内（包括overscan）
      state.isInView = !(lineBottom < viewportTop || lineTop > viewportBottom);
    });
  }

  /**
   * 更新间奏状态
   * 🎵 使用空白歌词行（words.length === 0）来表示间奏
   * 当播放到空白行时，显示间奏动画（三个跳动的小白点）
   */
  private updateInterludeState(): void {
    // 查找当前正在播放的空白歌词行
    let interludeLineIndex: number = -1;

    for (let i: number = 0; i < this.lines.length; i++) {
      const line: LyricLine = this.lines[i];

      // 检查当前时间是否在这行的时间范围内
      if (this.currentTime >= line.startTime && this.currentTime < line.endTime) {
        // 如果是空白歌词行，则为间奏
        if (line.words.length === 0) {
          interludeLineIndex = i;
        }
        break;
      }
    }

    if (interludeLineIndex >= 0) {
      // 当前正在播放空白行（间奏）
      const interludeLine: LyricLine = this.lines[interludeLineIndex];
      const duration: number = interludeLine.endTime - interludeLine.startTime;

      if (!this.interludeState.visible) {
        console.info(`[间奏] 🎵 间奏开始 | 行${interludeLineIndex}`);
        console.info(`[间奏]    时间范围: ${interludeLine.startTime} → ${interludeLine.endTime}ms (${duration}ms)`);
        this.interludeState.visible = true;
        this.interludeAnimator.setInterlude(
          interludeLine.startTime,
          interludeLine.endTime,
          this.currentTime
        );
      }

      this.interludeState.prevLineIndex = interludeLineIndex - 1;
      this.interludeState.nextLineIndex = interludeLineIndex + 1;

      // 计算间奏动画的Y坐标（紧贴上一行歌词）
      let posY: number = 0;
      for (let i: number = 0; i < interludeLineIndex; i++) {
        posY += this.getLineHeight(i);
      }
      this.interludeState.positionY = posY;
    } else {
      // 不在间奏中
      if (this.interludeState.visible) {
        console.info(`[间奏] 隐藏：不在间奏行`);
        this.interludeState.visible = false;
        this.interludeAnimator.reset();
      }
    }
  }

  /**
   * 获取行高度
   */
  private getLineHeight(index: number): number {
    const state: LyricLineRenderState = this.lineStates[index];
    if (!state) {
      return 0;
    }

    // 🎵 空白歌词行（间奏）有固定高度，用于放置间奏动画
    if (state.line.words.length === 0) {
      return 30; // 间奏行高度
    }

    let height: number = 60;

    if (this.config.showTranslation && state.line.translatedLyric) {
      height += 20;
    }
    if (this.config.showRoman && state.line.romanLyric) {
      height += 16;
    }

    return height;
  }

  /**
   * 触发逐行波动动画
   * 🎵 创造"被拉起"的连锁反应效果
   * @param currentIndex 当前激活的行索引
   * @param previousIndex 之前激活的行索引
   */
  private triggerWaveAnimation(currentIndex: number, previousIndex: number): void {
    if (currentIndex < 0 || currentIndex >= this.lineStates.length) {
      return;
    }

    // 🌊 波动参数（参考原版 base.ts calcLayout）
    const waveAmplitude: number = -15;  // 向上偏移15px
    const baseDelay: number = 0.05;  // 基础延迟（秒），参考原版

    // 从当前行开始，逐行传播波动
    let delay: number = 0;
    let decayingDelay: number = baseDelay;

    this.lineStates.forEach((state: LyricLineRenderState, index: number) => {
      // 计算距离当前行的距离
      const distance: number = Math.abs(index - currentIndex);

      // 🎯 参考原版逻辑：
      // - delay 从当前行开始累加
      // - 越靠后的行延迟越大
      // - 延迟递减（baseDelay /= 1.05）创造优雅的衰减效果
      if (index >= currentIndex) {
        // 当前行及之后的行
        const attenuation: number = Math.exp(-distance * 0.3);  // 指数衰减
        const targetOffset: number = waveAmplitude * attenuation;

        if (distance === 0) {
          // 当前行：立即触发
          state.waveTarget = targetOffset;
          state.waveVelocity = 0;
          state.waveDelay = 0;
          state.queuedWaveTarget = 0;
        } else if (distance <= 8) {
          // 附近的行：使用延迟队列
          delay += decayingDelay;
          decayingDelay /= 1.05;  // 逐渐减小延迟（原版逻辑）

          state.queuedWaveTarget = targetOffset;
          state.waveDelay = delay;
        }
      }
    });
  }

  /**
   * 更新波动动画
   * 🎵 使用弹簧物理模拟，创造带回弹的优雅效果
   * @param deltaTimeSec 距离上一帧的时间（秒）
   */
  private updateWaveAnimation(deltaTimeSec: number): void {
    // 弹簧参数
    const stiffness: number = 200.0;  // 刚度：越大回弹越快
    const damping: number = 18.0;     // 阻尼：越大震荡越小
    const threshold: number = 0.01;   // 停止阈值

    this.lineStates.forEach((state: LyricLineRenderState) => {
      // 🕐 处理延迟队列（参考原版 Spring.update）
      if (state.waveDelay > 0) {
        state.waveDelay -= deltaTimeSec;
        if (state.waveDelay <= 0) {
          // 延迟时间到，应用队列中的目标值
          state.waveTarget = state.queuedWaveTarget;
          state.waveVelocity = 0;  // 重置速度
          state.waveDelay = 0;
          state.queuedWaveTarget = 0;
        }
      }

      // 计算弹簧力
      const displacement: number = state.waveOffset - state.waveTarget;
      const springForce: number = -stiffness * displacement;
      const dampingForce: number = -damping * state.waveVelocity;
      const totalForce: number = springForce + dampingForce;

      // 更新速度和位置（使用半隐式欧拉方法，更稳定）
      state.waveVelocity += totalForce * deltaTimeSec;
      state.waveOffset += state.waveVelocity * deltaTimeSec;

      // 当接近目标且速度很小时，直接设置为目标值（避免无限振荡）
      if (Math.abs(displacement) < threshold && Math.abs(state.waveVelocity) < threshold) {
        state.waveOffset = state.waveTarget;
        state.waveVelocity = 0;

        // 如果已经回到静止状态，将目标重置为0
        if (state.waveTarget !== 0 && Math.abs(state.waveOffset) < threshold) {
          state.waveTarget = 0;
        }
      }
    });
  }

  /**
   * Getters
   */
  getLineStates(): LyricLineRenderState[] {
    return this.lineStates;
  }

  getScrollOffset(): number {
    return this.scrollOffset;
  }

  getInterludeState(): InterludeState {
    return this.interludeState;
  }

  getCurrentLineIndex(): number {
    return this.currentLineIndex;
  }

  getConfig(): LyricPlayerConfig {
    return this.config;
  }
}
