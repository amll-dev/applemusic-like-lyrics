// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricWord } from "#interfaces";
import type { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";

const lines: LyricLineEl[] = [];

/**
 * Issue #652 提供的 Enhanced LRC 歌词：
 * [00:00.00]<00:00.00>जैसे, <00:00.50>जैसे, <00:01.00>बंदूक <00:01.50>की <00:02.00>गोली
 */
const devanagariWords: LyricWord[] = [
	{ word: "जैसे, ", startTime: 0, endTime: 500 },
	{ word: "जैसे, ", startTime: 500, endTime: 1000 },
	{ word: "बंदूक ", startTime: 1000, endTime: 1500 },
	{ word: "की ", startTime: 1500, endTime: 2000 },
	{ word: "गोली", startTime: 2000, endTime: 2500 },
];

function renderWords(words: LyricWord[]): HTMLElement {
	const player = {
		_getIsNonDynamic: () => false,
	} as unknown as DomLyricPlayer;
	const line = new LyricLineEl(player, {
		words,
		startTime: Math.min(...words.map((word) => word.startTime)),
		endTime: Math.max(...words.map((word) => word.endTime)),
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
	});
	lines.push(line);
	line.rebuildElement();
	return line.getElement().children[0] as HTMLElement;
}

describe("LyricLineEl Devanagari word rendering", () => {
	beforeEach(() => {
		vi.spyOn(HTMLElement.prototype, "animate").mockImplementation(
			() =>
				({
					pause: vi.fn(),
					cancel: vi.fn(),
				}) as unknown as Animation,
		);
	});

	afterEach(() => {
		for (const line of lines) line.dispose();
		lines.length = 0;
		vi.restoreAllMocks();
	});

	it("keeps the full line text intact", () => {
		const main = renderWords(devanagariWords);

		expect(main.textContent).toBe("जैसे, जैसे, बंदूक की गोली");
	});

	it("never starts a span with a combining mark", () => {
		const main = renderWords(devanagariWords);
		const spans = main.querySelectorAll("span");

		expect(spans.length).toBeGreaterThan(0);
		for (const span of spans) {
			expect(span.textContent ?? "").not.toMatch(/^\p{M}/u);
		}
	});

	it("renders each Devanagari word as a whole", () => {
		const main = renderWords(devanagariWords);
		const spanTexts = Array.from(
			main.querySelectorAll("span"),
			(span) => span.textContent,
		);

		expect(spanTexts).toContain("बंदूक");
		expect(spanTexts).toContain("की");
		expect(spanTexts).toContain("गोली");
	});
});
