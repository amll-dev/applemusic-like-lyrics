/**
 * @fileoverview Lyricify Lines（LYL）格式解析与生成。
 * 该格式为行级结构，每行使用 `[start,end]` 表示时间区间。
 *
 * 格式示例：
 * [type:LyricifyLines]
 * [54260,57380]Stop and stare
 * [57380,62840]I think I'm moving but I go nowhere
 */
import type { LyricLine } from "../types";
import { createLine, createWord, normalizeTimestamp } from "../utils";

/**
 * 解析 LYL 格式的歌词字符串
 * @param lyl 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLyl(lyl: string): LyricLine[] {
	const lines = lyl
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	const timeRegex = /^\[(\d+),(\d+)\](.*)$/;
	const bgRegex = /^[(（](.+)[)）]$/;

	for (const lineStr of lines) {
		if (lineStr === "[type:LyricifyLines]") continue;

		const timeMatch = lineStr.match(timeRegex);
		if (!timeMatch) continue;

		const [, startStr, endStr, text] = timeMatch;
		const startTime = Number(startStr);
		const endTime = Number(endStr);

		const backgroundMatch = text.match(bgRegex);
		const isBG = Boolean(backgroundMatch);
		const textContent = (backgroundMatch ? backgroundMatch[1] : text).trim();
		if(!textContent) continue;

		lyricLines.push(
			createLine({
				startTime,
				endTime,
				isBG,
				words: [createWord({ word: textContent, startTime, endTime })],
			}),
		);
	}

	return lyricLines;
}

/**
 * 将歌词数组转换为 LYL 格式的字符串
 * @param lines 歌词数组
 * @returns LYL 格式的字符串
 */
export function stringifyLyl(lines: LyricLine[]): string {
	const header = "[type:LyricifyLines]";
	const body = lines.map((line) => {
		const text = line.words.map((w) => w.word).join("");
		const printText = line.isBG ? `(${text})` : text;
		return `[${normalizeTimestamp(line.startTime)},${normalizeTimestamp(line.endTime)}]${printText}`;
	});
	return [header, ...body].join("\n");
}
