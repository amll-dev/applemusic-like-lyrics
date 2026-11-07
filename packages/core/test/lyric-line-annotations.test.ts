// @vitest-environment happy-dom

import { expect, it, vi } from "vitest";
import type { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";
import styles from "#styles/lyric-player.module.css";

it("spaces main text but leaves annotations and sub-lines plain", () => {
	vi.spyOn(HTMLElement.prototype, "animate").mockImplementation(
		() => ({ pause: vi.fn(), cancel: vi.fn() }) as unknown as Animation,
	);
	const player = {
		_getIsNonDynamic: () => false,
		getEnableTextAutospace: () => true,
	} as unknown as DomLyricPlayer;
	const line = new LyricLineEl(player, {
		words: [
			{
				word: "中A",
				startTime: 0,
				endTime: 500,
				romanWord: "中A",
				ruby: [{ word: "中A", startTime: 0, endTime: 500 }],
			},
		],
		startTime: 0,
		endTime: 500,
		translatedLyric: "中A",
		romanLyric: "中A",
		isBG: false,
		isDuet: false,
	});
	try {
		line.rebuildElement();
		const [main, trans, roman] = line.getElement().children;
		expect(
			main.querySelector(
				`.${styles.rubyBaseWord} .${styles.textAutospaceBefore}`,
			),
		).not.toBeNull();
		for (const annotation of main.querySelectorAll(
			`.${styles.rubyWord}, .${styles.romanWord}`,
		)) {
			expect(annotation.textContent).toBe("中A");
			expect(annotation.matches(`.${styles.textAutospaceBefore}`)).toBe(false);
			expect(
				annotation.querySelector(
					`.${styles.textAutospaceBefore}, .${styles.textAutospaceRun}`,
				),
			).toBeNull();
		}
		for (const sub of [trans, roman]) {
			expect(sub.textContent).toBe("中A");
			expect(sub.childElementCount).toBe(0);
		}
	} finally {
		line.dispose();
		vi.restoreAllMocks();
	}
});
