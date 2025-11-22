/**
 * 歌词解析工具
 * 解析网易云音乐 YRC 格式逐字歌词
 */

import { LyricLine, LyricWord } from '../models/LyricModels';

/**
 * 网易云音乐歌词 API 响应结构
 */
export interface NeteaseApiResponse {
  lrc?: LrcData;
  tlyric?: LrcData;
  romalrc?: LrcData;
  yrc?: LrcData;
  code: number;
}

interface LrcData {
  version: number;
  lyric: string;
}

/**
 * 解析网易云音乐歌词 API 响应
 * @param response API 响应 JSON 字符串或对象
 * @returns LyricLine[] 歌词行数组
 */
export function parseLyricResponse(response: string | NeteaseApiResponse): LyricLine[] {
  let data: NeteaseApiResponse;

  if (typeof response === 'string') {
    try {
      data = JSON.parse(response) as NeteaseApiResponse;
    } catch (e) {
      console.error('[LyricParser] JSON 解析失败:', e);
      return [];
    }
  } else {
    data = response;
  }

  // 优先使用 YRC 逐字歌词
  if (data.yrc && data.yrc.lyric) {
    const lines: LyricLine[] = parseYrcLyric(data.yrc.lyric);

    // 合并翻译歌词
    if (data.tlyric && data.tlyric.lyric) {
      mergeTranslation(lines, data.tlyric.lyric);
    }

    // 合并音译歌词
    if (data.romalrc && data.romalrc.lyric) {
      mergeRomanLyric(lines, data.romalrc.lyric);
    }

    console.info(`[LyricParser] 解析完成: ${lines.length} 行歌词`);
    return lines;
  }

  // 降级使用普通 LRC 歌词
  if (data.lrc && data.lrc.lyric) {
    console.info('[LyricParser] 使用普通 LRC 歌词（无逐字）');
    return parseLrcLyric(data.lrc.lyric);
  }

  console.warn('[LyricParser] 无可用歌词数据');
  return [];
}

/**
 * 解析 YRC 格式逐字歌词
 * 格式: [startTime,duration](wordStart,wordDuration,param)word ...
 * 例如: [540,1320](540,390,0)Mad (930,540,0)about (1470,390,0)you
 */
function parseYrcLyric(yrcContent: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lineRegex: RegExp = /\[(\d+),(\d+)\](.*)/g;

  let match: RegExpExecArray | null = lineRegex.exec(yrcContent);
  while (match !== null) {
    const startTime: number = parseInt(match[1]);
    const duration: number = parseInt(match[2]);
    const wordsPart: string = match[3];

    // 解析单词
    const words: LyricWord[] = parseYrcWords(wordsPart);

    // 计算行结束时间
    let endTime: number = startTime + duration;
    if (words.length > 0) {
      const lastWord: LyricWord = words[words.length - 1];
      endTime = Math.max(endTime, lastWord.endTime);
    }

    const line: LyricLine = new LyricLine(words, startTime, endTime);
    lines.push(line);

    match = lineRegex.exec(yrcContent);
  }

  // 按开始时间排序
  lines.sort((a: LyricLine, b: LyricLine) => a.startTime - b.startTime);

  // 🎵 自动插入间奏行
  const linesWithInterlude: LyricLine[] = insertInterludeLines(lines);

  return linesWithInterlude;
}

/**
 * 自动插入间奏行
 * 当两行歌词之间的时间间隔超过阈值时，插入一个空白行作为间奏
 * @param lines 原始歌词行数组
 * @param minGap 最小间隔阈值（毫秒），默认 3500ms
 * @returns 包含间奏行的歌词数组
 */
function insertInterludeLines(lines: LyricLine[], minGap: number = 3500): LyricLine[] {
  if (lines.length === 0) {
    return lines;
  }

  const result: LyricLine[] = [];

  for (let i: number = 0; i < lines.length; i++) {
    const currentLine: LyricLine = lines[i];

    // 检查与上一行的时间间隔
    if (i > 0) {
      const prevLine: LyricLine = lines[i - 1];
      const gap: number = currentLine.startTime - prevLine.endTime;

      // 如果间隔超过阈值，插入间奏行
      if (gap >= minGap) {
        // 间奏行：words 为空数组
        const interludeLine: LyricLine = new LyricLine(
          [],  // 空单词数组表示间奏
          prevLine.endTime,  // 从上一行结束开始
          currentLine.startTime  // 到下一行开始结束
        );
        result.push(interludeLine);

        console.info(`[LyricParser] 🎵 插入间奏: ${prevLine.endTime}ms → ${currentLine.startTime}ms (${gap}ms)`);
      }
    }

    result.push(currentLine);
  }

  return result;
}

/**
 * 解析 YRC 行内的单词
 * 格式: (wordStart,wordDuration,param)word
 */
