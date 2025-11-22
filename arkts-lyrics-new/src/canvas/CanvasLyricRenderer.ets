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

  constructor(context: CanvasRenderContext) {
    this.renderContext = context;
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

    // 保存画布状态
    ctx.save();

    // 🎵 模糊效果暂时禁用（性能优化中）
    // TODO: 实现离屏Canvas缓存系统后再启用
    // if (state.blurRadius > 0) {
    //   ctx.filter = `blur(${state.blurRadius}px)`;
    // }

    // 应用变换：位置、缩放、透明度
    // 🎵 Y坐标组成：
    //   - positionY: 基础位置（布局计算得出）
    //   - yOffset: 已播放歌词的抬升偏移（静态，让已播放的歌词略微上移）
    //   - waveOffset: 波动动画偏移（动态，逐行传播的弹簧效果）
    const finalY: number = state.positionY + state.yOffset + state.waveOffset;
    ctx.translate(0, finalY);
    ctx.scale(state.scaleRatio, state.scaleRatio);
    ctx.globalAlpha = state.alphaValue;

    // 渲染主歌词
    this.renderMainLyric(ctx, line, currentTime, state.isActive, config);

    // 渲染翻译
    if (config.showTranslation && line.translatedLyric) {
      this.renderTranslation(ctx, line, state.isActive);
    }

    // 渲染音译
    if (config.showRoman && line.romanLyric) {
      this.renderRoman(ctx, line, state.isActive);
    }

    // 恢复画布状态
    ctx.restore();
  }

  /**
   * 渲染主歌词行
   * @param ctx Canvas上下文
   * @param line 歌词行数据
   * @param currentTime 当前播放时间
   * @param isActive 是否为激活行
   * @param config 渲染器配置
   */
  private renderMainLyric(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    currentTime: number,
    isActive: boolean,
    config: RendererConfig
  ): void {
    // 设置字体
    const fontSize: number = isActive ? 24 : 20;
    const fontWeight: string = isActive ? 'bold' : 'normal';
    const fontFamily: string = isActive ? this.boldFont : this.normalFont;
    ctx.font = `${fontWeight} ${fontSize}vp ${fontFamily}`;
    ctx.textBaseline = 'top';

    // 计算单词位置
    const wordInfos: WordRenderInfo[] = this.calculateWordPositions(ctx, line, fontSize);

    // 计算起始X坐标
    // 🎵 对齐规则（参考 Apple Music）：
    //   - 普通歌词：左对齐（距离左边缘 40px）
    //   - 对唱歌词：右对齐（距离右边缘 40px）
    const totalWidth: number = wordInfos.reduce((sum: number, info: WordRenderInfo) => sum + info.width, 0);
    const leftMargin: number = 40;   // 左侧边距
    const rightMargin: number = 40;  // 右侧边距
    let startX: number = line.isDuet ?
      (this.renderContext.width - totalWidth - rightMargin) :  // 对唱：右对齐
      leftMargin;                                                // 普通：左对齐

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
   * 计算单词位置信息
   * @param ctx Canvas上下文
   * @param line 歌词行
   * @param fontSize 字体大小
   * @returns 单词渲染信息数组
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
   */
  private renderTranslation(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    isActive: boolean
  ): void {
    ctx.save();

    ctx.font = `normal 14vp ${this.normalFont}`;
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

    ctx.fillText(line.translatedLyric, x, 30);

    ctx.restore();
  }

  /**
   * 渲染音译文本
   * @param ctx Canvas上下文
   * @param line 歌词行数据（用于判断对齐方式）
   * @param isActive 是否为激活行
   */
  private renderRoman(
    ctx: CanvasRenderingContext2D,
    line: LyricLine,
    isActive: boolean
  ): void {
    ctx.save();

    ctx.font = `normal 12vp ${this.normalFont}`;
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

    ctx.fillText(line.romanLyric, x, 50);

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
   * 三个圆点依次跳动的效果
   * @param positionY Y轴位置
   * @param dotOpacities 圆点透明度数组
   * @param dotScales 圆点缩放数组
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

    // 🎵 左对齐，与歌词对齐方式一致
    const leftMargin: number = 40;
    const startX: number = leftMargin;
    const spacing: number = 12;
    const dotRadius: number = 4;

    // 渲染三个圆点
    for (let i: number = 0; i < 3; i++) {
      const x: number = startX + i * spacing;
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
