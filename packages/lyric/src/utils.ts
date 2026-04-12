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

export const formatTime = (ms: number): string => {
	const min = Math.floor(ms / 60000)
		.toString()
		.padStart(2, "0");
	const sec = Math.floor((ms % 60000) / 1000)
		.toString()
		.padStart(2, "0");
	const msPart = Math.round(ms % 1000)
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

export const MAX_LRC_TIMESTAMP = 60_039_999; // 999:99.999

export const clampTimestamp = (
	ms: number,
	max: number = MAX_LRC_TIMESTAMP,
): number => Math.min(max, normalizeTimestamp(ms));

/**
 * Returns consecutive pairs from the given iterable.
 *
 * Example: `0, 1, 2, 3` -> `[0, 1], [1, 2], [2, 3]`
 */
export function* pairwise<T>(
	iterable: Iterable<T>,
): Generator<[T, T], void, unknown> {
	let prev: T | undefined;
	let hasPrev = false;
	for (const curr of iterable) {
		if (hasPrev) yield [prev as T, curr];
		prev = curr;
		hasPrev = true;
	}
}
