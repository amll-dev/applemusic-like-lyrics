/**
 * 歌词播放器控制器
 * 核心业务逻辑，管理歌词状态和动画
 */

import { LyricLine, LyricLineRenderState, LyricPlayerConfig, InterludeState, CanvasRenderContext } from '../models/LyricModels';
import { SpringAnimator, SpringAnimatorConfig } from '../utils/SpringAnimator';
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

  constructor(config: LyricPlayerConfig) {
    this.config = config;

    const springConfig: SpringAnimatorConfig = new SpringAnimatorConfig(1.0, 100.0, 20.0);
    this.scrollAnimator = new SpringAnimator(springConfig);

    this.interludeState = new InterludeState();
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
   */
  update(deltaTimeMs: number): void {
    if (this.config.enableSpring) {
      this.scrollAnimator.update(deltaTimeMs / 1000.0);
      this.scrollOffset = this.scrollAnimator.getPosition();
    }
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

    for (let i = 0; i < this.lines.length; i++) {
      const line: LyricLine = this.lines[i];
      if (this.currentTime >= line.startTime && this.currentTime < line.endTime) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== this.currentLineIndex) {
      this.currentLineIndex = newIndex;
      this.updateScrollTarget();
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
   */
  private updateLineStates(): void {
    this.lineStates.forEach((state: LyricLineRenderState, index: number) => {
      const line: LyricLine = state.line;

      state.isActive = this.currentTime >= line.startTime && this.currentTime < line.endTime;

      const distance: number = Math.abs(index - this.currentLineIndex);

      if (this.config.enableScale) {
        state.scaleRatio = state.isActive ? 1.0 : 0.97;
      } else {
        state.scaleRatio = 1.0;
      }

      if (state.isActive) {
        state.alphaValue = 1.0;
      } else if (this.config.hidePassed && index < this.currentLineIndex) {
        state.alphaValue = 0;
      } else {
        state.alphaValue = Math.max(0.2, 1.0 - distance * 0.15);
      }

      if (this.config.enableBlur) {
        state.blurRadius = calculateBlurRadius(distance, 5);
      } else {
        state.blurRadius = 0;
      }
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
  }

  /**
   * 更新间奏状态
   */
  private updateInterludeState(): void {
    if (this.currentLineIndex < 0) {
      this.interludeState.visible = false;
      return;
    }

    const currentLine: LyricLine = this.lines[this.currentLineIndex];
    const nextLine: LyricLine | undefined =
      this.currentLineIndex + 1 < this.lines.length ? this.lines[this.currentLineIndex + 1] : undefined;

    if (nextLine && this.currentTime >= currentLine.endTime) {
      const gap: number = nextLine.startTime - currentLine.endTime;

      if (gap >= 4000) {
        this.interludeState.visible = true;
        this.interludeState.prevLineIndex = this.currentLineIndex;
        this.interludeState.nextLineIndex = this.currentLineIndex + 1;

        let posY: number = 0;
        for (let i = 0; i <= this.currentLineIndex; i++) {
          posY += this.getLineHeight(i);
        }
        this.interludeState.positionY = posY;
      } else {
        this.interludeState.visible = false;
      }
    } else {
      this.interludeState.visible = false;
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
