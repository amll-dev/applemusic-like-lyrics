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

/**
 * 解析 QRC 格式的歌词字符串
 * @param qrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseQrc(qrc: string): LyricLine[] {
	const wordPattern = /(.*?)\((\d+),(\d+)\)/g;
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

			const words: LyricWord[] = [];
			const lineContent = lineStr.slice(linePrefix.length).trim();
			if (!lineContent) return null;

			for (const wordMatch of lineContent.matchAll(wordPattern)) {
				const [, wordText, wordStartStr, wordDurStr] = wordMatch;
				const wordStart = Number(wordStartStr);
				const wordDur = Number(wordDurStr);

				words.push(
					createWord({
						word: wordText,
						startTime: wordStart,
						endTime: wordStart + wordDur,
					}),
				);
			}

			const isBG =
				words.length > 0 &&
				/^[(（]/.test(words[0].word) &&
				/[）)]$/.test(words[words.length - 1].word);

			if (isBG) {
				words[0].word = words[0].word.replace(/^[(（]/, "");
				words[words.length - 1].word = words[words.length - 1].word.replace(
					/[）)]$/,
					"",
				);
			}

			return createLine({
				startTime: lineStart,
				endTime: lineStart + lineDuration,
				words,
				isBG,
			});
		})
		.filter((line) => line !== null);
}

/**
 * 将歌词数组转换为 QRC 格式的字符串
 * @param lines 歌词数组
 * @returns QRC 格式的字符串
 */
export function stringifyQrc(lines: LyricLine[]): string {
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
