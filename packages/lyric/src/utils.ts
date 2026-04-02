import type { LyricLine, LyricWord } from "./types";

export const createLine = (line: Partial<LyricLine>): LyricLine => ({
	words: [],
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: 0,
	endTime: 0,
	...line,
});

export const createWord = (word: Partial<LyricWord>): LyricWord => ({
	startTime: 0,
	endTime: 0,
	word: "",
	romanWord: "",
	...word,
});

export const parseTime = (time: string): number =>
	Math.round(
		time
			.split(":")
			.map(Number)
			.reverse()
			.reduce((acc, cur, idx) => acc + cur * 60 ** idx, 0) * 1000,
	);
