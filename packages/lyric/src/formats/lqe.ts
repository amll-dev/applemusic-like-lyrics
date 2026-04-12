/**
 * @fileoverview Lyricify Quick Export（LQE）格式解析与生成。
 * 该格式本质是组合格式：`lyrics` 部分使用 LYS；`translation`/`pronunciation` 部分使用 LRC。
 *
 * 格式示例：
 * [Lyricify Quick Export]
 * [version:1.0]
 *
 * [lyrics: format@Lyricify Syllable]
 * [4]A(365,350)ni(715,307)ro(1022,312)dham (1334,419)a(3203,337)nut(3540,350)pā(3890,306)dam(4196,382)
 *
 * [translation: format@LRC]
 * [00:00.365]不生亦不灭
 *
 * [pronunciation: format@LRC, language@romaji]
 * [00:00.365]阿难罗昙 阿耨钵昙
 */
import type { LyricLine } from "../types";
import { formatTime, parseTime } from "../utils";
import { parseLys, stringifyLys } from "./lys";

type AttrType = "translatedLyric" | "romanLyric";

interface HeaderMatch {
	index: number;
	type: "lyric" | "translation" | "romanization" | "unknown";
}

function parseAttr(
	attr: AttrType,
	headerMatches: HeaderMatch[],
	rawLines: string[],
	lines: LyricLine[],
): void {
	const headerIndex = headerMatches.findIndex((item) => {
		if (attr === "translatedLyric") return item.type === "translation";
		return item.type === "romanization";
	});
	if (headerIndex === -1) return;

	const timeRegex = /^\[((?:\d+:)*\d+(?:\.\d+)?)\](.*)$/;
	const attrLines = rawLines
		.slice(
			headerMatches[headerIndex].index + 1,
			headerMatches[headerIndex + 1].index,
		)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const match = line.match(timeRegex);
			if (!match) return null;
			const [, timeStr, text] = match;
			const time = parseTime(timeStr);
			if (Number.isNaN(time)) return null;
			return { time, text };
		})
		.filter((item): item is { time: number; text: string } => item !== null);

	let attrLineIndex = 0;
	for (const line of lines) {
		if (attrLines[attrLineIndex]?.time !== line.startTime) continue;
		line[attr] = attrLines[attrLineIndex].text;
		attrLineIndex++;
	}
}

/**
 * 解析 LQE 格式的歌词字符串
 * @param lqe 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLqe(lqe: string): LyricLine[] {
	const lines = lqe
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	const headerRegex = /^\[([a-zA-Z]+):.+\]$/;
	const headerMatches: HeaderMatch[] = [];
	lines.forEach((line, index) => {
		const match = line.match(headerRegex);
		if (!match) return;
		const [, type] = match;
		if (type === "lyrics") headerMatches.push({ index, type: "lyric" });
		else if (type === "translation")
			headerMatches.push({ index, type: "translation" });
		else if (type === "pronunciation")
			headerMatches.push({ index, type: "romanization" });
		else headerMatches.push({ index, type: "unknown" });
	});
	headerMatches.push({ index: lines.length, type: "unknown" });

	const lyricHeaderIndex = headerMatches.findIndex(
		(item) => item.type === "lyric",
	);
	if (lyricHeaderIndex === -1) return [];

	const lyricLines = lines.slice(
		headerMatches[lyricHeaderIndex].index + 1,
		headerMatches[lyricHeaderIndex + 1].index,
	);
	const parsedLines = parseLys(lyricLines.join("\n"));

	parseAttr("translatedLyric", headerMatches, lines, parsedLines);
	parseAttr("romanLyric", headerMatches, lines, parsedLines);

	return parsedLines;
}

function stringifyAttr(lines: LyricLine[], attr: AttrType): string | null {
	const header =
		attr === "translatedLyric"
			? "[translation: format@LRC]"
			: "[pronunciation: format@LRC, language@romaji]";
	const contentLines = lines
		.map((line) => {
			const value = line[attr];
			if (!value) return null;
			return `[${formatTime(line.startTime)}]${value}`;
		})
		.filter((line): line is string => line !== null);
	if (contentLines.length === 0) return null;
	return [header, ...contentLines].join("\n");
}

/**
 * 将歌词数组转换为 LQE 格式的字符串
 * @param lines 歌词数组
 * @returns LQE 格式的字符串
 */
export function stringifyLqe(lines: LyricLine[]): string {
	const header = "[Lyricify Quick Export]\n[version:1.0]";
	const lyricSection = `[lyrics: format@Lyricify Syllable]\n${stringifyLys(lines)}`;
	const translationSection = stringifyAttr(lines, "translatedLyric");
	const romanizationSection = stringifyAttr(lines, "romanLyric");
	const body = [lyricSection, translationSection, romanizationSection]
		.filter((section): section is string => section !== null)
		.join("\n\n\n");
	return [header, body].join("\n\n");
}
