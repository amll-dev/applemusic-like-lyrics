/**
 * Canvas歌词渲染器
 * 完整实现原版的所有视觉效果
 */

import { LyricLine, LyricWord, WordRenderInfo, LyricLineRenderState, CanvasRenderContext } from '../models/LyricModels';
import {
  calculateWordProgress,
  shouldEmphasizeWord,
  calculateEmphasizeScale,
  calculateGlowIntensity,
  calculateWordColor
} from '../utils/LyricUtils';

export class CanvasLyricRenderer {
  private renderContext: CanvasRenderContext;
  private canvasCtx: CanvasRenderingContext2D | null = null;

  constructor(context: CanvasRenderContext) {
    this.renderContext = context;
  }

  setCanvasContext(ctx: CanvasRenderingContext2D): void {
    this.canvasCtx = ctx;
  }

  /**
   * 渲染单行歌词
   */
  renderLine(
    state: LyricLineRenderState,
    currentTime: number,
    config: {
      enableEmphasize: boolean,
      enableGlow: boolean,
      showTranslation: boolean,
      showRoman: boolean
    }
  ): void {
    if (!this.canvasCtx) {
      return;
    }

    const ctx: CanvasRenderingContext2D = this.canvasCtx;
    const line: LyricLine = state.line;

    ctx.save();

    // 应用变换
    ctx.translate(0, state.positionY);
    ctx.scale(state.scaleRatio, state.scaleRatio);
    ctx.globalAlpha = state.alphaValue;

    // 渲染主歌词
    this.renderMainLyric(ctx, line, currentTime, state.isActive, config);

    // 渲染翻译
    if (config.showTranslation && line.translatedLyric) {
      this.renderTranslation(ctx, line.translatedLyric, state.isActive);
    }

    // 渲染音译
    if (config.showRoman && line.romanLyric) {
      this.renderRoman(ctx, line.romanLyric, state.isActive);
    }

    ctx.restore();
  }

