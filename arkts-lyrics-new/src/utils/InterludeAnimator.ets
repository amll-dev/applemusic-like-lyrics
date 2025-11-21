/**
 * 间奏动画管理器
 */

import { InterludeState } from '../models/LyricModels';
import { easeInOutBack, easeOutExpo } from './LyricUtils';

export class InterludeAnimator {
  private state: InterludeState;
  private animationPhase: number = 0;
  private animationTime: number = 0;
  private phaseDuration: number = 400; // 每个点的动画时长

  constructor(state: InterludeState) {
    this.state = state;
  }

  /**
   * 更新动画
   */
  update(deltaTimeMs: number): void {
    if (!this.state.visible) {
      return;
    }

    this.animationTime += deltaTimeMs;

    if (this.animationTime >= this.phaseDuration) {
      this.animationTime = 0;
      this.animationPhase = (this.animationPhase + 1) % 3;
      this.animateDot(this.animationPhase);
    }
  }

  /**
   * 动画单个圆点
   */
  private animateDot(index: number): void {
    const targetScale: number = 1.5;
    const targetOpacity: number = 1.0;

    this.state.dotScales[index] = targetScale;
    this.state.dotOpacities[index] = targetOpacity;

    setTimeout(() => {
      this.state.dotScales[index] = 1.0;
      this.state.dotOpacities[index] = 0.3;
    }, this.phaseDuration);
  }

  /**
   * 重置动画
   */
  reset(): void {
    this.animationPhase = 0;
    this.animationTime = 0;
    this.state.dotOpacities = [0.3, 0.3, 0.3];
    this.state.dotScales = [1.0, 1.0, 1.0];
  }
}
