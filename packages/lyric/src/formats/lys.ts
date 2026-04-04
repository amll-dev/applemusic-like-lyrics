import type { LyricLine, LyricWord } from "../types";
import { createLine, createWord } from "../utils";

/**
 * 解析 LYS 格式中的属性值
 * @param prop 属性值
 * @returns 对唱与背景标志位
 */
function parseProp(prop: number): { isDuet: boolean; isBG: boolean } {
	if (prop < 0 || prop > 8) prop = 0;
	return {
		isDuet: prop % 3 === 2,
		isBG: prop >= 6,
	};
}

/**
 * 解析 LYS 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLYS(lys: string): LyricLine[] {
	const lines = lys
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const lyricLines: LyricLine[] = [];
	const propRegex = /^\[(\d+)\]/;
	const wordRegex = /(.*?)\((\d+),(\d+)\)/g;

	const getSpaceWord = () => createWord({ word: " " });

	for (const lineStr of lines) {
		const propMatch = lineStr.match(propRegex);
		if (!propMatch) continue;

		const [, propStr, content] = propMatch;
		const words: LyricWord[] = [];
		const props = parseProp(Number(propStr));

		for (const match of content.matchAll(wordRegex)) {
			const [, rawWord, startStr, durStr] = match;
			const startTime = Number(startStr);
			const duration = Number(durStr);
			const endTime = startTime + duration;
			const sourceText = rawWord;
			const wordText = sourceText.trim();

			if (sourceText.startsWith(" ") && words[words.length - 1]?.word !== " ")
				words.push(getSpaceWord());
			words.push(createWord({ word: wordText, startTime, endTime }));
			if (sourceText.endsWith(" ")) words.push(getSpaceWord());
		}

		const lineStartTime = words[0]?.startTime ?? 0;
		const lineEndTime = words[words.length - 1]?.endTime ?? 0;

		if (props.isBG && words.length) {
			words[0].word = words[0].word.replace(/^\(/, "");
			words[words.length - 1].word = words[words.length - 1].word.replace(
				/\)$/,
				"",
			);
		}

		lyricLines.push(
			createLine({
				startTime: lineStartTime,
				endTime: lineEndTime,
				isDuet: props.isDuet,
				isBG: props.isBG,
				words,
			}),
		);
	}

	return lyricLines;
}

function getPropMaker(allLines: LyricLine[]) {
	const hasDuet = allLines.some((l) => l.isDuet);
	const hasBackground = allLines.some((l) => l.isBG);
	return (line: LyricLine) => {
		let prop = 0;
		if (hasDuet) prop += line.isDuet ? 2 : 1;
		if (hasBackground) prop += line.isBG ? 6 : 3;
		return prop;
	};
}

/**
 * 将歌词数组转换为 LYS 格式的字符串
 * @param lines 歌词数组
 * @returns LYS 格式的字符串
 */
export function stringifyLYS(lines: LyricLine[]): string {
	const getProp = getPropMaker(lines);
	return lines
		.map((line) => {
			const prop = getProp(line);
			const printWords: {
				startTime: number;
				duration: number;
				word: string;
			}[] = [];
			line.words.forEach((w) => {
				if (w.word.trim() || !printWords.length)
					printWords.push({
						word: w.word,
						startTime: w.startTime,
						duration: w.endTime - w.startTime,
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
