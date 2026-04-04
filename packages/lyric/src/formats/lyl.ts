import type { LyricLine } from "../types";
import { createLine, createWord } from "../utils";

/**
 * 解析 LYL 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLYL(lyl: string): LyricLine[] {
	const lines = lyl
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	const timeRegex = /^\[(\d+),(\d+)\](.*)$/;
	const bgRegex = /^[(（](.+)[)）]$/;

	for (const lineStr of lines) {
		if (lineStr.startsWith("#") || lineStr.startsWith("{")) continue;
		if (lineStr === "[type:LyricifyLines]") continue;

		const timeMatch = lineStr.match(timeRegex);
		if (!timeMatch) continue;

		const [, startStr, endStr, text] = timeMatch;
		const startTime = Number(startStr);
		const endTime = Number(endStr);

		const backgroundMatch = text.match(bgRegex);
		const isBG = Boolean(backgroundMatch);
		const textContent = (backgroundMatch ? backgroundMatch[1] : text).trim();

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
export function stringifyLYL(lines: LyricLine[]): string {
	const header = "[type:LyricifyLines]";
	const body = lines.map((line) => {
		const text = line.words.map((w) => w.word).join("");
		const printText = line.isBG ? `(${text})` : text;
		return `[${line.startTime},${line.endTime}]${printText}`;
	});
	return [header, ...body].join("\n");
}
