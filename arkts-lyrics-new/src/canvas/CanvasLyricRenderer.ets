/**
 * Canvas歌词渲染器
 * 完整实现原版的所有视觉效果
 * 严格符合ArkTS类型规范
 */

import {
  LyricLine,
  LyricWord,
  WordRenderInfo,
  LyricLineRenderState,
  CanvasRenderContext,
  RendererConfig
} from '../models/LyricModels';
import {
  calculateWordProgress,
  shouldEmphasizeWord,
  calculateEmphasizeScale,
  calculateGlowIntensity,
  calculateWordColor
} from '../utils/LyricUtils';

/**
 * 🎵 字体大小配置
 * 可在初始化时自定义，方便后续调整
 */
export class FontSizeConfig {
  /** 激活行主歌词字体大小 */
  mainActive: number = 28;
  /** 非激活行主歌词字体大小 */
  mainInactive: number = 24;
  /** 翻译字体大小 */
  translation: number = 18;
  /** 音译字体大小 */
  roman: number = 16;
  /** 主歌词与翻译之间的间距 */
  lineSpacing: number = 8;
  /** 行与行之间的间距 */
  linePadding: number = 20;
  /** 行高系数（相对于字体大小） */
  lineHeightRatio: number = 1.4;

  constructor() {}
}

/**
 * 单词位置计算结果
 */
class WordPositionResult {
  wordInfos: WordRenderInfo[];
  lineCount: number;

  constructor(wordInfos: WordRenderInfo[], lineCount: number) {
    this.wordInfos = wordInfos;
    this.lineCount = lineCount;
  }
}

/**
 * 歌词渲染器类
 * 负责将歌词渲染到Canvas上
 */
export class CanvasLyricRenderer {
  /** 渲染上下文配置 */
  private renderContext: CanvasRenderContext;
  /** Canvas 2D 上下文 */
  private canvasCtx: CanvasRenderingContext2D | null = null;
  /** 普通歌词字体 */
  private readonly normalFont: string = 'HarmonyHeiTi';
  /** 加粗歌词字体 */
  private readonly boldFont: string = 'HarmonyHeiTi-Bold';
  /** 🎵 字体大小配置 */
  private fontConfig: FontSizeConfig;

  constructor(context: CanvasRenderContext, fontConfig?: FontSizeConfig) {
    this.renderContext = context;
    this.fontConfig = fontConfig ? fontConfig : new FontSizeConfig();
  }

  /**
   * 获取字体配置（供外部读取）
   */
  getFontConfig(): FontSizeConfig {
    return this.fontConfig;
  }

  /**
   * 设置Canvas上下文
   * @param ctx Canvas 2D渲染上下文
   */
  setCanvasContext(ctx: CanvasRenderingContext2D): void {
    this.canvasCtx = ctx;
  }

