import { describe, expect, it } from "vitest";
import type { LyricLine, LyricWord } from "#interfaces";
import { LyricDataManager } from "#lyric/base/lyric-data-manager.ts";
import { assertValidLyricTimestamps } from "#utils/validate-lyric.ts";

function createWord(overrides: Partial<LyricWord> = {}): LyricWord {
	return {
		word: "word",
		startTime: 1000,
		endTime: 2000,
		...overrides,
	};
}

function createLine(overrides: Partial<LyricLine> = {}): LyricLine {
	return {
		words: [createWord()],
		translatedLyric: "",
		romanLyric: "",
		startTime: 1000,
		endTime: 2000,
		isBG: false,
		isDuet: false,
		...overrides,
	};
}

function setField(target: object, key: string, value: unknown): void {
	(target as Record<string, unknown>)[key] = value;
}

describe("assertValidLyricTimestamps", () => {
	it("accepts unsorted, overlapping, zero-duration, and cross-boundary timestamps", () => {
		const laterLine = createLine({
			startTime: 2000,
			endTime: 2000,
			words: [
				createWord({ startTime: 0, endTime: 3000 }),
				createWord({
					word: " ",
					startTime: 1000,
					endTime: 1000,
					ruby: [{ word: "", startTime: 1000, endTime: 1000 }],
				}),
			],
		});
		const earlierOverlappingLine = createLine({
			startTime: 1000,
			endTime: 2500,
			words: [],
		});

		expect(() =>
			assertValidLyricTimestamps([laterLine, earlierOverlappingLine]),
		).not.toThrow();
	});

	it("reports the exact nested path for an invalid timestamp", () => {
		const lines = Array.from({ length: 4 }, () => createLine());
		lines[3].words = Array.from({ length: 6 }, () => createWord());
		lines[3].words[5].endTime = Number.NaN;

		expect(() => assertValidLyricTimestamps(lines)).toThrow(
			new TypeError(
				"Invalid lyric timestamp at lines[3].words[5].endTime: NaN",
			),
		);
	});

	it.each<[string, unknown, string, (line: LyricLine, value: unknown) => void]>(
		[
			[
				"null",
				null,
				"lines[0].startTime",
				(line, value) => setField(line, "startTime", value),
			],
			[
				"undefined",
				undefined,
				"lines[0].endTime",
				(line, value) => setField(line, "endTime", value),
			],
			[
				"negative numbers",
				-1,
				"lines[0].words[0].startTime",
				(line, value) => setField(line.words[0], "startTime", value),
			],
			[
				"positive infinity",
				Number.POSITIVE_INFINITY,
				"lines[0].words[0].ruby[0].startTime",
				(line, value) => {
					line.words[0].ruby = [
						{ word: "ruby", startTime: 1000, endTime: 2000 },
					];
					setField(line.words[0].ruby[0], "startTime", value);
				},
			],
			[
				"negative infinity",
				Number.NEGATIVE_INFINITY,
				"lines[0].words[0].ruby[0].endTime",
				(line, value) => {
					line.words[0].ruby = [
						{ word: "ruby", startTime: 1000, endTime: 2000 },
					];
					setField(line.words[0].ruby[0], "endTime", value);
				},
			],
			[
				"non-number values",
				"1000",
				"lines[0].words[0].endTime",
				(line, value) => setField(line.words[0], "endTime", value),
			],
		],
	)("rejects %s", (_, value, path, mutate) => {
		const line = createLine();
		mutate(line, value);

		expect(() => assertValidLyricTimestamps([line])).toThrow(
			new TypeError(
				`Invalid lyric timestamp at ${path}: ${typeof value === "string" ? JSON.stringify(value) : String(value)}`,
			),
		);
	});

	it.each<[string, string, (line: LyricLine) => void]>([
		[
			"line",
			"Invalid lyric timestamp range at lines[0]: startTime 2000 is greater than endTime 1000",
			(line) => {
				line.startTime = 2000;
				line.endTime = 1000;
			},
		],
		[
			"word",
			"Invalid lyric timestamp range at lines[0].words[0]: startTime 2000 is greater than endTime 1000",
			(line) => {
				line.words[0].startTime = 2000;
				line.words[0].endTime = 1000;
			},
		],
		[
			"ruby syllable",
			"Invalid lyric timestamp range at lines[0].words[0].ruby[0]: startTime 2000 is greater than endTime 1000",
			(line) => {
				line.words[0].ruby = [{ word: "ruby", startTime: 2000, endTime: 1000 }];
			},
		],
	])("rejects reversed %s timestamp ranges", (_, message, mutate) => {
		const line = createLine();
		mutate(line);

		expect(() => assertValidLyricTimestamps([line])).toThrow(
			new RangeError(message),
		);
	});
});

describe("LyricDataManager lyric timestamp validation", () => {
	it("validates and clones lines before storing them", () => {
		const manager = new LyricDataManager();
		const lines = [createLine()];

		manager.setOriginalLines(lines);

		expect(manager.getRawLines()).toEqual(lines);
		expect(manager.getRawLines()).not.toBe(lines);
	});

	it("rejects invalid timestamps without replacing stored lines", () => {
		const manager = new LyricDataManager();
		const originalLines = [createLine()];
		manager.setOriginalLines(originalLines);
		const invalidLines = [createLine()];
		invalidLines[0].startTime = Number.NaN;

		expect(() => manager.setOriginalLines(invalidLines)).toThrow(
			new TypeError("Invalid lyric timestamp at lines[0].startTime: NaN"),
		);
		expect(manager.getRawLines()).toEqual(originalLines);
	});
});
