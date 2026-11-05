import { describe, expect, it } from "vitest";
import {
	calcBalancedBreaks,
	segmentForLineBreaks,
} from "#utils/lyric-line-break.ts";

const segmenter = new Intl.Segmenter("en", { granularity: "word" });

describe.each([segmenter, null])("line breaks with %s", (segmenter) => {
	it("discards a leading gap only at the selected line start", () => {
		const children = [
			{ text: "aaa", width: 70, isSpace: false },
			{ text: "中", width: 50, isSpace: false, leadingSpacing: 10 },
			{ text: "bbb", width: 60, isSpace: false, leadingSpacing: 10 },
		];

		expect(calcBalancedBreaks(children, 105, "aaa中bbb", segmenter)).toEqual([
			1,
		]);
		expect(
			calcBalancedBreaks(
				children.map(({ leadingSpacing: _, ...child }) => child),
				105,
				"aaa中bbb",
				segmenter,
			),
		).toEqual([1, 2]);
	});

	it("keeps the gap between nodes in the same candidate line", () => {
		expect(
			calcBalancedBreaks(
				[
					{ text: "中", width: 65, isSpace: false },
					{ text: "A", width: 65, isSpace: false, leadingSpacing: 10 },
				],
				120,
				"中A",
				segmenter,
			),
		).toEqual([1]);
	});
});

it("preserves words and graphemes in fallback line breaking", () => {
	const text = "中文AMLL2026 e\u0301 \u{1F469}\u{1F3FD}\u200D\u{1F4BB}𠀀";
	expect(
		[...segmentForLineBreaks(text, null)].map(({ segment, index }) => [
			segment,
			index,
		]),
	).toEqual([
		["中", 0],
		["文", 1],
		["AMLL2026", 2],
		[" ", 10],
		["e\u0301", 11],
		[" ", 13],
		["\u{1F469}\u{1F3FD}\u200D\u{1F4BB}", 14],
		["𠀀", 21],
	]);
});
