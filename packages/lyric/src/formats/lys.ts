/**
 * @fileoverview Lyricify Syllable（LYS）格式解析与生成。
 * 支持词级时间戳、背景人声与对唱属性。每行以属性位 `[prop]` 开头，后续为 `文本(start,duration)` 序列。
 *
 * 属性位说明：
 * 0: 未设置
 * 1: 左对齐
 * 2: 右对齐（对唱）
 * 3: 非背景，未设置对齐
 * 4: 非背景，左对齐
 * 5: 非背景，右对齐（对唱）
 * 6: 背景，未设置对齐
 * 7: 背景，左对齐
 * 8: 背景，右对齐（对唱）
 *
 * 格式示例：
 * [0]Lately (358,1336)I've (1694,487)been, (2181,673)I've (2854,268)been (3122,280)losing (3402,345)sleep(3747,1186)
 * [0]Dreaming (5245,696)about (5941,471)the (6412,306)things (6718,458)that (7176,292)we (7468,511)could (7979,393)be(8372,737)
 */
import type { LyricLine, LyricWord } from "../types";
import {
	createLine,
	createWord,
	normalizeDuration,
	normalizeTimestamp,
} from "../utils";

/**
 * 解析 LYS 格式中的属性值
 * @param prop 属性值
 * @returns 对唱与背景标志位
 */
function parseProp(prop: number): {
	isDuet: boolean | undefined;
	isBG: boolean | undefined;
} {
	if (prop < 0 || prop > 8) prop = 0;
	return {
		isDuet: prop % 3 === 0 ? undefined : prop % 3 === 2,
		isBG: prop <= 2 ? undefined : prop >= 6,
	};
}

/**
 * 解析 LYS 格式的歌词字符串
 * @param lys 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLys(lys: string): LyricLine[] {
	const lines = lys
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	const propRegex = /^\[(\d+)\]/;
	const wordRegex = /(.*?)\((\d+),(\d+)\)/g;

	for (const lineStr of lines) {
		const propMatch = lineStr.match(propRegex);
		if (!propMatch) continue;

		const [, propStr] = propMatch;
		const content = lineStr.slice(propMatch[0].length);
		const words: LyricWord[] = [];
		const props = parseProp(Number(propStr));

		for (const match of content.matchAll(wordRegex)) {
			const [, rawWord, startStr, durStr] = match;
			const startTime = Number(startStr);
			const duration = Number(durStr);
			const endTime = startTime + duration;
			const wordText = rawWord;
			words.push(createWord({ word: wordText, startTime, endTime }));
		}

		const lineStartTime = words[0]?.startTime ?? 0;
		const lineEndTime = words[words.length - 1]?.endTime ?? 0;
		if (!words.length) continue;

		if (props.isBG === undefined)
			props.isBG =
				words.length > 0 &&
				/^[(（]/.test(words[0].word) &&
				/[）)]$/.test(words[words.length - 1].word);

		if (props.isBG && words.length) {
			words[0].word = words[0].word.replace(/^[(（]/, "");
			words[words.length - 1].word = words[words.length - 1].word.replace(
				/[）)]$/,
				"",
			);
		}

		lyricLines.push(
			createLine({
				startTime: lineStartTime,
				endTime: lineEndTime,
				isDuet: !!props.isDuet,
				isBG: props.isBG,
				words,
			}),
		);
	}
	return lyricLines;
}

function makeProp(line: LyricLine): number {
	let prop = 0;
	prop += line.isDuet ? 2 : 1;
	prop += line.isBG ? 6 : 3;
	return prop;
}

/**
 * 将歌词数组转换为 LYS 格式的字符串
 * @param lines 歌词数组
 * @returns LYS 格式的字符串
 */
export function stringifyLys(lines: LyricLine[]): string {
	return lines
		.map((line) => {
			const prop = makeProp(line);
			const printWords: {
				startTime: number;
				duration: number;
				word: string;
			}[] = [];
			line.words.forEach((w) => {
				if (w.word.trim() || !printWords.length)
					printWords.push({
						word: w.word,
						startTime: normalizeTimestamp(w.startTime),
						duration: normalizeDuration(
							normalizeTimestamp(w.endTime) - normalizeTimestamp(w.startTime),
						),
					});
				else printWords[printWords.length - 1].word += w.word;
			});
			const wordsStr = printWords
				.map((w) => `${w.word}(${w.startTime},${w.duration})`)
				.join("");
			return `[${prop}]${wordsStr}`;
		})
		.join("\n");
}
