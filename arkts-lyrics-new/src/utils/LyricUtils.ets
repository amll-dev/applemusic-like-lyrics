/**
 * 歌词工具函数库
 */

import { LyricWord, LyricLine } from '../models/LyricModels';

/**
 * 判断字符是否为CJK字符
 */
export function isCJKChar(char: string): boolean {
  if (!char || char.length === 0) {
    return false;
  }
  const code: number = char.charCodeAt(0);
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x20000 && code <= 0x2A6DF) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0x2F800 && code <= 0x2FA1F) ||
    (code >= 0x3040 && code <= 0x309F) ||
    (code >= 0x30A0 && code <= 0x30FF) ||
    (code >= 0xAC00 && code <= 0xD7AF)
  );
}

/**
 * 判断单词是否应该强调
 */
export function shouldEmphasizeWord(word: LyricWord): boolean {
  const duration: number = word.endTime - word.startTime;
  const wordLength: number = word.word.length;

  if (isCJKChar(word.word)) {
    return duration >= 1000;
  } else {
    return duration >= 1000 && wordLength >= 1 && wordLength <= 7;
  }
}

/**
 * 计算单词播放进度
 */
export function calculateWordProgress(word: LyricWord, currentTime: number): number {
  if (currentTime <= word.startTime) {
    return 0;
  }
  if (currentTime >= word.endTime) {
    return 1;
  }
  return (currentTime - word.startTime) / (word.endTime - word.startTime);
}

/**
 * 计算行播放进度
 */
export function calculateLineProgress(line: LyricLine, currentTime: number): number {
  if (currentTime <= line.startTime) {
    return 0;
  }
  if (currentTime >= line.endTime) {
    return 1;
  }
  return (currentTime - line.startTime) / (line.endTime - line.startTime);
}

/**
 * 线性插值
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Clamp函数
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * easeOutCubic缓动
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * easeInOutCubic缓动
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * easeOutExpo缓动
 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * easeInOutBack缓动
 */
export function easeInOutBack(t: number): number {
  const c1: number = 1.70158;
  const c2: number = c1 * 1.525;

  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

/**
 * 处理歌词行数据
 */
export function processLyricLines(lines: LyricLine[]): LyricLine[] {
  const processed: LyricLine[] = lines.slice();

  for (let i = processed.length - 1; i >= 0; i--) {
    const line: LyricLine = processed[i];
    if (line.isBG) {
      continue;
    }

    const prevLine: LyricLine | undefined = i > 0 ? processed[i - 1] : undefined;
    if (prevLine) {
      line.startTime = Math.max(
        Math.min(prevLine.endTime, line.startTime),
        line.startTime - 1000
      );
    }
  }

  return processed;
}

/**
 * 计算模糊半径
 */
export function calculateBlurRadius(distance: number, maxDistance: number): number {
  if (distance === 0) {
    return 0;
  }
  const ratio: number = Math.abs(distance) / maxDistance;
  return Math.min(ratio * 10, 10);
}

/**
 * 计算强调缩放
 */
export function calculateEmphasizeScale(progress: number): number {
  if (progress <= 0 || progress >= 1) {
    return 1.0;
  }
  return 1.0 + 0.15 * Math.sin(progress * Math.PI);
}

/**
 * 计算辉光强度
 */
export function calculateGlowIntensity(progress: number): number {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }
  return Math.sin(progress * Math.PI) * 0.8;
}

/**
 * RGB转十六进制
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const hex: string = Math.floor(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 计算单词颜色（渐变效果）
 */
export function calculateWordColor(progress: number, isActive: boolean): string {
  if (!isActive) {
    return '#666666';
  }

  if (progress >= 1) {
    return '#FFFFFF';
  } else if (progress > 0) {
    const gray: number = 128 + 127 * progress;
    return rgbToHex(gray, gray, gray);
  } else {
    return '#888888';
  }
}
