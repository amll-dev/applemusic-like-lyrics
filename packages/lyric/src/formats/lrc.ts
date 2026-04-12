/**
 * @fileoverview 基础 LRC 格式解析与生成。
 * 该格式只支持行级时间戳，不支持词级/音节级时间戳；若需要词级时间戳请使用 LRC A2 等扩展。
 *
 * 格式示例：
 * [01:56.439]Life goes on, through tides of time
 * [02:01.079]Get in the line, to dream alive
 * [02:06.103][02:08.916][02:11.135]On the journey
 */
import type { LyricLine } from "../types";
import {
	createLine,
	createWord,
	formatTime,
	MAX_LRC_TIMESTAMP,
	normalizeTimestamp,
	pairwise,
	parseTime,
} from "../utils";

/**
 * 解析 LyRiC 格式的歌词字符串
 * @param lrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLrc(lrc: string): LyricLine[] {
	const tagRegex = /^\[([a-z]+):([^\]]+)\]$/;
	const timeRegex = /^\[((?:\d+:)*\d+(?:\.\d+)?)\](.*)$/;
	const bgRegex = /^[(（](.+)[)）]$/;
	const lines = lrc
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	for (let lineStr of lines) {
		if (tagRegex.test(lineStr)) continue;
		const timeStamps: number[] = [];
		while (true) {
			const match = lineStr.match(timeRegex);
			if (!match) break;
			const [, timeStr, text] = match;
			const timeStamp = parseTime(timeStr);
			if (Number.isNaN(timeStamp)) break;
			timeStamps.push(timeStamp);
			lineStr = text;
		}
		if (timeStamps.length === 0) continue;
		lineStr = lineStr.trim();
		const backgroundMatch = lineStr.match(bgRegex);
		const isBG = Boolean(backgroundMatch);
		if (backgroundMatch) lineStr = backgroundMatch[1];
		for (const t of timeStamps)
			lyricLines.push(
				createLine({
					startTime: t,
					endTime: MAX_LRC_TIMESTAMP,
					words: [createWord({ word: lineStr, startTime: t, endTime: t })],
					isBG,
				}),
			);
	}
	lyricLines.sort((a, b) => a.startTime - b.startTime);
	for (const [prev, curr] of pairwise(lyricLines))
		prev.endTime = prev.words[0].endTime = curr.startTime;
	return lyricLines.filter((line) => line.words[0].word);
}

/**
 * 将歌词数组转换为 LyRiC 格式的字符串
 * @param lines 歌词数组
 * @returns LyRiC 格式的字符串
 */
export function stringifyLrc(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			const text = line.words.map((w) => w.word).join("");
			const printText = line.isBG ? `(${text})` : text;
			return `[${formatTime(normalizeTimestamp(line.startTime))}]${printText}`;
		})
		.join("\n");
}
