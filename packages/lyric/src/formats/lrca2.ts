/**
 * @fileoverview LRC A2（增强 LRC）格式解析与生成。
 * 在普通 LRC 行级时间戳基础上，支持词级/音节级时间戳；同一行内时间需连续，词时间由左右时间戳界定。
 *
 * 格式示例：
 * [02:38.850]<02:38.850>Words <02:39.030>are <02:39.120>made <02:39.360>of <02:39.420>plastic<02:40.080>
 * [02:40.080]<02:40.080>Come <02:40.290>back <02:40.470>like <02:40.680>elastic<02:41.370>
 */
import type { LyricLine, LyricWord } from "../types";
import {
	createLine,
	createWord,
	formatTime,
	normalizeTimestamp,
	parseTime,
} from "../utils";

/**
 * 解析 LRC A2 格式的歌词字符串
 * @param lrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLrcA2(lrc: string): LyricLine[] {
	const lines = lrc
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	const lineTimeStampRegex = /^\[((?:\d+:)*\d+(?:\.\d+)?)\]/;
	const wordTimestampRegex = /<((?:\d+:)*\d+(?:\.\d+)?)>/;
	const wordTimestampPrefixRegex = /^<((?:\d+:)*\d+(?:\.\d+)?)>/;
	for (let lineStr of lines) {
		const tagMatch = lineStr.match(/^\[([a-z]):(.+)\]$/i);
		if (tagMatch) continue;
		const lineTimeStampmatch = lineStr.match(lineTimeStampRegex);
		if (!lineTimeStampmatch) continue;
		const [lineTimeStamp, lineTimeStr] = lineTimeStampmatch;
		const lineStartTime = parseTime(lineTimeStr);
		if (Number.isNaN(lineStartTime)) continue;
		lineStr = lineStr.slice(lineTimeStamp.length).trim();
		if (!lineStr) continue;

		const lineItems: (number | string)[] = [];
		while (lineStr.length) {
			const prefixedTimeStampMatch = lineStr.match(wordTimestampPrefixRegex);
			if (prefixedTimeStampMatch) {
				const [wordTimeStamp, wordTimeStr] = prefixedTimeStampMatch;
				const parsedWordTime = parseTime(wordTimeStr);
				if (!Number.isNaN(parsedWordTime)) lineItems.push(parsedWordTime);
				lineStr = lineStr.slice(wordTimeStamp.length);
				continue;
			}

			const nextWordTimeStampIndex = lineStr.search(wordTimestampRegex);
			const text =
				nextWordTimeStampIndex === -1
					? lineStr
					: lineStr.slice(0, nextWordTimeStampIndex);
			lineItems.push(text);
			lineStr = lineStr.slice(text.length);
		}

		const words: LyricWord[] = [];
		lineItems.forEach((item, index) => {
			if (typeof item === "number") return;
			const startTime = lineItems[index - 1] ?? lineStartTime;
			const endTime = lineItems[index + 1] ?? startTime;
			if (typeof startTime !== "number" || typeof endTime !== "number") return;
			if (item.startsWith(" ") && words[words.length - 1]?.word.trim())
				words.push(createWord({ word: " " }));
			words.push(createWord({ word: item.trim(), startTime, endTime }));
			if (item.endsWith(" ")) words.push(createWord({ word: " " }));
		});

		const lineEndTime = words[words.length - 1]?.endTime ?? lineStartTime;
		lyricLines.push(
			createLine({
				startTime: lineStartTime,
				endTime: lineEndTime,
				words,
			}),
		);
	}
	return lyricLines;
}

/**
 * 将歌词数组转换为 LRC A2 格式的字符串
 * @param lines 歌词数组
 * @returns LRC A2 格式的字符串
 */
export function stringifylrcA2(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			const normalizedLineStartTime = normalizeTimestamp(line.startTime);
			if (line.words.length === 0)
				return `[${formatTime(normalizedLineStartTime)}]`;
			const normalizedWords: {
				word: string;
				startTime: number;
				endTime: number;
			}[] = [];
			line.words.forEach((w) => {
				if (!w.word.trim() && normalizedWords.length) {
					normalizedWords[normalizedWords.length - 1].word += w.word;
					return;
				}
				normalizedWords.push({
					word: w.word,
					startTime: normalizeTimestamp(w.startTime),
					endTime: normalizeTimestamp(w.endTime),
				});
			});
			const lineItems: (number | string)[] = normalizedWords.flatMap((w) => [
				w.startTime,
				w.word,
			]);
			lineItems.push(normalizedWords[normalizedWords.length - 1].endTime);
			return (
				`[${formatTime(normalizedLineStartTime)}]` +
				lineItems
					.map((item) =>
						typeof item === "number" ? `<${formatTime(item)}>` : item,
					)
					.join("")
			);
		})
		.join("\n");
}
