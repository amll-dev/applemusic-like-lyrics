/**
 * @fileoverview ASS 字幕格式导出。
 * 注意导出会损失 10ms 以内精度（按厘秒四舍五入）。
 *
 * 格式示例：
 * Dialogue: 0,0:00:12.34, 0:00:15.67, Default, v1,0,0,0,,{\k20}Hello{\k15} world
 * Dialogue: 0,0:00:12.34, 0:00:15.67, Default, v1-trans,0,0,0,,你好 世界
 * Dialogue: 0,0:00:12.34, 0:00:15.67, Default, v1-roman,0,0,0,,ni hao shi jie
 */
import type { LyricLine } from "../types";
import { normalizeTimestamp } from "../utils";

function writeASSTimestamp(ms: number): string {
	const normalized = normalizeTimestamp(ms);
	const milli = Math.round(normalized) % 1000;
	const secTotal = Math.floor(Math.round(normalized) / 1000);
	const sec = secTotal % 60;
	const minTotal = Math.floor(secTotal / 60);
	const hour = Math.floor(minTotal / 60);
	return `${hour}:${String(minTotal % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(Math.floor(milli / 10)).padStart(2, "0")}`;
}

function getSpeakerName(line: LyricLine): string {
	let name = line.isDuet ? "v2" : "v1";
	if (line.isBG) name += "-bg";
	return name;
}

function writeLyricDialogue(
	result: string[],
	startTime: number,
	endTime: number,
	name: string,
	text: string,
) {
	result.push(
		`Dialogue: 0,${writeASSTimestamp(startTime)}, ${writeASSTimestamp(endTime)}, Default, ${name},0,0,0,,${text}`,
	);
}

/**
 * 将歌词数组转换为 ASS 字幕格式字符串
 * @param lines 歌词数组
 * @returns ASS 字幕格式字符串
 */
export function stringifyAss(lines: LyricLine[]): string {
	const result: string[] = [
		"[Script Info]",
		"[Events]",
		"Formats: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
	];

	for (const line of lines) {
		const timedWords = line.words
			.map((w) => ({
				...w,
				startTime: normalizeTimestamp(w.startTime),
				endTime: normalizeTimestamp(w.endTime),
			}))
			.filter((w) => w.endTime > w.startTime);
		const startTime = Math.min(...timedWords.map((w) => w.startTime));
		const endTime = Math.max(...timedWords.map((w) => w.endTime));
		if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;

		let lyricText = "";
		let previousWordEndTime = startTime;
		for (const word of line.words) {
			const wordStart = normalizeTimestamp(word.startTime);
			const wordEnd = normalizeTimestamp(word.endTime);
			if (wordStart >= wordEnd) {
				lyricText += word.word;
				continue;
			}

			if (wordStart > previousWordEndTime) {
				const gapDurationCS = Math.floor(
					(wordStart - previousWordEndTime + 5) / 10,
				);
				if (gapDurationCS > 0) lyricText += `{\\k${gapDurationCS}}`;
			}

			const wordDurationCS = Math.floor((wordEnd - wordStart + 5) / 10);
			if (wordDurationCS > 0) lyricText += `{\\k${wordDurationCS}}`;
			lyricText += word.word;
			previousWordEndTime = wordEnd;
		}

		const speaker = getSpeakerName(line);
		writeLyricDialogue(result, startTime, endTime, speaker, lyricText);
		if (line.translatedLyric)
			writeLyricDialogue(
				result,
				startTime,
				endTime,
				`${speaker}-trans`,
				line.translatedLyric,
			);
		if (line.romanLyric)
			writeLyricDialogue(
				result,
				startTime,
				endTime,
				`${speaker}-roman`,
				line.romanLyric,
			);
	}

	return `${result.join("\n")}\n`;
}
