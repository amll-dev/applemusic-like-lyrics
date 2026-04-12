/**
 * @fileoverview ESLyric 逐词歌词格式解析与生成。
 * 每行以行首时间戳开头，后续每个单词后都跟一个结束时间戳。
 *
 * 格式示例：
 * [00:10.82]Test[00:10.97] Word[00:12.62]
 * [00:12.62]Next[00:13.20] line[00:14.10]
 */
import type { LyricLine, LyricWord } from "../types";
import {
	clampTimestamp,
	createLine,
	createWord,
	formatTime,
	parseTime,
} from "../utils";

const TIME_REGEX = /^\[((?:\d+:)*\d+(?:\.\d+)?)\]/;

function parseTimestampPrefix(
	src: string,
): { time: number; length: number } | null {
	const match = src.match(TIME_REGEX);
	if (!match) return null;
	const [raw, timeStr] = match;
	return { time: parseTime(timeStr), length: raw.length };
}

function parseEslrcLine(rawLine: string): LyricLine | null {
	let src = rawLine.trim();
	const first = parseTimestampPrefix(src);
	if (!first) return null;
	src = src.slice(first.length);
	let startTime = first.time;
	if (!src.trim()) return null;

	const words: LyricWord[] = [];
	while (src.trim().length > 0) {
		const nextTimePos = src.indexOf("[");
		if (nextTimePos <= 0) return null;

		const word = src.slice(0, nextTimePos);
		const nextTime = parseTimestampPrefix(src.slice(nextTimePos));
		if (!nextTime) return null;

		words.push(
			createWord({
				word,
				startTime,
				endTime: nextTime.time,
			}),
		);
		src = src.slice(nextTimePos + nextTime.length);
		startTime = nextTime.time;
	}

	return createLine({ words });
}

/**
 * 解析 ESLyric 逐词歌词格式字符串
 * @param eslrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseEslrc(eslrc: string): LyricLine[] {
	const result: LyricLine[] = [];
	for (const rawLine of eslrc.split(/\r?\n/)) {
		const line = parseEslrcLine(rawLine);
		if (line) result.push(line);
	}

	result.sort(
		(a, b) =>
			(a.words[0]?.startTime ?? Number.MAX_SAFE_INTEGER) -
			(b.words[0]?.startTime ?? Number.MAX_SAFE_INTEGER),
	);

	for (const line of result) {
		for (const word of line.words) {
			word.startTime = clampTimestamp(word.startTime);
			word.endTime = clampTimestamp(word.endTime);
		}
		line.startTime = clampTimestamp(line.words[0]?.startTime ?? 0);
		line.endTime = clampTimestamp(
			line.words[line.words.length - 1]?.endTime ?? 0,
		);
	}

	return result;
}

/**
 * 将歌词数组转换为 ESLyric 逐词歌词格式字符串
 * @param lines 歌词数组
 * @returns ESLyric 逐词歌词格式字符串
 */
export function stringifyEslrc(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			if (!line.words.length) return "";
			return `[${formatTime(clampTimestamp(line.words[0].startTime))}]${line.words
				.map(
					(word) => `${word.word}[${formatTime(clampTimestamp(word.endTime))}]`,
				)
				.join("")}`;
		})
		.filter(Boolean)
		.join("\n");
}
