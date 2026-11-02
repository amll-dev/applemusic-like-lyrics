// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricWord } from "#interfaces";
import type { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";
import styles from "#styles/lyric-player.module.css";

const lines: LyricLineEl[] = [];

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

describe("LyricLineEl word emphasis", () => {
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

	it("does not emphasize a long word with a sustained final syllable", () => {
		const words: LyricWord[] = [
			{ word: "It's ", startTime: 200961, endTime: 201112 },
			{ word: "a ", startTime: 201112, endTime: 201279 },
			{ word: "fe", startTime: 201279, endTime: 201402 },
			{ word: "mi", startTime: 201402, endTime: 201523 },
			{ word: "ni", startTime: 201523, endTime: 201715 },
			{ word: "no", startTime: 201715, endTime: 201927 },
			{ word: "me", startTime: 201927, endTime: 202090 },
			{ word: "non", startTime: 202090, endTime: 204600 },
		];
		const animate = vi.spyOn(HTMLElement.prototype, "animate");
		const main = renderWords(words);

		expect(main.textContent).toBe("It's a femininomenon");
		expect(main.querySelector(`.${styles.emphasize}`)).toBeNull();
		expect(animate).toHaveBeenCalledTimes(words.length);
		for (const [index, word] of words.entries()) {
			expect(animate).toHaveBeenNthCalledWith(index + 1, expect.any(Array), {
				id: "float-word",
				delay: word.startTime - words[0].startTime,
				duration: Math.max(1000, word.endTime - word.startTime),
				composite: "add",
				fill: "both",
				easing: "ease-out",
			});
		}
	});

	it.each([
		{ syllables: ["fore", "ver"], emphasized: true },
		{ syllables: ["some", "body"], emphasized: false },
		{ syllables: ["abcdefg", "h"], emphasized: false },
	])(
		"checks the combined length of $syllables",
		({ syllables, emphasized }) => {
			const main = renderWords(
				syllables.map((word, index) => ({
					word,
					startTime: index * 1200,
					endTime: (index + 1) * 1200,
				})),
			);

			expect(main.textContent).toBe(syllables.join(""));
			expect(main.querySelectorAll(`.${styles.emphasize}`)).toHaveLength(
				emphasized ? syllables.length : 0,
			);
		},
	);

	it.each([
		{ duration: 999, emphasized: false },
		{ duration: 1000, emphasized: true },
	])(
		"checks the combined duration of short syllables at $duration ms",
		({ duration, emphasized }) => {
			const main = renderWords([
				{ word: "su", startTime: 0, endTime: duration / 2 },
				{ word: "gar", startTime: duration / 2, endTime: duration },
			]);

			expect(main.textContent).toBe("sugar");
			expect(main.querySelectorAll(`.${styles.emphasize}`)).toHaveLength(
				emphasized ? 2 : 0,
			);
		},
	);

	it.each([
		{ word: "a", emphasized: false },
		{ word: "forever", emphasized: true },
		{ word: "somebody", emphasized: false },
	])("preserves emphasis for an unsplit $word", ({ word, emphasized }) => {
		const main = renderWords([{ word, startTime: 0, endTime: 1200 }]);

		expect(main.textContent).toBe(word);
		expect(main.querySelectorAll(`.${styles.emphasize}`)).toHaveLength(
			emphasized ? 1 : 0,
		);
	});

	it("preserves the duration threshold for individual CJK characters", () => {
		const main = renderWords([
			{ word: "\u4f60", startTime: 0, endTime: 999 },
			{ word: "\u597d", startTime: 999, endTime: 1999 },
		]);
		const emphasized = main.querySelectorAll(`.${styles.emphasize}`);

		expect(main.textContent).toBe("\u4f60\u597d");
		expect(emphasized).toHaveLength(1);
		expect(emphasized[0].textContent).toBe("\u597d");
	});
});
