/**
 * @fileoverview LRC A2（增强 LRC）格式解析与生成。
 * 在普通 LRC 行级时间戳基础上，支持词级/音节级时间戳；同一行内时间需连续，词时间由左右时间戳界定。
 *
 * 格式示例：
 * [02:38.850]<02:38.850>Words <02:39.030>are <02:39.120>made <02:39.360>of <02:39.420>plastic<02:40.080>
 * [02:40.080]<02:40.080>Come <02:40.290>back <02:40.470>like <02:40.680>elastic<02:41.370>
 */
import type { LyricLine, LyricWord } from "../types";
import { createLine, createWord, formatTime, parseTime } from "../utils";

/**
 * 解析 LRC A2 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLRCa2(lrc: string): LyricLine[] {
	const lines = lrc
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	const lineTimeStampRegex = /^\[((?:\d+:)*\d+(?:\.\d+)?)\]/;
	const wordTimestampRegex = /<((?:\d+:)*\d+(?:\.\d+)?)>/g;
	for (let lineStr of lines) {
		if (lineStr.startsWith("#") || lineStr.startsWith("{")) continue;
		const tagMatch = lineStr.match(/^\[([a-z]):(.+)\]$/i);
		if (tagMatch) continue;
		const lineTimeStampmatch = lineStr.match(lineTimeStampRegex);
		if (!lineTimeStampmatch) continue;
		const [lineTimeStamp, lineTimeStr] = lineTimeStampmatch;
		const lineStartTime = parseTime(lineTimeStr);
		if (Number.isNaN(lineStartTime)) continue;
		lineStr = lineStr.slice(lineTimeStamp.length).trim();

		const lineItems: (number | string)[] = [];
		const textRegex = /^[^<]*/;
		while (lineStr.length) {
			const timeStampMatch = lineStr.match(wordTimestampRegex);
			if (!timeStampMatch) {
				const textMatch = lineStr.match(textRegex)?.[0] ?? "";
				lineItems.push(textMatch);
				lineStr = lineStr.slice(textMatch.length);
			} else {
				const [wordTimeStamp, wordTimeStr] = timeStampMatch;
				const parsedWordTime = parseTime(wordTimeStr);
				if (!Number.isNaN(parsedWordTime)) lineItems.push(parsedWordTime);
				lineStr = lineStr.slice(wordTimeStamp.length);
			}
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
export function stringifyLRCa2(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			if (line.words.length === 0) return `[${formatTime(line.startTime)}]`;
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
					startTime: w.startTime,
					endTime: w.endTime,
				});
			});
			const lineItems: (number | string)[] = normalizedWords.flatMap((w) => [
				w.startTime,
				w.word,
			]);
			lineItems.push(normalizedWords[normalizedWords.length - 1].endTime);
			return (
				`[${formatTime(line.startTime)}]` +
				lineItems
					.map((item) =>
						typeof item === "number" ? `<${formatTime(item)}>` : item,
					)
					.join("")
			);
		})
		.join("\n");
}
