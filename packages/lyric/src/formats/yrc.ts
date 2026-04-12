/**
 * @fileoverview YRC（网易云音乐逐词歌词）格式解析与生成。
 * 行开头为 [startTime,duration]，每个词为 (startTime,duration,0)word
 *
 * 格式示例：
 * [190871,1984](190871,361,0)For (191232,172,0)the (191404,376,0)first (191780,1075,0)time
 * [193459,4198](193459,412,0)What's (193871,574,0)past (194445,506,0)is (194951,2706,0)past
 */
import type { LyricLine, LyricWord } from "../types";
import {
	createLine,
	createWord,
	normalizeDuration,
	normalizeTimestamp,
} from "../utils";

const beginParenPattern = /^[（(]/;
const endParenPattern = /[）)]$/;
function checkIsBG(words: LyricWord[]): boolean {
	return (
		words.length > 0 &&
		beginParenPattern.test(words[0].word) &&
		endParenPattern.test(words[words.length - 1].word)
	);
}
function trimBGParentheses(words: LyricWord[]): void {
	words[0].word = words[0].word.slice(1);
	words[words.length - 1].word = words[words.length - 1].word.slice(0, -1);
}

/**
 * 解析 YRC 格式的歌词字符串
 * @param yrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseYrc(yrc: string): LyricLine[] {
	const wordPattern = /^(.*?)\((\d+),(\d+),0\)/;
	const linePattern = /^\[(\d+),(\d+)\]/;

	const lines = yrc
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	return lines
		.map((lineStr) => {
			const lineMatch = lineStr.match(linePattern);
			if (!lineMatch) return null;
			const [linePrefix, lineStartStr, lineDurStr] = lineMatch;
			const lineStart = Number(lineStartStr);
			const lineDuration = Number(lineDurStr);

			const words: LyricWord[] = [];
			let lineContent = lineStr.slice(linePrefix.length).trim();
			if (!lineContent) return null;

			let lastStart = -1;
			let lastEnd = -1;
			while (true) {
				const wordMatch = lineContent.match(wordPattern);
				if (!wordMatch) break;
				const [fullMatch, lastText, wordStartStr, wordDurStr] = wordMatch;
				if (lastText && lastStart !== -1)
					words.push(
						createWord({
							word: lastText,
							startTime: lastStart,
							endTime: lastEnd,
						}),
					);
				const wordStart = Number(wordStartStr);
				const wordDur = Number(wordDurStr);
				const wordEnd = wordStart + wordDur;
				[lastStart, lastEnd] = [wordStart, wordEnd];
				lineContent = lineContent.slice(fullMatch.length);
			}
			if (lastStart !== -1 && lineContent)
				words.push(
					createWord({
						word: lineContent,
						startTime: lastStart,
						endTime: lastEnd,
					}),
				);

			const isBG = checkIsBG(words);
			if (isBG) trimBGParentheses(words);
			return createLine({
				startTime: lineStart,
				endTime: lineStart + lineDuration,
				words,
				isBG,
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
export function stringifyYrc(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			const lineStart = normalizeTimestamp(line.startTime);
			const lineEnd = normalizeTimestamp(line.endTime);
			const lineDuration = normalizeDuration(lineEnd - lineStart);

			const lineWords: string[] = [];
			for (const [
				index,
				{ word, startTime, endTime },
			] of line.words.entries()) {
				if (!word.trim() && lineWords.length) {
					lineWords[lineWords.length - 1] += word;
					continue;
				}
				let printedWord = makeParenthesesFull(word);
				if (line.isBG) {
					if (index === 0) printedWord = `（${printedWord}`;
					if (index === line.words.length - 1) printedWord += "）";
				}
				const normalizedWordStart = normalizeTimestamp(startTime);
				const normalizedWordEnd = normalizeTimestamp(endTime);
				const wordDuration = normalizeDuration(
					normalizedWordEnd - normalizedWordStart,
				);
				lineWords.push(
					`(${normalizedWordStart},${wordDuration},0)${printedWord}`,
				);
			}
			return `[${lineStart},${lineDuration}]${lineWords.join("")}`;
		})
		.join("\n");
}
