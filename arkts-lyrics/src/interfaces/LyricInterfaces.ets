/**
 * 鸿蒙ArkTS版本 - Apple Music风格歌词组件
 * 核心接口定义
 */

/**
 * 歌词单词接口
 */
export interface LyricWord {
  /** 开始时间 (毫秒) */
  startTime: number;
  /** 结束时间 (毫秒) */
  endTime: number;
  /** 单词内容 */
  word: string;
  /** 音译内容 */
  romanWord?: string;
  /** 是否含不雅内容 */
  obscene?: boolean;
}

/**
 * 歌词行接口
 */
export interface LyricLine {
  /** 单词数组 */
  words: LyricWord[];
  /** 翻译歌词 */
  translatedLyric?: string;
  /** 音译歌词 */
  romanLyric?: string;
  /** 起始时间 (毫秒) */
  startTime: number;
  /** 结束时间 (毫秒) */
  endTime: number;
  /** 是否为背景歌词 */
  isBG?: boolean;
  /** 是否为对唱行 (右对齐) */
  isDuet?: boolean;
}

/**
 * 歌词播放器配置
 */
export interface LyricPlayerConfig {
  /** 对齐锚点: 'top' | 'center' | 'bottom' */
  alignAnchor?: string;
  /** 对齐位置 (0-1) */
  alignPosition?: number;
  /** 是否启用缩放效果 */
  enableScale?: boolean;
  /** 是否启用模糊效果 */
  enableBlur?: boolean;
  /** 是否启用弹簧动画 */
  enableSpring?: boolean;
  /** 单词渐变宽度 (0-1) */
  wordFadeWidth?: number;
  /** 是否隐藏已播放歌词 */
  hidePassed?: boolean;
  /** 是否显示翻译 */
  showTranslation?: boolean;
  /** 是否显示音译 */
  showRoman?: boolean;
}

/**
 * 歌词行状态
 */
export interface LyricLineState {
  /** 歌词行数据 */
  line: LyricLine;
  /** 行索引 */
  index: number;
  /** Y轴位置 */
  positionY: number;
  /** 缩放比例 (0-100) */
  scale: number;
  /** 透明度 (0-1) */
  opacity: number;
  /** 模糊度 */
  blur: number;
  /** 是否激活 */
  isActive: boolean;
  /** 是否在视图中 */
  isInView: boolean;
}

/**
 * 间奏信息
 */
export interface InterludeInfo {
  /** 是否显示间奏 */
  show: boolean;
  /** Y轴位置 */
  positionY: number;
  /** 上一行索引 */
  prevIndex: number;
  /** 下一行索引 */
  nextIndex: number;
}

/**
 * 弹簧动画参数
 */
export interface SpringConfig {
  /** 质量 */
  mass?: number;
  /** 刚度 */
  stiffness?: number;
  /** 阻尼 */
  damping?: number;
}
