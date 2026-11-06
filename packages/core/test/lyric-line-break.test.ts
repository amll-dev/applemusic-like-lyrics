import { expect, it } from "vitest";
import { calcBalancedBreaks } from "../src/utils/lyric-line-break.ts";

it("在对不起之前断行，避免切开第一九四三句", () => {
	const text = "说了第一九四三句对不起之后";
	const children = [...text].map((text) => ({
		width: 1,
		text,
		isSpace: false,
	}));
	const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

	expect(calcBalancedBreaks(children, 8, text, segmenter)).toEqual([8]);
});
