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
    // 更新滚动动画
    if (this.config.enableSpring) {
      this.scrollAnimator.update(deltaTimeMs / 1000.0);
      this.scrollOffset = this.scrollAnimator.getPosition();
    }

    // 🚫 暂时屏蔽间奏动画（调试用）
    // this.interludeAnimator.update(this.currentTime);

    // 🚫 暂时屏蔽逐行波动动画（调试用）
    // this.updateWaveAnimation(deltaTimeMs / 1000.0);
  }

  /**
   * 初始化行状态
   */
  private initializeLineStates(): void {
    this.lineStates = [];
    this.lines.forEach((line: LyricLine, index: number) => {
      const state: LyricLineRenderState = new LyricLineRenderState(line, index);
      this.lineStates.push(state);
    });
  }

  /**
   * 更新当前播放行
   */
  private updateCurrentLine(): void {
    let newIndex: number = -1;

    for (let i: number = 0; i < this.lines.length; i++) {
      const line: LyricLine = this.lines[i];
      if (this.currentTime >= line.startTime && this.currentTime < line.endTime) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== this.currentLineIndex) {
      const oldIndex: number = this.currentLineIndex;
      this.currentLineIndex = newIndex;

      // 📊 日志输出：当前行切换
      if (newIndex !== -1) {
        const currentLine = this.lines[newIndex];
        const lyrics = currentLine.words.map(w => w.word).join('');
        console.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.info(`[行切换] ${oldIndex} → ${newIndex} | 当前播放: "${lyrics}"`);
        console.info(`[时间] ${this.currentTime}ms | 行范围: ${currentLine.startTime}-${currentLine.endTime}ms`);
        console.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      }

      this.updateScrollTarget();

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
      if (this.config.enableScale) {
        state.scaleRatio = state.isActive ? 1.0 : 0.97;
      } else {
        state.scaleRatio = 1.0;
      }

      // ========== 透明度效果 ==========
      if (state.isActive) {
        state.alphaValue = 1.0;
      } else if (this.config.hidePassed && index < this.currentLineIndex) {
        state.alphaValue = 0;
      } else {
        state.alphaValue = Math.max(0.2, 1.0 - distance * 0.15);
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

      // ========== 已播放歌词的抬升效果 ==========
      // 🎵 参考 Apple Music：已播放的歌词会略微向上移动
      // 创造一种"被当前歌词推开"的视觉效果
      if (index < this.currentLineIndex) {
        // 已播放的歌词向上偏移
        // 距离当前行越远，偏移越小（最近的偏移最大）
        const passedDistance: number = this.currentLineIndex - index;
        // 🔧 调试：增大偏移值以便视觉验证
        const maxOffset: number = -60;  // 调试用：最大向上偏移60px（原值12px）
        const minOffset: number = -20;  // 调试用：最小向上偏移20px（原值3px）
        // 使用指数衰减：最近的行偏移最大，远处的行逐渐减小
        state.yOffset = maxOffset * Math.exp(-passedDistance * 0.5) + minOffset;

        // 📊 日志输出：已播放歌词的抬升效果
        console.info(`[抬升] 行${index} "${line.words.map(w => w.word).join('')}" ` +
          `passedDistance=${passedDistance} yOffset=${state.yOffset.toFixed(2)}px`);
      } else {
        // 当前行和未播放的歌词：无偏移
        state.yOffset = 0;

        // 📊 日志输出：当前行和未播放行
        if (state.isActive) {
          console.info(`[当前行] 行${index} "${line.words.map(w => w.word).join('')}" yOffset=0px (正在播放)`);
        }
      }

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
   * 🎵 当两行歌词之间的间隔超过4秒时，显示间奏动画（三个跳动的小白点）
   */
  private updateInterludeState(): void {
    // 没有当前行，隐藏间奏
    if (this.currentLineIndex < 0 || this.currentLineIndex >= this.lines.length) {
      if (this.interludeState.visible) {
        this.interludeState.visible = false;
        this.interludeAnimator.reset();
      }
      return;
    }

    const currentLine: LyricLine = this.lines[this.currentLineIndex];
    const nextLine: LyricLine | undefined =
      this.currentLineIndex + 1 < this.lines.length ? this.lines[this.currentLineIndex + 1] : undefined;

    // 检查是否在两行之间的间隙中
    if (nextLine && this.currentTime >= currentLine.endTime && this.currentTime < nextLine.startTime) {
      // 计算间隙时长
      const gap: number = nextLine.startTime - currentLine.endTime;

      // 间隙超过4秒，显示间奏动画
      if (gap >= 4000) {
        // 首次进入间奏状态，设置间奏时间范围
        if (!this.interludeState.visible) {
          this.interludeState.visible = true;
          this.interludeAnimator.setInterlude(
            currentLine.endTime,
            nextLine.startTime,
            this.currentTime
          );
        }

        this.interludeState.prevLineIndex = this.currentLineIndex;
        this.interludeState.nextLineIndex = this.currentLineIndex + 1;

        // 计算间奏动画的Y坐标（当前行下方）
        let posY: number = 0;
        for (let i: number = 0; i <= this.currentLineIndex; i++) {
          posY += this.getLineHeight(i);
        }
        // 将间奏放在两行的中间位置
        posY += this.getLineHeight(this.currentLineIndex) / 2;
        this.interludeState.positionY = posY;
      } else {
        // 间隙小于4秒，隐藏间奏
        if (this.interludeState.visible) {
          this.interludeState.visible = false;
          this.interludeAnimator.reset();
        }
      }
    } else {
      // 不在间隙中，隐藏间奏
      if (this.interludeState.visible) {
        this.interludeState.visible = false;
        this.interludeAnimator.reset();
      }
    }
  }

  /**
   * 获取行高度
   */
  private getLineHeight(index: number): number {
    let height: number = 60;

    const state: LyricLineRenderState = this.lineStates[index];
    if (state) {
      if (this.config.showTranslation && state.line.translatedLyric) {
        height += 20;
      }
      if (this.config.showRoman && state.line.romanLyric) {
        height += 16;
      }
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
