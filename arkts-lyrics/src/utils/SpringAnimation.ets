/**
 * 弹簧动画系统
 * 基于物理的弹簧动画，用于流畅的位置过渡
 */

import { SpringConfig } from '../interfaces/LyricInterfaces';

export class Spring {
  private mass: number = 1.0;
  private stiffness: number = 100.0;
  private damping: number = 10.0;

  private currentPosition: number = 0;
  private targetPosition: number = 0;
  private velocity: number = 0;

  private isAnimating: boolean = false;

  constructor(config?: SpringConfig) {
    if (config) {
      this.mass = config.mass ?? this.mass;
      this.stiffness = config.stiffness ?? this.stiffness;
      this.damping = config.damping ?? this.damping;
    }
  }

  /**
   * 设置目标位置
   */
  setTargetPosition(target: number): void {
    this.targetPosition = target;
    this.isAnimating = Math.abs(target - this.currentPosition) > 0.1;
  }

  /**
   * 设置当前位置（立即跳转）
   */
  setCurrentPosition(position: number): void {
    this.currentPosition = position;
    this.targetPosition = position;
    this.velocity = 0;
    this.isAnimating = false;
  }

  /**
   * 更新弹簧动画
   * @param deltaTime 时间增量（秒）
   */
  update(deltaTime: number): void {
    if (!this.isAnimating) {
      return;
    }

    // 弹簧力: F = -k * x
    const displacement = this.currentPosition - this.targetPosition;
    const springForce = -this.stiffness * displacement;

    // 阻尼力: F = -c * v
    const dampingForce = -this.damping * this.velocity;

    // 加速度: a = F / m
    const acceleration = (springForce + dampingForce) / this.mass;

    // 更新速度和位置
    this.velocity += acceleration * deltaTime;
    this.currentPosition += this.velocity * deltaTime;

    // 检查是否停止动画
    if (Math.abs(displacement) < 0.1 && Math.abs(this.velocity) < 0.1) {
      this.currentPosition = this.targetPosition;
      this.velocity = 0;
      this.isAnimating = false;
    }
  }

  /**
   * 获取当前位置
   */
  getCurrentPosition(): number {
    return this.currentPosition;
  }

  /**
   * 是否正在动画
   */
  getIsAnimating(): boolean {
    return this.isAnimating;
  }
}
