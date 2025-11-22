/**
 * 弹簧动画系统
 * 基于物理的弹簧动画实现
 */

export class SpringAnimatorConfig {
  mass: number = 1.0;
  stiffness: number = 100.0;
  damping: number = 10.0;

  constructor(mass: number = 1.0, stiffness: number = 100.0, damping: number = 10.0) {
    this.mass = mass;
    this.stiffness = stiffness;
    this.damping = damping;
  }
}

/**
 * 🎵 延迟队列项
 * 用于实现波浪延迟效果
 */
class DelayedTarget {
  position: number;
  remainingDelay: number;

  constructor(position: number, delay: number) {
    this.position = position;
    this.remainingDelay = delay;
  }
}

export class SpringAnimator {
  private mass: number;
  private stiffness: number;
  private damping: number;
  private currentPos: number = 0;
  private targetPos: number = 0;
  private velocity: number = 0;
  private animating: boolean = false;

  // 🎵 延迟队列：支持波浪效果
  private delayedTarget: DelayedTarget | null = null;

  constructor(config: SpringAnimatorConfig) {
    this.mass = config.mass;
    this.stiffness = config.stiffness;
    this.damping = config.damping;
  }

  /**
   * 设置目标位置（立即生效）
   */
  setTarget(target: number): void {
    // 🎵 只要目标值变化就启动动画（阈值改为 0.0001，适用于缩放等小范围值）
    if (Math.abs(target - this.targetPos) > 0.0001) {
      this.targetPos = target;
      this.animating = true;
      // 清除延迟队列
      this.delayedTarget = null;
    }
  }

  /**
   * 🎵 设置目标位置（带延迟）
   * 用于实现波浪滚动效果，每行有不同的延迟
   * @param target 目标位置
   * @param delaySec 延迟时间（秒）
   */
  setTargetWithDelay(target: number, delaySec: number): void {
    if (delaySec > 0) {
      // 加入延迟队列
      this.delayedTarget = new DelayedTarget(target, delaySec);
    } else {
      this.setTarget(target);
    }
  }

  setCurrent(position: number): void {
    this.currentPos = position;
    this.targetPos = position;
    this.velocity = 0;
    this.animating = false;
    this.delayedTarget = null;
  }

  update(deltaTimeSec: number): void {
    // 🎵 处理延迟队列
    if (this.delayedTarget !== null) {
      this.delayedTarget.remainingDelay -= deltaTimeSec;
      if (this.delayedTarget.remainingDelay <= 0) {
        // 延迟时间到，应用目标位置
        this.setTarget(this.delayedTarget.position);
        this.delayedTarget = null;
      }
    }

    if (!this.animating) {
      return;
    }

    const displacement: number = this.currentPos - this.targetPos;
    const springForce: number = -this.stiffness * displacement;
    const dampingForce: number = -this.damping * this.velocity;
    const acceleration: number = (springForce + dampingForce) / this.mass;

    this.velocity += acceleration * deltaTimeSec;
    this.currentPos += this.velocity * deltaTimeSec;

    // 🎵 使用更小的阈值判断动画完成（适用于缩放等小范围值）
    if (Math.abs(displacement) < 0.001 && Math.abs(this.velocity) < 0.001) {
      this.currentPos = this.targetPos;
      this.velocity = 0;
      this.animating = false;
    }
  }

  getPosition(): number {
    return this.currentPos;
  }

  isAnimating(): boolean {
    return this.animating || this.delayedTarget !== null;
  }
}
