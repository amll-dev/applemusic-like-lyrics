/**
 * 间奏动画管理器
 * 🎵 实现三个小白点依次跳动的动画效果
 * 不使用 setTimeout，而是基于帧更新的平滑动画
 */

import { InterludeState } from '../models/LyricModels';

/**
 * 单个圆点的动画状态
 */
class DotAnimState {
  /** 当前动画进度 [0, 1] */
  progress: number = 0;
  /** 是否正在动画中 */
  isAnimating: boolean = false;
  /** 动画延迟（ms） */
  delay: number = 0;
  /** 已等待的时间（ms） */
  delayTimer: number = 0;
}

export class InterludeAnimator {
  private state: InterludeState;
  /** 每个圆点的动画状态 */
  private dotStates: DotAnimState[] = [];
  /** 单个圆点的动画时长（ms） */
  private readonly animDuration: number = 500;
  /** 圆点之间的延迟（ms） */
  private readonly delayBetweenDots: number = 150;
  /** 循环间隔（ms） */
  private readonly loopInterval: number = 1500;
  /** 总计时器 */
  private totalTime: number = 0;

  constructor(state: InterludeState) {
    this.state = state;
    // 初始化三个圆点的动画状态
    for (let i: number = 0; i < 3; i++) {
      const dotState: DotAnimState = new DotAnimState();
      dotState.delay = i * this.delayBetweenDots;  // 依次延迟
      this.dotStates.push(dotState);
    }
  }

  /**
   * 更新动画
   * @param deltaTimeMs 距离上一帧的时间（ms）
   */
  update(deltaTimeMs: number): void {
    if (!this.state.visible) {
      this.reset();
      return;
    }

    this.totalTime += deltaTimeMs;

    // 遍历每个圆点，更新其动画状态
    for (let i: number = 0; i < 3; i++) {
      const dotState: DotAnimState = this.dotStates[i];
      const cycleTime: number = this.totalTime % this.loopInterval;

      // 处理延迟
      if (cycleTime < dotState.delay) {
        // 还在等待期，保持初始状态
        dotState.isAnimating = false;
        dotState.progress = 0;
        this.state.dotScales[i] = 1.0;
        this.state.dotOpacities[i] = 0.5;
        continue;
      }

      // 计算动画进度
      const animTime: number = cycleTime - dotState.delay;
      if (animTime < this.animDuration) {
        // 动画进行中
        dotState.isAnimating = true;
        dotState.progress = animTime / this.animDuration;

        // 🎵 应用缓动函数：先快速放大，然后缓慢缩小
        // 使用正弦函数创建平滑的跳动效果
        const t: number = dotState.progress;
        const easedProgress: number = Math.sin(t * Math.PI);  // [0, 1, 0]

        // 缩放：1.0 → 1.4 → 1.0
        this.state.dotScales[i] = 1.0 + easedProgress * 0.4;
        // 透明度：0.5 → 1.0 → 0.5
        this.state.dotOpacities[i] = 0.5 + easedProgress * 0.5;
      } else {
        // 动画完成，回到初始状态
        dotState.isAnimating = false;
        dotState.progress = 0;
        this.state.dotScales[i] = 1.0;
        this.state.dotOpacities[i] = 0.5;
      }
    }
  }

  /**
   * 重置动画到初始状态
   */
  reset(): void {
    this.totalTime = 0;
    this.dotStates.forEach((dotState: DotAnimState) => {
      dotState.progress = 0;
      dotState.isAnimating = false;
      dotState.delayTimer = 0;
    });
    this.state.dotOpacities = [0.5, 0.5, 0.5];
    this.state.dotScales = [1.0, 1.0, 1.0];
  }
}
