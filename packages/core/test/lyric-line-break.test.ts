import { describe, expect, it } from "vitest";
import {
	calcBalancedBreaks,
	type ChildNodeInfo,
} from "#utils/lyric-line-break.ts";

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const abbreviations = [
	"Mr",
	"Ms",
	"Mrs",
	"Dr",
	"Prof",
	"St",
	"Jr",
	"Sr",
	"vs",
	"etc",
	"e.g",
	"i.e",
	"U.S",
	"U.K",
	"A",
	"mR",
	"PROF",
	"u.s",
];

function createChildren(parts: [string, number][]): ChildNodeInfo[] {
	return parts.map(([text, width]) => ({
		text,
		width,
		isSpace: /^\s+$/.test(text),
	}));
}

describe("calcBalancedBreaks", () => {
	it.each(abbreviations)(
		"keeps %s. with the following word at whole-word granularity",
		(abbreviation) => {
			const children = createChildren([
				["Hello", 50],
				[" ", 10],
				[`${abbreviation}.`, 30],
				[" ", 10],
				["Smith", 50],
				[" ", 10],
				["today", 50],
			]);

			const result = calcBalancedBreaks(
				children,
				130,
				`Hello ${abbreviation}. Smith today`,
				segmenter,
			);

			expect(result.length).toBeGreaterThan(0);
			expect(result).not.toContain(3);
			expect(result).not.toContain(4);
		},
	);

	it.each(abbreviations)(
		"protects all three boundaries around %s. at Segmenter granularity",
		(abbreviation) => {
			const children = createChildren([
				["Hello", 50],
				[" ", 10],
				[abbreviation, 20],
				[".", 10],
				[" ", 10],
				["Smith", 50],
				[" ", 10],
				["today", 50],
			]);

			const result = calcBalancedBreaks(
				children,
				130,
				`Hello ${abbreviation}. Smith today`,
				segmenter,
			);

			expect(result.length).toBeGreaterThan(0);
			expect(result).not.toContain(3);
			expect(result).not.toContain(4);
			expect(result).not.toContain(5);
		},
	);

	it.each(["word", "a", "foomr", "best"])(
		"does not reward the ASCII period or protect the ordinary word %s",
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
				["Mr.", 30],
				[" ", 10],
				["Smith", 50],
				[" ", 10],
				["today", 50],
			]);

			expect(
				calcBalancedBreaks(
					children,
					containerWidth,
					"Hello Mr. Smith today",
					segmenter,
				),
			).toEqual([]);
		},
	);

	it("keeps protected breaks available when children exceed the container", () => {
		const children = createChildren([
			["Mr", 20],
			[".", 10],
			[" ", 10],
			["Smith", 50],
		]);

		expect(calcBalancedBreaks(children, 10, "Mr. Smith", segmenter)).toEqual([
			1, 2, 3,
		]);
	});
});
