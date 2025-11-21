/**
 * 通用类型定义
 */

/**
 * 动画曲线类型
 */
export enum AnimationCurve {
  Linear,
  EaseIn,
  EaseOut,
  EaseInOut,
  FastOutSlowIn,
  LinearOutSlowIn,
  FastOutLinearIn,
  ExtremeDeceleration,
  Sharp,
  Rhythm,
  Smooth,
  Friction
}

/**
 * 对齐方式
 */
export enum AlignAnchor {
  Top = 'top',
  Center = 'center',
  Bottom = 'bottom'
}

/**
 * 歌词行状态枚举
 */
export enum LyricLineStatus {
  Idle,      // 空闲
  Active,    // 激活（正在播放）
  Passed,    // 已播放
  Pending    // 待播放
}

/**
 * 播放状态
 */
export enum PlaybackState {
  Playing,
  Paused,
  Stopped
}

/**
 * 颜色预设
 */
export class ColorPresets {
  static readonly PRIMARY_TEXT = '#FFFFFF';
  static readonly SECONDARY_TEXT = '#999999';
  static readonly INACTIVE_TEXT = '#666666';
  static readonly ACTIVE_TEXT = '#FFFFFF';
  static readonly BACKGROUND = '#000000';
  static readonly BACKGROUND_LIGHT = '#1a1a1a';
  static readonly ACCENT = '#1DB954'; // Spotify green
}

/**
 * 尺寸预设
 */
export class SizePresets {
  static readonly FONT_SIZE_MAIN = 20;
  static readonly FONT_SIZE_TRANSLATION = 14;
  static readonly FONT_SIZE_ROMAN = 12;
  static readonly LINE_HEIGHT_MIN = 60;
  static readonly LINE_HEIGHT_TRANSLATION = 20;
  static readonly LINE_HEIGHT_ROMAN = 16;
  static readonly PADDING_HORIZONTAL = 20;
  static readonly PADDING_VERTICAL = 12;
}

/**
 * 动画时长预设
 */
export class DurationPresets {
  static readonly FAST = 150;
  static readonly NORMAL = 300;
  static readonly SLOW = 500;
  static readonly INTERLUDE_THRESHOLD = 4000; // 间奏显示阈值
}
