import { describe, expect, it } from "vitest";
import {
	type ChildNodeInfo,
	calcBalancedBreaks,
} from "#utils/lyric-line-break.ts";

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

function createChildren(parts: [string, number][]): ChildNodeInfo[] {
	return parts.map(([text, width]) => ({
		text,
		width,
		isSpace: /^\s+$/.test(text),
	}));
}

describe("calcBalancedBreaks", () => {
	it.each(["word", "a", "foomr", "best"])(
		"does not reward the ASCII period after %s",
		(word) => {
			const children = createChildren([
				["Hello", 50],
				[" ", 10],
				[`${word}.`, 30],
				[" ", 10],
				["Smith", 50],
				[" ", 10],
				["today", 50],
			]);

			expect(
				calcBalancedBreaks(
					children,
					130,
					`Hello ${word}. Smith today`,
					segmenter,
				),
			).toEqual([4]);
		},
	);

	it("still prefers a break after a full-width CJK period", () => {
		const children = createChildren([
			["你好", 20],
			["。", 10],
			["今天", 20],
			["阳光", 20],
			["灿烂", 20],
		]);

		expect(
			calcBalancedBreaks(children, 60, "你好。今天阳光灿烂", segmenter),
		).toEqual([2]);
	});

	it.each([210, 220])(
		"returns no breaks when the total width fits a container of width %i",
		(containerWidth) => {
			const children = createChildren([
				["Hello", 50],
				[" ", 10],
				["word.", 30],
				[" ", 10],
				["Smith", 50],
				[" ", 10],
				["today", 50],
			]);

			expect(
				calcBalancedBreaks(
					children,
					containerWidth,
					"Hello word. Smith today",
					segmenter,
				),
			).toEqual([]);
		},
	);
});
