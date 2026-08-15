import { describe, expect, it } from "vitest";
import type { LyricLine, OptimizeLyricOptions } from "#interfaces";
import {
	areOptimizeOptionsEqual,
	optimizeLyricLines,
} from "#utils/optimize-lyric.ts";

const DISABLED_OPTIONS: OptimizeLyricOptions = {
	normalizeSpaces: false,
	resetLineTimestamps: false,
	syncMainAndBackgroundLines: false,
	cleanUnintentionalOverlaps: false,
	tryAdvanceStartTime: false,
};

function createLine(
	startTime = 0,
	endTime = 0,
	options: Partial<Omit<LyricLine, "startTime" | "endTime">> = {},
): LyricLine {
	return {
		words: [{ word: "line", startTime, endTime }],
		translatedLyric: "",
		romanLyric: "",
		startTime,
		endTime,
		isBG: false,
		isDuet: false,
		...options,
	};
}

function optimizeWith(
	lines: LyricLine[],
	options: OptimizeLyricOptions = {},
): void {
	optimizeLyricLines(lines, { ...DISABLED_OPTIONS, ...options });
}

describe("areOptimizeOptionsEqual", () => {
	it("considers options with the same values equal regardless of key order", () => {
		expect(
			areOptimizeOptionsEqual(
				{ normalizeSpaces: true, tryAdvanceStartTime: false },
				{ tryAdvanceStartTime: false, normalizeSpaces: true },
			),
		).toBe(true);
	});

	it("distinguishes missing or changed option values", () => {
		expect(areOptimizeOptionsEqual()).toBe(true);
		expect(
			areOptimizeOptionsEqual(
				{ normalizeSpaces: true },
				{ normalizeSpaces: false },
			),
		).toBe(false);
		expect(areOptimizeOptionsEqual({}, { normalizeSpaces: undefined })).toBe(
			false,
		);
	});
});