function parseYrcWords(wordsPart: string): LyricWord[] {
  const words: LyricWord[] = [];
  // 匹配 (startTime,duration,param)word 格式
  const wordRegex: RegExp = /\((\d+),(\d+),\d+\)([^(]*)/g;

  let match: RegExpExecArray | null = wordRegex.exec(wordsPart);
  while (match !== null) {
    const wordStartTime: number = parseInt(match[1]);
    const wordDuration: number = parseInt(match[2]);
    const wordText: string = match[3];

    // 跳过空单词（但保留空格）
    if (wordText.length > 0) {
      // LyricWord 构造函数: (startTime, endTime, word)
      const word: LyricWord = new LyricWord(
        wordStartTime,
        wordStartTime + wordDuration,
        wordText
      );
      words.push(word);
    }

    match = wordRegex.exec(wordsPart);
  }

  return words;
}

/**
 * 临时歌词行数据（用于 LRC 解析）
 */
class TempLrcLine {
  time: number;
  text: string;

  constructor(time: number, text: string) {
    this.time = time;
    this.text = text;
  }
}

/**
 * 解析普通 LRC 歌词（降级方案）
 * 格式: [mm:ss.xx]歌词文本
 */
function parseLrcLyric(lrcContent: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lineRegex: RegExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;

  const tempLines: TempLrcLine[] = [];

  let match: RegExpExecArray | null = lineRegex.exec(lrcContent);
  while (match !== null) {
    const minutes: number = parseInt(match[1]);
    const seconds: number = parseInt(match[2]);
    let milliseconds: number = parseInt(match[3]);
    // 处理两位数毫秒
    if (match[3].length === 2) {
      milliseconds *= 10;
    }

    const startTime: number = minutes * 60000 + seconds * 1000 + milliseconds;
    const text: string = match[4].trim();

    if (text.length > 0) {
      const tempLine: TempLrcLine = new TempLrcLine(startTime, text);
      tempLines.push(tempLine);
    }

    match = lineRegex.exec(lrcContent);
  }

  // 按时间排序
  tempLines.sort((a: TempLrcLine, b: TempLrcLine): number => a.time - b.time);

  // 转换为 LyricLine（整行作为一个单词）
  for (let i: number = 0; i < tempLines.length; i++) {
    const current: TempLrcLine = tempLines[i];
    const nextIndex: number = i + 1;
    let endTime: number = current.time + 5000;
    if (nextIndex < tempLines.length) {
      endTime = tempLines[nextIndex].time;
    }

    // LyricWord 构造函数: (startTime, endTime, word)
    const word: LyricWord = new LyricWord(current.time, endTime, current.text);
    const line: LyricLine = new LyricLine([word], current.time, endTime);
    lines.push(line);
  }

  return lines;
}

/**
 * 合并翻译歌词
 */
function mergeTranslation(lines: LyricLine[], tlyricContent: string): void {
  const translations: Map<number, string> = parseTimedText(tlyricContent);

  lines.forEach((line: LyricLine) => {
    // 查找最接近的翻译
    let closestTime: number = -1;
    let minDiff: number = Number.MAX_VALUE;

    translations.forEach((text: string, time: number) => {
      const diff: number = Math.abs(time - line.startTime);
      if (diff < minDiff && diff < 1000) { // 1秒内的匹配
        minDiff = diff;
        closestTime = time;
      }
    });

    if (closestTime >= 0) {
      line.translatedLyric = translations.get(closestTime) || '';
    }
  });
}

/**
 * 合并音译歌词
 */
function mergeRomanLyric(lines: LyricLine[], romaContent: string): void {
  const romans: Map<number, string> = parseTimedText(romaContent);

  lines.forEach((line: LyricLine) => {
    let closestTime: number = -1;
    let minDiff: number = Number.MAX_VALUE;

    romans.forEach((text: string, time: number) => {
      const diff: number = Math.abs(time - line.startTime);
      if (diff < minDiff && diff < 1000) {
        minDiff = diff;
        closestTime = time;
      }
    });

    if (closestTime >= 0) {
      line.romanLyric = romans.get(closestTime) || '';
    }
  });
}

/**
 * 解析带时间戳的文本（翻译/音译）
 * 格式: [mm:ss.xx]文本
 */
function parseTimedText(content: string): Map<number, string> {
  const result: Map<number, string> = new Map();
  const lineRegex: RegExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;

  let match: RegExpExecArray | null = lineRegex.exec(content);
  while (match !== null) {
    const minutes: number = parseInt(match[1]);
    const seconds: number = parseInt(match[2]);
    let milliseconds: number = parseInt(match[3]);
    if (match[3].length === 2) {
      milliseconds *= 10;
    }

    const time: number = minutes * 60000 + seconds * 1000 + milliseconds;
    const text: string = match[4].trim();

    if (text.length > 0 && !text.startsWith('作词') && !text.startsWith('作曲') && !text.startsWith('by:')) {
      result.set(time, text);
    }

    match = lineRegex.exec(content);
  }

  return result;
}
