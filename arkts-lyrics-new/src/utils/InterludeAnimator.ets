/**
 * 间奏动画管理器
 * 🎵 完整实现原版的所有间奏效果
 * - 淡入淡出动画（fade in/out）
 * - 呼吸动画（breathing scale animation）
 * - 三个圆点的交错透明度（staggered dots opacity）
 * - 结束前的缩小效果（scale shrink before end）
 */

import { InterludeState } from '../models/LyricModels';

/**
 * easeInOutBack 缓动函数
 * 创建一个带有"回弹"效果的缓动
 */
function easeInOutBack(x: number): number {
  const c1: number = 1.70158;
  const c2: number = c1 * 1.525;

  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

/**
 * easeOutExpo 缓动函数
 * 创建一个指数式的缓动效果
 */
function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * 限制数值在指定范围内
 */
function clamp(min: number, cur: number, max: number): number {
  return Math.max(min, Math.min(cur, max));
}

export class InterludeAnimator {
  private state: InterludeState;
  /** 当前时间（相对于整首歌曲的绝对时间，ms） */
  private currentTime: number = 0;
  /** 目标呼吸周期时长（ms） */
  private readonly targetBreatheDuration: number = 1500;
  /** 间奏开始时间（ms） */
  private interludeStart: number = 0;
  /** 间奏结束时间（ms） */
  private interludeEnd: number = 0;
  /** 间奏总时长（ms） */
  private interludeDuration: number = 0;

  constructor(state: InterludeState) {
    this.state = state;
  }

  /**
   * 设置间奏时间范围
   * @param startTime 间奏开始时间（ms）
   * @param endTime 间奏结束时间（ms）
   * @param currentPlayTime 当前播放时间（ms）
   */
  setInterlude(startTime: number, endTime: number, currentPlayTime: number): void {
    this.interludeStart = startTime;
    this.interludeEnd = endTime;
    this.interludeDuration = endTime - startTime;
    this.currentTime = currentPlayTime;
    this.state.visible = true;
  }

  /**
   * 清除间奏状态
   */
  clearInterlude(): void {
    this.state.visible = false;
    this.state.dotOpacities = [0, 0, 0];
    this.state.dotScales = [1.0, 1.0, 1.0];
  }

  /**
   * 更新动画
   * @param currentPlayTime 当前播放时间（ms）
   */
  update(currentPlayTime: number): void {
    if (!this.state.visible) {
      return;
    }

    this.currentTime = currentPlayTime;

    // 检查是否超出间奏时间范围
    if (this.currentTime < this.interludeStart || this.currentTime > this.interludeEnd) {
      this.clearInterlude();
      return;
    }

    // 计算当前在间奏中的时长
    const currentDuration: number = this.currentTime - this.interludeStart;

    if (currentDuration > this.interludeDuration) {
      // 超出时间，隐藏
      this.clearInterlude();
      return;
    }

    // 🎵 计算呼吸动画的周期
    const breatheDuration: number = this.interludeDuration /
      Math.ceil(this.interludeDuration / this.targetBreatheDuration);

    // ========== 计算缩放 Scale ==========
    let scale: number = 1.0;

    // 1. 呼吸动画（正弦波振荡）
    scale *= Math.sin(1.5 * Math.PI - (currentDuration / breatheDuration) * 2) / 20 + 1;

    // 2. 初始放大效果（前2秒）
    if (currentDuration < 2000) {
      scale *= easeOutExpo(currentDuration / 2000);
    }

    // 3. 结束前的缩小效果（最后750ms）
    if (this.interludeDuration - currentDuration < 750) {
      scale *= 1 - easeInOutBack(
        (750 - (this.interludeDuration - currentDuration)) / 750 / 2
      );
    }

    // 4. 应用全局缩放系数
    scale = Math.max(0, scale) * 0.7;

    // ========== 计算全局透明度 Global Opacity ==========
    let globalOpacity: number = 1.0;

    // 1. 淡入效果（前1秒）
    if (currentDuration < 500) {
      globalOpacity = 0;  // 前500ms完全隐藏
    } else if (currentDuration < 1000) {
      globalOpacity *= (currentDuration - 500) / 500;  // 500-1000ms淡入
    }

    // 2. 淡出效果（最后375ms）
    if (this.interludeDuration - currentDuration < 375) {
      globalOpacity *= clamp(
        0,
        (this.interludeDuration - currentDuration) / 375,
        1
      );
    }

    // ========== 计算每个圆点的透明度（交错效果）==========
    const dotsDuration: number = Math.max(0, this.interludeDuration - 750);

    const dot0Opacity: number = clamp(
      0.25,
      ((currentDuration * 3) / dotsDuration) * 0.75,
      1
    );
    const dot1Opacity: number = clamp(
      0.25,
      (((currentDuration - dotsDuration / 3) * 3) / dotsDuration) * 0.75,
      1
    );
    const dot2Opacity: number = clamp(
      0.25,
      (((currentDuration - (dotsDuration / 3) * 2) * 3) / dotsDuration) * 0.75,
      1
    );

    // ========== 应用到状态 ==========
    this.state.dotScales = [scale, scale, scale];
    this.state.dotOpacities = [
      clamp(0, Math.max(0, globalOpacity * dot0Opacity), 1),
      clamp(0, Math.max(0, globalOpacity * dot1Opacity), 1),
      clamp(0, Math.max(0, globalOpacity * dot2Opacity), 1)
    ];

    // 📊 调试日志：每秒输出一次
    if (Math.floor(currentDuration / 1000) !== Math.floor((currentDuration - 16) / 1000)) {
      console.info(`[间奏动画] 进度: ${(currentDuration / 1000).toFixed(1)}s / ${(this.interludeDuration / 1000).toFixed(1)}s | ` +
        `scale=${scale.toFixed(2)} | opacity=[${this.state.dotOpacities.map(o => o.toFixed(2)).join(',')}]`);
    }
  }

  /**
   * 重置动画到初始状态
   */
  reset(): void {
    this.currentTime = 0;
    this.clearInterlude();
  }
}
