/**
 * 歌词工具函数
 */

import { LyricWord, LyricLine } from '../interfaces/LyricInterfaces';

/**
 * 判断字符是否为CJK字符（中日韩）
 */
export function isCJK(char: string): boolean {
  if (!char || char.length === 0) {
    return false;
  }
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||     // CJK统一汉字
    (code >= 0x3400 && code <= 0x4DBF) ||     // CJK扩展A
    (code >= 0x20000 && code <= 0x2A6DF) ||   // CJK扩展B
    (code >= 0xF900 && code <= 0xFAFF) ||     // CJK兼容汉字
    (code >= 0x2F800 && code <= 0x2FA1F) ||   // CJK兼容扩展
    (code >= 0x3040 && code <= 0x309F) ||     // 平假名
    (code >= 0x30A0 && code <= 0x30FF) ||     // 片假名
    (code >= 0xAC00 && code <= 0xD7AF)        // 韩文音节
  );
}

/**
 * 判断单词是否需要强调效果
 */
export function shouldEmphasize(word: LyricWord): boolean {
  const duration = word.endTime - word.startTime;
  const wordLength = word.word.length;

  if (isCJK(word.word)) {
    // CJK字符：时长 >= 1000ms
    return duration >= 1000;
  } else {
    // 其他字符：时长 >= 1000ms 且长度 1-7
    return duration >= 1000 && wordLength >= 1 && wordLength <= 7;
  }
}

/**
 * 计算单词在整行中的进度 (0-1)
 */
export function getWordProgress(word: LyricWord, currentTime: number): number {
  if (currentTime <= word.startTime) {
    return 0;
  }
  if (currentTime >= word.endTime) {
    return 1;
  }
  return (currentTime - word.startTime) / (word.endTime - word.startTime);
}

/**
 * 计算歌词行的进度 (0-1)
 */
export function getLineProgress(line: LyricLine, currentTime: number): number {
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
 * 缓动函数 - easeOutCubic
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 缓动函数 - easeInOutCubic
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 处理歌词行数据，调整起始时间
 */
export function processLyricLines(lines: LyricLine[]): LyricLine[] {
  const processed: LyricLine[] = [...lines];

  // 将行开始时间提前最多1秒，使歌词提前显示
  for (let i = processed.length - 1; i >= 0; i--) {
    const line = processed[i];
    if (line.isBG) {
      continue;
    }

    const prevLine = processed[i - 1];
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
 * 计算模糊度
 */
export function calculateBlur(distance: number, maxDistance: number): number {
  if (distance === 0) {
    return 0;
  }
  const ratio = Math.abs(distance) / maxDistance;
  return Math.min(ratio * 10, 10);
}
