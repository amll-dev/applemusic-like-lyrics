/**
 * 鸿蒙ArkTS版本 - 歌词数据模型
 * 严格符合ArkTS类型规范
 */

/**
 * 歌词单词类
 */
export class LyricWord {
  startTime: number = 0;
  endTime: number = 0;
  word: string = '';
  romanWord: string = '';
  obscene: boolean = false;

  constructor(
    startTime: number,
    endTime: number,
    word: string,
    romanWord: string = '',
    obscene: boolean = false
  ) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.word = word;
    this.romanWord = romanWord;
    this.obscene = obscene;
  }

  static fromJson(json: Record<string, Object>): LyricWord {
    return new LyricWord(
      json['startTime'] as number,
      json['endTime'] as number,
      json['word'] as string,
      json['romanWord'] as string ?? '',
      json['obscene'] as boolean ?? false
    );
  }
}

/**
 * 歌词行类
 */
export class LyricLine {
  words: LyricWord[] = [];
  translatedLyric: string = '';
  romanLyric: string = '';
  startTime: number = 0;
  endTime: number = 0;
  isBG: boolean = false;
  isDuet: boolean = false;

  constructor(
    words: LyricWord[],
    startTime: number,
    endTime: number,
    translatedLyric: string = '',
    romanLyric: string = '',
    isBG: boolean = false,
    isDuet: boolean = false
  ) {
    this.words = words;
    this.startTime = startTime;
    this.endTime = endTime;
    this.translatedLyric = translatedLyric;
    this.romanLyric = romanLyric;
    this.isBG = isBG;
    this.isDuet = isDuet;
  }

  static fromJson(json: Record<string, Object>): LyricLine {
    const wordsJson = json['words'] as Array<Record<string, Object>>;
    const words: LyricWord[] = wordsJson.map((w: Record<string, Object>) => LyricWord.fromJson(w));

    return new LyricLine(
      words,
      json['startTime'] as number,
      json['endTime'] as number,
      json['translatedLyric'] as string ?? '',
      json['romanLyric'] as string ?? '',
      json['isBG'] as boolean ?? false,
      json['isDuet'] as boolean ?? false
    );
  }
}

/**
 * 播放器配置类
 */
export class LyricPlayerConfig {
  alignAnchor: string = 'center';
  alignPosition: number = 0.5;
  enableScale: boolean = true;
  enableBlur: boolean = true;
  enableSpring: boolean = true;
  wordFadeWidth: number = 0.5;
  hidePassed: boolean = false;
  showTranslation: boolean = true;
  showRoman: boolean = false;
  enableEmphasize: boolean = true;
  enableGlow: boolean = true;
  useCanvas: boolean = true;

  constructor() {
  }

  static create(options?: Partial<LyricPlayerConfig>): LyricPlayerConfig {
    const config = new LyricPlayerConfig();
    if (options) {
      Object.keys(options).forEach((key: string) => {
        (config as ESObject)[key] = (options as ESObject)[key];
      });
    }
    return config;
  }
}

/**
 * 歌词行渲染状态
 */
export class LyricLineRenderState {
  line: LyricLine;
  index: number;
  /** 基础位置Y（静态布局计算） */
  positionY: number = 0;
  /** 🎵 动画后的位置Y（波浪效果，每行独立的弹簧动画） */
  animatedPositionY: number = 0;
  /** Y轴偏移量（用于已播放歌词的抬升效果） */
  yOffset: number = 0;
  /** 波动动画偏移量（逐行抬升效果） */
  waveOffset: number = 0;
  /** 波动动画目标值 */
  waveTarget: number = 0;
  /** 波动动画速度 */
  waveVelocity: number = 0;
  /** 延迟队列中的目标值 */
  queuedWaveTarget: number = 0;
  /** 延迟剩余时间（秒） */
  waveDelay: number = 0;
  scaleRatio: number = 0.97;
  alphaValue: number = 0.2;
  blurRadius: number = 0;
  isActive: boolean = false;
  isInView: boolean = true;
  /** 🎵 计算后的行高（考虑换行） */
  calculatedHeight: number = 0;
  /** 🎵 主歌词的行数（换行后） */
  mainLyricLines: number = 1;

  constructor(line: LyricLine, index: number) {
    this.line = line;
    this.index = index;
  }
}

/**
 * 单词渲染信息
 */
export class WordRenderInfo {
  word: LyricWord;
  x: number = 0;
  y: number = 0;
  width: number = 0;
  height: number = 0;
  progress: number = 0;
  shouldEmphasize: boolean = false;
  emphasizeScale: number = 1.0;
  glowIntensity: number = 0;

  constructor(word: LyricWord) {
    this.word = word;
  }
}

/**
 * 间奏动画状态
 */
export class InterludeState {
  visible: boolean = false;
  positionY: number = 0;
  prevLineIndex: number = -1;
  nextLineIndex: number = -1;
  dotOpacities: number[] = [0.3, 0.3, 0.3];
  dotScales: number[] = [1.0, 1.0, 1.0];

  constructor() {
  }
}

/**
 * Canvas渲染上下文配置
 */
export class CanvasRenderContext {
  width: number = 0;
  height: number = 0;
  pixelRatio: number = 1.0;

  constructor(width: number, height: number, pixelRatio: number = 1.0) {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
  }
}

/**
 * 渲染器配置类
 * 用于传递渲染配置，避免对象字面量类型错误
 */
export class RendererConfig {
  /** 是否启用强调效果 */
  enableEmphasize: boolean = true;
  /** 是否启用辉光效果 */
  enableGlow: boolean = true;
  /** 是否显示翻译 */
  showTranslation: boolean = true;
  /** 是否显示音译 */
  showRoman: boolean = false;

  constructor(
    enableEmphasize: boolean = true,
    enableGlow: boolean = true,
    showTranslation: boolean = true,
    showRoman: boolean = false
  ) {
    this.enableEmphasize = enableEmphasize;
    this.enableGlow = enableGlow;
    this.showTranslation = showTranslation;
    this.showRoman = showRoman;
  }

  /**
   * 从播放器配置创建渲染器配置
   */
  static fromPlayerConfig(playerConfig: LyricPlayerConfig): RendererConfig {
    return new RendererConfig(
      playerConfig.enableEmphasize,
      playerConfig.enableGlow,
      playerConfig.showTranslation,
      playerConfig.showRoman
    );
  }
}