  /**
   * 渲染单行歌词
   * @param state 歌词行渲染状态
   * @param currentTime 当前播放时间（毫秒）
   * @param config 渲染器配置
   */
  renderLine(
    state: LyricLineRenderState,
    currentTime: number,
    config: RendererConfig
  ): void {
    if (!this.canvasCtx) {
      return;
    }

    const ctx: CanvasRenderingContext2D = this.canvasCtx;
    const line: LyricLine = state.line;

    // 🎵 跳过空白歌词行（间奏行），由 renderInterlude 单独渲染
    if (line.words.length === 0) {
      return;
    }

    // 保存画布状态
    ctx.save();

    // 🎵 模糊效果（暂时禁用 - Canvas blur 性能消耗太大）
    // 目前用透明度变化来代替模糊效果
    // TODO: 考虑使用离屏 Canvas 缓存或其他优化方案
    // if (state.blurRadius > 0) {
    //   const blurPx: number = state.blurRadius * 0.8;
    //   ctx.filter = `blur(${blurPx}px)`;
    // } else {
    //   ctx.filter = 'none';
    // }

    // 应用变换：位置、缩放、透明度
    // 🎵 Y坐标组成：
    //   - animatedPositionY: 动画后的位置（波浪延迟效果，每行独立弹簧动画）
    //   - yOffset: 已播放歌词的抬升偏移（静态，让已播放的歌词略微上移）
    //   - waveOffset: 波动动画偏移（保留用于其他效果）
    const finalY: number = state.animatedPositionY + state.yOffset + state.waveOffset;

    // 🎵 先移动到行的位置
    ctx.translate(0, finalY);

    // 🎵 缩放变换：以文字区域左边缘为基准点进行缩放
    // 缩放中心点（相对于当前位置）：x=40（文字左边缘），y=30（行高的一半）
    const scaleOriginX: number = 40;
    const scaleOriginY: number = 30;

    ctx.translate(scaleOriginX, scaleOriginY);
    ctx.scale(state.scaleRatio, state.scaleRatio);
    ctx.translate(-scaleOriginX, -scaleOriginY);

    ctx.globalAlpha = state.alphaValue;

    // 🎵 从配置获取字体大小
    const fc: FontSizeConfig = this.fontConfig;
    const mainFontSize: number = state.isActive ? fc.mainActive : fc.mainInactive;
    const translationFontSize: number = fc.translation;
    const romanFontSize: number = fc.roman;
    const lineSpacing: number = fc.lineSpacing;

    // 渲染主歌词（支持换行）
    const mainLineCount: number = this.renderMainLyric(ctx, state, currentTime, config, mainFontSize);

    // 计算主歌词的实际高度
    // 单行时只需要字体高度，多行时需要考虑行间距
    const lineHeight: number = mainFontSize * fc.lineHeightRatio;
    const mainLyricHeight: number = mainLineCount === 1
      ? mainFontSize
      : (mainLineCount - 1) * lineHeight + mainFontSize;

    // 渲染翻译（位置在主歌词下方 + 间距）
    if (config.showTranslation && line.translatedLyric) {
      ctx.save();
      ctx.translate(0, mainLyricHeight + lineSpacing);
      this.renderTranslation(ctx, line, state.isActive, translationFontSize);
      ctx.restore();
    }

    // 渲染音译
    if (config.showRoman && line.romanLyric) {
      ctx.save();
      const translationOffset: number = config.showTranslation && line.translatedLyric
        ? translationFontSize + lineSpacing
        : 0;
      ctx.translate(0, mainLyricHeight + lineSpacing + translationOffset);
      this.renderRoman(ctx, line, state.isActive, romanFontSize);
      ctx.restore();
    }

    // 计算并存储总行高
    let totalHeight: number = mainLyricHeight;
    if (config.showTranslation && line.translatedLyric) {
      totalHeight += lineSpacing + translationFontSize;
    }
    if (config.showRoman && line.romanLyric) {
      totalHeight += lineSpacing + romanFontSize;
    }
    totalHeight += fc.linePadding; // 行与行之间的间距
    state.calculatedHeight = totalHeight;

    // 恢复画布状态
    ctx.restore();
  }

  /**
   * 渲染主歌词行（支持自动换行）
   * @param ctx Canvas上下文
   * @param state 歌词行渲染状态
   * @param currentTime 当前播放时间
   * @param config 渲染器配置
   * @param fontSize 字体大小
   * @returns 实际渲染的行数
   */
  private renderMainLyric(
    ctx: CanvasRenderingContext2D,
    state: LyricLineRenderState,
    currentTime: number,
    config: RendererConfig,
    fontSize: number
  ): number {
    const line: LyricLine = state.line;
    const isActive: boolean = state.isActive;

    // 设置字体（使用传入的字体大小）
    const fontWeight: string = isActive ? 'bold' : 'normal';
    const fontFamily: string = isActive ? this.boldFont : this.normalFont;
    ctx.font = `${fontWeight} ${fontSize}vp ${fontFamily}`;
    ctx.textBaseline = 'top';

    // 计算可用宽度和起始X坐标
    const leftMargin: number = 40;
    const rightMargin: number = 40;
    const maxWidth: number = this.renderContext.width - rightMargin;
    const startX: number = leftMargin;

    // 计算单词位置（支持换行）
    const result: WordPositionResult = this.calculateWordPositions(ctx, line, fontSize, maxWidth, startX);
    const wordInfos: WordRenderInfo[] = result.wordInfos;

    // 存储行数到状态
    state.mainLyricLines = result.lineCount;

    // 渲染每个单词
    wordInfos.forEach((wordInfo: WordRenderInfo) => {
      const word: LyricWord = wordInfo.word;
      const progress: number = calculateWordProgress(word, currentTime);
      wordInfo.progress = progress;

      // 判断是否需要强调
      const shouldEmphasize: boolean = config.enableEmphasize && shouldEmphasizeWord(word);
      wordInfo.shouldEmphasize = shouldEmphasize;

      if (shouldEmphasize && progress > 0 && progress < 1) {
        wordInfo.emphasizeScale = calculateEmphasizeScale(progress);
        wordInfo.glowIntensity = config.enableGlow ? calculateGlowIntensity(progress) : 0;
      }

      // 渲染单词
      this.renderWord(ctx, wordInfo, isActive);
    });

    return result.lineCount;
  }