describe("optimizeLyricLines", () => {
	it("handles an empty lyrics array", () => {
		const lines: LyricLine[] = [];

		optimizeLyricLines(lines);

		expect(lines).toEqual([]);
	});

	it("normalizes all whitespace runs without trimming word boundaries", () => {
		const line = createLine(0, 1000, {
			words: [{ word: "\thello \n world  ", startTime: 0, endTime: 1000 }],
		});

		optimizeWith([line], { normalizeSpaces: true });

		expect(line.words[0].word).toBe(" hello world ");
	});

	it("copies line timestamps to a single zero-timestamp word", () => {
		const line = createLine(1000, 2000, {
			words: [{ word: "line", startTime: 0, endTime: 0 }],
		});

		optimizeWith([line], { resetLineTimestamps: true });

		expect(line.words[0]).toMatchObject({ startTime: 1000, endTime: 2000 });
	});

	it("uses the first and last word timestamps as the line bounds", () => {
		const line = createLine(0, 0, {
			words: [
				{ word: "first", startTime: 1000, endTime: 1400 },
				{ word: "middle", startTime: 1400, endTime: 1800 },
				{ word: "last", startTime: 1800, endTime: 2300 },
			],
		});

		optimizeWith([line], { resetLineTimestamps: true });

		expect(line).toMatchObject({ startTime: 1000, endTime: 2300 });
	});

	it("keeps line timestamps when there are no words", () => {
		const line = createLine(1000, 2000, { words: [] });

		optimizeWith([line], { resetLineTimestamps: true });

		expect(line).toMatchObject({ startTime: 1000, endTime: 2000 });
	});

	it("always converts excessive background lines", () => {
		const lines = [
			createLine(),
			createLine(0, 0, { isBG: true }),
			createLine(0, 0, { isBG: true }),
			createLine(0, 0, { isBG: true }),
		];

		optimizeLyricLines(lines, {
			...DISABLED_OPTIONS,
			convertExcessiveBackgroundLines: false,
		});

		expect(lines.map((line) => line.isBG)).toEqual([false, true, false, false]);
	});

	it("converts a leading background line before sorting", () => {
		const leadingBackground = createLine(3000, 4000, { isBG: true });
		const mainLine = createLine(1000, 2000);
		const lines = [leadingBackground, mainLine];

		optimizeWith(lines);

		expect(lines).toEqual([mainLine, leadingBackground]);
		expect(leadingBackground.isBG).toBe(false);
	});

	it("synchronizes line and nonblank word bounds for a main/background pair", () => {
		const mainLine = createLine(1000, 2000, {
			words: [
				{ word: " ", startTime: 0, endTime: 500 },
				{ word: "main", startTime: 1200, endTime: 1800 },
			],
		});
		const backgroundLine = createLine(1100, 2100, {
			isBG: true,
			words: [{ word: "background", startTime: 900, endTime: 2300 }],
		});

		optimizeWith([mainLine, backgroundLine], {
			syncMainAndBackgroundLines: true,
		});

		expect(mainLine).toMatchObject({ startTime: 900, endTime: 2300 });
		expect(backgroundLine).toMatchObject({ startTime: 900, endTime: 2300 });
	});

	it("synchronizes a main/background pair without nonblank words", () => {
		const mainLine = createLine(1000, 2000, { words: [] });
		const backgroundLine = createLine(800, 2200, {
			isBG: true,
			words: [{ word: " ", startTime: 0, endTime: 0 }],
		});

		optimizeWith([mainLine, backgroundLine], {
			syncMainAndBackgroundLines: true,
		});

		expect(mainLine).toMatchObject({ startTime: 800, endTime: 2200 });
		expect(backgroundLine).toMatchObject({ startTime: 800, endTime: 2200 });
	});

	it("sorts main lines without separating their background lines", () => {
		const laterMain = createLine(3000, 4000);
		const laterBackground = createLine(500, 4500, { isBG: true });
		const earlierMain = createLine(1000, 2000);
		const earlierBackground = createLine(4000, 5000, { isBG: true });
		const lines = [laterMain, laterBackground, earlierMain, earlierBackground];

		optimizeWith(lines);

		expect(lines).toEqual([
			earlierMain,
			earlierBackground,
			laterMain,
			laterBackground,
		]);
	});

	it("keeps the original group order when main lines start together", () => {
		const firstMain = createLine(1000, 2000);
		const firstBackground = createLine(1000, 2000, { isBG: true });
		const secondMain = createLine(1000, 3000);
		const lines = [firstMain, firstBackground, secondMain];

		optimizeWith(lines);

		expect(lines).toEqual([firstMain, firstBackground, secondMain]);
	});

	it("sorts by the line timestamps produced from word timestamps", () => {
		const laterLine = createLine(0, 0, {
			words: [{ word: "later", startTime: 3000, endTime: 4000 }],
		});
		const earlierLine = createLine(5000, 6000, {
			words: [{ word: "earlier", startTime: 1000, endTime: 2000 }],
		});
		const lines = [laterLine, earlierLine];

		optimizeWith(lines, { resetLineTimestamps: true });

		expect(lines).toEqual([earlierLine, laterLine]);
	});

	it.each([
		["100ms overlap", 100, 1000, 1000],
		["just over 100ms and 10%", 101, 1000, 1101],
		["exactly 10%", 200, 2000, 1000],
		["just over 10%", 201, 2000, 1201],
		["499ms below 10%", 499, 10000, 1000],
		["500ms regardless of percentage", 500, 10000, 1500],
	])(
		"classifies %s at the overlap boundaries",
		(_, overlap, duration, endTime) => {
			const line = createLine(0, 1000 + overlap);
			const nextLine = createLine(1000, 1000 + duration);

			optimizeWith([line, nextLine], { cleanUnintentionalOverlaps: true });

			expect(line.endTime).toBe(endTime);
		},
	);

	it("checks later overlapping lines after an intentional overlap", () => {
		const longLine = createLine(0, 3000);
		const intentionallyOverlappingLine = createLine(1000, 2500);
		const slightlyOverlappingLine = createLine(2950, 3950);

		optimizeWith(
			[longLine, intentionallyOverlappingLine, slightlyOverlappingLine],
			{ cleanUnintentionalOverlaps: true },
		);

		expect(longLine.endTime).toBe(2950);
	});

	it("does not truncate an independent background line", () => {
		const mainLine = createLine(0, 1100);
		const backgroundLine = createLine(1050, 2000, { isBG: true });
		const nextMainLine = createLine(1000, 2000);

		optimizeWith([mainLine, backgroundLine, nextMainLine], {
			cleanUnintentionalOverlaps: true,
		});

		expect(mainLine.endTime).toBe(1000);
		expect(backgroundLine.endTime).toBe(2000);
	});

	it("keeps synchronized background end time aligned after overlap cleaning", () => {
		const mainLine = createLine(0, 1100);
		const backgroundLine = createLine(100, 1050, { isBG: true });
		const nextMainLine = createLine(1000, 2000);

		optimizeWith([mainLine, backgroundLine, nextMainLine], {
			syncMainAndBackgroundLines: true,
			cleanUnintentionalOverlaps: true,
		});

		expect(mainLine.endTime).toBe(1000);
		expect(backgroundLine.endTime).toBe(1000);
	});

	it("advances the first main line by at most 600ms without going below zero", () => {
		const laterLine = createLine(1000, 2000);
		const earlyLine = createLine(400, 800);

		optimizeWith([laterLine], { tryAdvanceStartTime: true });
		optimizeWith([earlyLine], { tryAdvanceStartTime: true });

		expect(laterLine.startTime).toBe(400);
		expect(earlyLine.startTime).toBe(0);
	});

	it.each([
		["a sufficient gap", 3000, 4000, 2400],
		["an exact boundary", 2000, 3000, 2000],
		["a 100ms overlap", 1900, 2900, 1830],
		["a 400ms overlap", 1600, 2600, 1200],
		["an overlap greater than 400ms", 1100, 2100, 700],
	])("advances a following line with %s", (_, startTime, endTime, expected) => {
		const firstLine = createLine(1000, 2000);
		const secondLine = createLine(startTime, endTime);

		optimizeWith([firstLine, secondLine], { tryAdvanceStartTime: true });

		expect(secondLine.startTime).toBe(expected);
	});

	it("uses the entire previous overlap group as the gap boundary", () => {
		const longLine = createLine(1000, 3000);
		const overlappingLine = createLine(2000, 2500);
		const followingLine = createLine(3100, 4000);

		optimizeWith([longLine, overlappingLine, followingLine], {
			tryAdvanceStartTime: true,
		});

		expect(followingLine.startTime).toBe(3000);
	});

	it("does not synchronize background start time when synchronization is disabled", () => {
		const mainLine = createLine(1000, 2000);
		const backgroundLine = createLine(1500, 1800, { isBG: true });

		optimizeWith([mainLine, backgroundLine], {
			tryAdvanceStartTime: true,
		});

		expect(mainLine.startTime).toBe(400);
		expect(backgroundLine.startTime).toBe(1500);
	});

	it("synchronizes background start time when synchronization is enabled", () => {
		const mainLine = createLine(1000, 2000);
		const backgroundLine = createLine(1500, 1800, { isBG: true });

		optimizeWith([mainLine, backgroundLine], {
			syncMainAndBackgroundLines: true,
			tryAdvanceStartTime: true,
		});

		expect(mainLine.startTime).toBe(400);
		expect(backgroundLine.startTime).toBe(400);
	});

	it("uses the advanced previous main line as the overlap boundary", () => {
		const firstMainLine = createLine(1000, 2000);
		const backgroundLine = createLine(1850, 2200, { isBG: true });
		const secondMainLine = createLine(1100, 2100);

		optimizeWith([firstMainLine, backgroundLine, secondMainLine], {
			tryAdvanceStartTime: true,
		});

		expect(secondMainLine.startTime).toBe(700);
	});
});
