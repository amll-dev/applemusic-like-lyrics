/**
 * @fileoverview QRC（QQ 音乐逐词歌词）格式解析与生成。
 * 行开头为 [startTime,duration]，每个词为 word(startTime,duration)
 *
 * 格式示例：
 * [190871,1984]For (190871,361)the (191232,172)first (191404,376)time(191780,1075)
 * [193459,4198]What's (193459,412)past (193871,574)is (194445,506)past(194951,2706)
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
 * 解析 QRC 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseQRC(qrc: string): LyricLine[] {
	const wordPattern = /^(.*?)\((\d+),(\d+)\)/;
	const linePattern = /^\[(\d+),(\d+)\]/;

	const lines = qrc
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
			const lineEnd = lineStart + lineDuration;

			const words: LyricWord[] = [];
			let lineContent = lineStr.slice(linePrefix.length);
			let lastEnd = lineStart;
			while (true) {
				const wordMatch = lineContent.match(wordPattern);
				if (!wordMatch) break;
				const [fullMatch, wordText, wordStartStr, wordDurStr] = wordMatch;
				const wordStart = Number(wordStartStr);
				const wordDur = Number(wordDurStr);
				const wordEnd = wordStart + wordDur;
				words.push(
					createWord({
						word: wordText,
						startTime: wordStart,
						endTime: wordEnd,
					}),
				);
				lineContent = lineContent.slice(fullMatch.length);
				lastEnd = wordEnd;
			}
			if (lineContent.trim())
				words.push(
					createWord({
						word: lineContent,
						startTime: lastEnd,
						endTime: lastEnd < lineEnd ? lineEnd : lastEnd,
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

/**
 * 将歌词数组转换为 QRC 格式的字符串
 * @param lines 歌词数组
 * @returns QRC 格式的字符串
 */
export function stringifyQRC(lines: LyricLine[]): string {
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
				let printedWord = word;
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
					`${printedWord}(${normalizedWordStart},${wordDuration})`,
				);
			}

			return `[${lineStart},${lineDuration}]${lineWords.join("")}`;
		})
		.join("\n");
}