  /**
   * 计算单词位置信息（支持自动换行）
   * @param ctx Canvas上下文
   * @param line 歌词行
   * @param fontSize 字体大小
   * @param maxWidth 最大可用宽度
   * @param startX 起始X坐标
   * @returns 包含单词信息和行数的结果
   */
  private calculateWordPositions(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    fontSize: number,
    maxWidth: number,
    startX: number
  ): WordPositionResult {
    const wordInfos: WordRenderInfo[] = [];
    const lineHeight: number = fontSize * this.fontConfig.lineHeightRatio;

    let currentX: number = startX;
    let currentY: number = 0;
    let lineCount: number = 1;

    line.words.forEach((word: LyricWord) => {
      const info: WordRenderInfo = new WordRenderInfo(word);
      const metrics: TextMetrics = ctx.measureText(word.word);
      info.width = metrics.width + 4; // 添加间距
      info.height = fontSize;

      // 检查是否需要换行
      if (currentX + info.width > maxWidth && currentX > startX) {
        // 换行
        currentX = startX;
        currentY += lineHeight;
        lineCount++;
      }

      info.x = currentX;
      info.y = currentY;
      currentX += info.width;

      wordInfos.push(info);
    });

    return new WordPositionResult(wordInfos, lineCount);
  }

  /**
   * 渲染单个单词
   * @param ctx Canvas上下文
   * @param wordInfo 单词渲染信息
   * @param isActive 是否为激活行
   */
  private renderWord(
    ctx: CanvasRenderingContext2D,
    wordInfo: WordRenderInfo,
    isActive: boolean
  ): void {
    ctx.save();

    // ========== 🎵 逐字抬升效果（Apple Music 风格）==========
    // 当单词开始播放时，向上浮动；播放完毕后保持抬起状态
    // 参考原版: up = 0.05em, easing: ease-out, fill: both
    let floatOffsetY: number = 0;
    if (wordInfo.progress > 0) {
      // 使用字体高度的比例计算偏移量（原版是 0.05em = 5%）
      // 这样在不同字体大小下都能保持一致的视觉效果
      const floatRatio: number = 0.08;  // 字体高度的8%（略大于原版的5%，视觉更明显）
      const maxFloatOffset: number = -wordInfo.height * floatRatio;

      if (wordInfo.progress < 1) {
        // 正在播放中：使用 ease-out 曲线逐渐抬升
        // ease-out: 1 - (1 - t)^2
        const easeOut: number = 1 - Math.pow(1 - wordInfo.progress, 2);
        floatOffsetY = maxFloatOffset * easeOut;
      } else {
        // 播放完毕：保持抬起状态 (fill: both)
        floatOffsetY = maxFloatOffset;
      }
    }

    // 应用抬升偏移
    const renderY: number = wordInfo.y + floatOffsetY;

    // 应用强调变换
    if (wordInfo.shouldEmphasize && wordInfo.emphasizeScale > 1.0) {
      const centerX: number = wordInfo.x + wordInfo.width / 2;
      const centerY: number = renderY + wordInfo.height / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(wordInfo.emphasizeScale, wordInfo.emphasizeScale);
      ctx.translate(-centerX, -centerY);
    }

    // 渲染辉光效果
    if (wordInfo.glowIntensity > 0) {
      const alphaStr: string = wordInfo.glowIntensity.toFixed(2);
      ctx.shadowColor = `rgba(255, 255, 255, ${alphaStr})`;
      ctx.shadowBlur = 20 * wordInfo.glowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // 渲染渐变遮罩效果（性能优化：减少渐变创建）
    // 只在真正有渐变效果的范围内使用渐变（0.05-0.95）
    if (isActive && wordInfo.progress > 0.05 && wordInfo.progress < 0.95) {
      this.renderWordWithGradientMaskAtY(ctx, wordInfo, renderY);
    } else {
      // 普通渲染（性能更好）
      const color: string = calculateWordColor(wordInfo.progress, isActive);
      ctx.fillStyle = color;
      ctx.fillText(wordInfo.word.word, wordInfo.x, renderY);
    }

    ctx.restore();
  }

  /**
   * 渲染带渐变遮罩的单词（核心特效）- 指定Y坐标版本
   * 使用线性渐变模拟原版的mask-image效果
   * @param ctx Canvas上下文
   * @param wordInfo 单词渲染信息
   * @param renderY 渲染Y坐标（包含抬升偏移）
   */
  private renderWordWithGradientMaskAtY(
    ctx: CanvasRenderingContext2D,
    wordInfo: WordRenderInfo,
    renderY: number
  ): void {
    const word: string = wordInfo.word.word;
    const x: number = wordInfo.x;
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
      renderY,
      x + gradientEnd,
      renderY
    );

    // 设置渐变色标
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
    ctx.fillText(word, x, renderY);
  }