  /**
   * 渲染主歌词行
   */
  private renderMainLyric(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    currentTime: number,
    isActive: boolean,
    config: { enableEmphasize: boolean, enableGlow: boolean }
  ): void {
    const fontSize: number = isActive ? 24 : 20;
    ctx.font = `${isActive ? 'bold' : 'normal'} ${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    // 计算单词位置
    const wordInfos: WordRenderInfo[] = this.calculateWordPositions(ctx, line, fontSize);

    // 计算起始X坐标（居中或右对齐）
    const totalWidth: number = wordInfos.reduce((sum: number, info: WordRenderInfo) => sum + info.width, 0);
    const centerX: number = this.renderContext.width / 2;
    let startX: number = line.isDuet ? (this.renderContext.width - totalWidth - 40) : (centerX - totalWidth / 2);

    // 渲染每个单词
    wordInfos.forEach((wordInfo: WordRenderInfo) => {
      const word: LyricWord = wordInfo.word;
      const progress: number = calculateWordProgress(word, currentTime);
      wordInfo.progress = progress;
      wordInfo.x = startX;
      wordInfo.y = 0;

      // 判断是否需要强调
      const shouldEmphasize: boolean = config.enableEmphasize && shouldEmphasizeWord(word);
      wordInfo.shouldEmphasize = shouldEmphasize;

      if (shouldEmphasize && progress > 0 && progress < 1) {
        wordInfo.emphasizeScale = calculateEmphasizeScale(progress);
        wordInfo.glowIntensity = config.enableGlow ? calculateGlowIntensity(progress) : 0;
      }

      // 渲染单词
      this.renderWord(ctx, wordInfo, isActive);

      startX += wordInfo.width;
    });
  }

  /**
   * 计算单词位置
   */
  private calculateWordPositions(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    fontSize: number
  ): WordRenderInfo[] {
    const wordInfos: WordRenderInfo[] = [];

    line.words.forEach((word: LyricWord) => {
      const info: WordRenderInfo = new WordRenderInfo(word);
      const metrics: TextMetrics = ctx.measureText(word.word);
      info.width = metrics.width + 4; // 添加间距
      info.height = fontSize;
      wordInfos.push(info);
    });

    return wordInfos;
  }

  /**
   * 渲染单个单词
   */
  private renderWord(
    ctx: CanvasRenderingContext2D,
    wordInfo: WordRenderInfo,
    isActive: boolean
  ): void {
    ctx.save();

    // 应用强调变换
    if (wordInfo.shouldEmphasize && wordInfo.emphasizeScale > 1.0) {
      ctx.translate(wordInfo.x + wordInfo.width / 2, wordInfo.y + wordInfo.height / 2);
      ctx.scale(wordInfo.emphasizeScale, wordInfo.emphasizeScale);
      ctx.translate(-(wordInfo.x + wordInfo.width / 2), -(wordInfo.y + wordInfo.height / 2));
    }

    // 渲染辉光效果
    if (wordInfo.glowIntensity > 0) {
      ctx.shadowColor = 'rgba(255, 255, 255, ' + wordInfo.glowIntensity + ')';
      ctx.shadowBlur = 20 * wordInfo.glowIntensity;
    }

    // 渲染渐变遮罩效果
    if (isActive && wordInfo.progress > 0 && wordInfo.progress < 1) {
      this.renderWordWithGradientMask(ctx, wordInfo);
    } else {
      // 普通渲染
      const color: string = calculateWordColor(wordInfo.progress, isActive);
      ctx.fillStyle = color;
      ctx.fillText(wordInfo.word.word, wordInfo.x, wordInfo.y);
    }

    ctx.restore();
  }

  /**
   * 渲染带渐变遮罩的单词（核心特效）
   */
  private renderWordWithGradientMask(
    ctx: CanvasRenderingContext2D,
    wordInfo: WordRenderInfo
  ): void {
    const word: string = wordInfo.word.word;
    const x: number = wordInfo.x;
    const y: number = wordInfo.y;
    const width: number = wordInfo.width;
    const progress: number = wordInfo.progress;

    // 计算渐变位置
    const fadeWidth: number = width * 0.3; // 渐变区域宽度
    const currentPos: number = width * progress;
    const gradientStart: number = Math.max(0, currentPos - fadeWidth);
    const gradientEnd: number = Math.min(width, currentPos + fadeWidth);

    // 创建线性渐变
    const gradient: CanvasGradient = ctx.createLinearGradient(
      x + gradientStart,
      y,
      x + gradientEnd,
      y
    );

    if (currentPos > fadeWidth) {
      gradient.addColorStop(0, '#FFFFFF'); // 已播放部分：白色
    }

    const fadeMid: number = (currentPos - gradientStart) / (gradientEnd - gradientStart);
    gradient.addColorStop(Math.max(0, fadeMid - 0.1), '#FFFFFF');
    gradient.addColorStop(fadeMid, '#AAAAAA');
    gradient.addColorStop(Math.min(1, fadeMid + 0.1), '#888888');

    if (currentPos < width - fadeWidth) {
      gradient.addColorStop(1, '#888888'); // 未播放部分：灰色
    }

    ctx.fillStyle = gradient;
    ctx.fillText(word, x, y);
  }

  /**
   * 渲染翻译
   */
  private renderTranslation(
    ctx: CanvasRenderingContext2D,
    translation: string,
    isActive: boolean
  ): void {
    ctx.save();

    ctx.font = '14px sans-serif';
    ctx.fillStyle = isActive ? 'rgba(153, 153, 153, 0.8)' : 'rgba(153, 153, 153, 0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const centerX: number = this.renderContext.width / 2;
    ctx.fillText(translation, centerX, 30);

    ctx.restore();
  }

  /**
   * 渲染音译
   */
  private renderRoman(
    ctx: CanvasRenderingContext2D,
    roman: string,
    isActive: boolean
  ): void {
    ctx.save();

    ctx.font = '12px sans-serif';
    ctx.fillStyle = isActive ? 'rgba(119, 119, 119, 0.6)' : 'rgba(119, 119, 119, 0.3)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const centerX: number = this.renderContext.width / 2;
    ctx.fillText(roman, centerX, 50);

    ctx.restore();
  }

  /**
   * 清空画布
   */
  clear(): void {
    if (!this.canvasCtx) {
      return;
    }
    this.canvasCtx.clearRect(0, 0, this.renderContext.width, this.renderContext.height);
  }

  /**
   * 渲染间奏动画
   */
  renderInterlude(
    positionY: number,
    dotOpacities: number[],
    dotScales: number[]
  ): void {
    if (!this.canvasCtx) {
      return;
    }

    const ctx: CanvasRenderingContext2D = this.canvasCtx;
    ctx.save();

    const centerX: number = this.renderContext.width / 2;
    const spacing: number = 12;
    const dotRadius: number = 4;

    for (let i = 0; i < 3; i++) {
      const x: number = centerX + (i - 1) * spacing;
      const y: number = positionY;
      const scale: number = dotScales[i];
      const opacity: number = dotOpacities[i];

      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#FFFFFF';

      ctx.beginPath();
      ctx.arc(x, y, dotRadius * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
