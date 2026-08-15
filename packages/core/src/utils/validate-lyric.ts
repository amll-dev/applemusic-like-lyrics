import type { LyricLine } from "../interfaces.ts";

function formatValue(value: unknown): string {
	return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function assertTimestamp(
	value: unknown,
	path: string,
): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new TypeError(
			`Invalid lyric timestamp at ${path}: ${formatValue(value)}`,
		);
	}
}

function assertTimestampRange(
	value: { startTime: unknown; endTime: unknown },
	path: string,
): void {
	const startTime = value.startTime;
	const endTime = value.endTime;
	assertTimestamp(startTime, `${path}.startTime`);
	assertTimestamp(endTime, `${path}.endTime`);

	if (startTime > endTime) {
		throw new RangeError(
			`Invalid lyric timestamp range at ${path}: startTime ${startTime} is greater than endTime ${endTime}`,
		);
	}
}

/**
 * 验证歌词数据中的时间戳满足基本数值约束，例如非负、有限等
 */
export function assertValidLyricTimestamps(lines: readonly LyricLine[]): void {
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const linePath = `lines[${lineIndex}]`;
		assertTimestampRange(line, linePath);

		for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
			const word = line.words[wordIndex];
			const wordPath = `${linePath}.words[${wordIndex}]`;
			assertTimestampRange(word, wordPath);

			if (word.ruby) {
				for (let rubyIndex = 0; rubyIndex < word.ruby.length; rubyIndex++) {
					assertTimestampRange(
						word.ruby[rubyIndex],
						`${wordPath}.ruby[${rubyIndex}]`,
					);
				}
			}
		}
	}
}