  /**
   * 渲染翻译文本
   * @param ctx Canvas上下文
   * @param line 歌词行数据（用于判断对齐方式）
   * @param isActive 是否为激活行
   * @param fontSize 字体大小
   */
  private renderTranslation(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    isActive: boolean,
    fontSize: number
  ): void {
    ctx.save();

    ctx.font = `normal ${fontSize}vp ${this.normalFont}`;
    const alphaValue: number = isActive ? 0.8 : 0.4;
    const alphaStr: string = alphaValue.toFixed(2);
    ctx.fillStyle = `rgba(153, 153, 153, ${alphaStr})`;
    ctx.textBaseline = 'top';

    // 🎵 跟随主歌词对齐方式：
    //   - 普通歌词：左对齐
    //   - 对唱歌词：右对齐
    const leftMargin: number = 40;
    const rightMargin: number = 40;
    let x: number;

    if (line.isDuet) {
      // 对唱：右对齐
      ctx.textAlign = 'right';
      x = this.renderContext.width - rightMargin;
    } else {
      // 普通：左对齐
      ctx.textAlign = 'left';
      x = leftMargin;
    }

    // Y坐标为0，因为调用方已经通过translate设置了正确的位置
    ctx.fillText(line.translatedLyric, x, 0);

    ctx.restore();
  }

  /**
   * 渲染音译文本
   * @param ctx Canvas上下文
   * @param line 歌词行数据（用于判断对齐方式）
   * @param isActive 是否为激活行
   * @param fontSize 字体大小
   */
  private renderRoman(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    isActive: boolean,
    fontSize: number
  ): void {
    ctx.save();

    ctx.font = `normal ${fontSize}vp ${this.normalFont}`;
    const alphaValue: number = isActive ? 0.6 : 0.3;
    const alphaStr: string = alphaValue.toFixed(2);
    ctx.fillStyle = `rgba(119, 119, 119, ${alphaStr})`;
    ctx.textBaseline = 'top';

    // 🎵 跟随主歌词对齐方式：
    //   - 普通歌词：左对齐
    //   - 对唱歌词：右对齐
    const leftMargin: number = 40;
    const rightMargin: number = 40;
    let x: number;

    if (line.isDuet) {
      // 对唱：右对齐
      ctx.textAlign = 'right';
      x = this.renderContext.width - rightMargin;
    } else {
      // 普通：左对齐
      ctx.textAlign = 'left';
      x = leftMargin;
    }

    // Y坐标为0，因为调用方已经通过translate设置了正确的位置
    ctx.fillText(line.romanLyric, x, 0);

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
   * 🎵 三个圆点依次跳动的效果
   * @param positionY Y轴位置（行顶部）
   * @param dotOpacities 圆点透明度数组
   * @param dotScales 圆点缩放数组（包含整体缩放，用于消失动画的先放大再缩小效果）
   * @param lineHeight 当前行高（用于垂直居中）
   */
  renderInterlude(
    positionY: number,
    dotOpacities: number[],
    dotScales: number[],
    lineHeight: number = 30
  ): void {
    if (!this.canvasCtx) {
      return;
    }

    const ctx: CanvasRenderingContext2D = this.canvasCtx;
    ctx.save();

    // 🎵 圆点参数
    const dotRadius: number = 4;        // 基础半径
    const dotSpacing: number = 10;      // 点与点之间的间距（边缘到边缘）
    const dotDiameter: number = dotRadius * 2;

    // 🎵 左对齐：圆点左边缘与歌词左边缘对齐
    // 歌词左边缘在 x=40，所以第一个圆点的圆心在 x=40+dotRadius
    const leftMargin: number = 40;
    const firstDotCenterX: number = leftMargin + dotRadius;

    // 🎵 垂直居中：在当前行高度内居中
    const centerY: number = positionY + lineHeight / 2;

    // 🎵 整体缩放（从 dotScales[0] 获取，三个点缩放相同）
    const globalScale: number = dotScales[0];

    // 🎵 计算整体中心点（用于缩放变换）
    const totalWidth: number = dotDiameter * 3 + dotSpacing * 2;
    const centerX: number = firstDotCenterX + totalWidth / 2 - dotRadius;

    // 🎵 应用整体缩放变换（先放大再缩小效果的关键）
    ctx.translate(centerX, centerY);
    ctx.scale(globalScale, globalScale);
    ctx.translate(-centerX, -centerY);

    // 渲染三个圆点
    for (let i: number = 0; i < 3; i++) {
      // 每个点的 X 坐标
      const x: number = firstDotCenterX + i * (dotDiameter + dotSpacing);
      const y: number = centerY;
      const opacity: number = dotOpacities[i];

      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#FFFFFF';

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
