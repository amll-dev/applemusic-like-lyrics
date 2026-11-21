import { expect, it } from "vitest";
import { calcBalancedBreaks } from "#utils/lyric-line-break.ts";

it("discards leading spacing at the selected line start", () => {
	const children = [
		{ text: "aaa", width: 70, isSpace: false },
		{ text: "中", width: 50, isSpace: false, leadingSpacing: 10 },
		{ text: "bbb", width: 60, isSpace: false, leadingSpacing: 10 },
	];
	const breaks = (nodes: typeof children) =>
		calcBalancedBreaks(
			nodes,
			105,
			"aaa中bbb",
			new Intl.Segmenter("en", { granularity: "word" }),
		);
	expect(breaks(children)).toEqual([1]);
	expect(
		breaks(children.map((child) => ({ ...child, leadingSpacing: 0 }))),
	).toEqual([1, 2]);
});
