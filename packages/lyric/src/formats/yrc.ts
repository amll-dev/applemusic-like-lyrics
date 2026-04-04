/**
 * @fileoverview YRC（网易云音乐逐词歌词）格式解析与生成。
 * 行开头为 [startTime,duration]，每个词为 (startTime,duration,0)word
 *
 * 格式示例：
 * [190871,1984](190871,361,0)For (191232,172,0)the (191404,376,0)first (191780,1075,0)time
 * [193459,4198](193459,412,0)What's (193871,574,0)past (194445,506,0)is (194951,2706,0)past
 */
import type { LyricLine, LyricWord } from "../types";
import { createLine, createWord } from "../utils";

/**
 * 解析 YRC 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseYRC(yrc: string): LyricLine[] {
	const lines = yrc
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	return lines
		.map((lineStr) => {
			const lineMatch = lineStr.match(/^\[(\d+),(\d+)\]/);
			if (!lineMatch) return null;
			const [linePrefix, lineStartStr, lineDurStr] = lineMatch;

			const wordPattern = /\((\d+),(\d+),0\)([^(]*)/g;
			const wordMatches = lineStr
				.slice(linePrefix.length)
				.matchAll(wordPattern);
			const words = [...wordMatches].flatMap((match) => {
				const [, wordStartStr, wordDurStr, wordText] = match;
				if (
					wordStartStr === undefined ||
					wordDurStr === undefined ||
					wordText === undefined
				)
					return [];

				const startTime = Number(wordStartStr);
				const endTime = startTime + Number(wordDurStr);
				const trimmedText = wordText.trim();

				const createdWords: LyricWord[] = [
					createWord({ word: trimmedText, startTime, endTime }),
				];
				if (wordText.startsWith(" "))
					createdWords.unshift(createWord({ word: " " }));
				if (wordText.endsWith(" "))
					createdWords.push(createWord({ word: " " }));
				return createdWords;
			});

			const lineStart = Number(lineStartStr);
			const lineDuration = Number(lineDurStr);
			return createLine({
				startTime: lineStart,
				endTime: lineStart + lineDuration,
				words,
			});
		})
		.filter((line): line is LyricLine => line !== null);
}

function makeParenthesesFull(text: string): string {
	return text.replace(/\(/g, "（").replace(/\)/g, "）");
}

/**
 * 将歌词数组转换为 YRC 格式的字符串
 * @param lines 歌词数组
 * @returns YRC 格式的字符串
 */
export function stringifyYRC(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			const lineStart = line.startTime;
			const lineDuration = line.endTime - line.startTime;

			const lineWords: string[] = [];
			for (const { word, startTime, endTime } of line.words) {
				if (!word.trim() && lineWords.length) {
					lineWords[lineWords.length - 1] += word;
					continue;
				}
				const wordDuration = endTime - startTime;
				lineWords.push(
					`(${startTime},${wordDuration},0)${makeParenthesesFull(word)}`,
				);
			}

			if (line.isBG)
				return `[${lineStart},${lineDuration}]（${lineWords.join("")}）`;
			return `[${lineStart},${lineDuration}]${lineWords.join("")}`;
		})
		.join("\n");
}
