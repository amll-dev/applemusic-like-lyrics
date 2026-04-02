import type { LyricLine } from "../types";
import {
	createLine,
	createWord,
	formatTime,
	pairwise,
	parseTime,
} from "../utils";

/**
 * 解析 LyRiC 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLRC(lrc: string): LyricLine[] {
	const tagRegex = /^\[([a-z]+):([^\]]+)\]$/;
	const timeRegex = /^\[((?:\d+:)*\d+(?:\.\d+)?)\](.*)$/;
	const bgRegex = /^[(（](.+)[)）]$/;
	const lines = lrc
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	for (let lineStr of lines) {
		if (lineStr.startsWith("#") || lineStr.startsWith("{")) continue;
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
					endTime: t,
					words: [createWord({ word: lineStr, startTime: t, endTime: t })],
					isBG,
				}),
			);
	}
	lyricLines.sort((a, b) => a.startTime - b.startTime);
	for (const [prev, curr] of pairwise(lyricLines))
		prev.endTime = prev.words[0].endTime = curr.startTime;
	return lyricLines;
}

/**
 * 将歌词数组转换为 LyRiC 格式的字符串
 * @param lines 歌词数组
 * @returns LyRiC 格式的字符串
 */
export function stringifyLRC(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			const text = line.words.map((w) => w.word).join("");
			const printText = line.isBG ? `(${text})` : text;
			return `[${formatTime(line.startTime)}]${printText}`;
		})
		.join("\n");
}
