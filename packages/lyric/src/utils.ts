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

/**
 * 将一个时间戳的分、秒、毫秒三段文本转换为毫秒。
 *
 * 毫秒段可以省略，省略时按 `0` 计；
 * 毫秒不足三位时视为在后位省略了 `0`，即 `.1` 为 100 毫秒、`.02` 为 20 毫秒；
 * 超过三位的部分直接截断。
 */
export const parseTimestampParts = (
	minStr: string,
	secStr: string,
	msStr = "",
): number =>
	parseInt(minStr, 10) * 60000 +
	parseInt(secStr, 10) * 1000 +
	parseInt(`${msStr}000`.slice(0, 3), 10);

export const formatTime = (ms: number): string => {
	const min = Math.floor(ms / 60000)
		.toString()
		.padStart(2, "0");
	const sec = Math.floor((ms % 60000) / 1000)
		.toString()
		.padStart(2, "0");
	// 截断而非进位，否则毫秒带小数时会溢出成四位数
	const msPart = Math.floor(ms % 1000)
		.toString()
		.padStart(3, "0");
	return `${min}:${sec}.${msPart}`;
};

export const normalizeTimestamp = (ms: number): number => {
	if (!Number.isFinite(ms) || ms < 0) return 0;
	return ms;
};

export const normalizeDuration = (duration: number): number => {
	if (!Number.isFinite(duration) || duration < 0) return 0;
	return duration;
};

/**
 * LRC 家族时间戳可表示的最大值，即 `999:59.999`
 *
 * 时间戳的分钟为 1 至 3 位、秒为 1 至 2 位、毫秒为 1 至 6 位，
 * 因此能写出来又读得回来的最大时间就到这里
 */
export const MAX_LRC_TIMESTAMP: number = parseTimestampParts(
	"999",
	"59",
	"999",
);

/**
 * 将时间钳制到 LRC 家族可表示的范围内
 * @param ms 时间，单位为毫秒
 * @returns 钳制后的时间
 */
export const clampTimestamp = (ms: number): number =>
	Math.min(MAX_LRC_TIMESTAMP, normalizeTimestamp(ms));

export type DeepRequired<T> = T extends object
	? { [P in keyof T]-?: DeepRequired<NonNullable<T[P]>> }
	: T;
