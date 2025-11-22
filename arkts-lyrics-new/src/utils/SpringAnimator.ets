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

export class SpringAnimator {
  private mass: number;
  private stiffness: number;
  private damping: number;
  private currentPos: number = 0;
  private targetPos: number = 0;
  private velocity: number = 0;
  private animating: boolean = false;

  constructor(config: SpringAnimatorConfig) {
    this.mass = config.mass;
    this.stiffness = config.stiffness;
    this.damping = config.damping;
  }

  setTarget(target: number): void {
    // 🎵 只要目标值变化就启动动画（阈值改为 0.0001，适用于缩放等小范围值）
    if (Math.abs(target - this.targetPos) > 0.0001) {
      this.targetPos = target;
      this.animating = true;
    }
  }

  setCurrent(position: number): void {
    this.currentPos = position;
    this.targetPos = position;
    this.velocity = 0;
    this.animating = false;
  }

  update(deltaTimeSec: number): void {
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
    return this.animating;
  }
}
