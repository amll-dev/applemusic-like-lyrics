// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";
import styles from "#styles/lyric-player.module.css";

describe("plain main-line annotations", () => {
	beforeEach(() => {
		vi.spyOn(HTMLElement.prototype, "animate").mockImplementation(
			() => ({ pause: vi.fn(), cancel: vi.fn() }) as unknown as Animation,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([500, 1500])(
		"keeps annotations plain with a %ims word while spacing body text",
		(duration) => {
			const player = {
				_getIsNonDynamic: () => false,
				getEnableTextAutospace: () => true,
			} as unknown as DomLyricPlayer;
			const line = new LyricLineEl(player, {
				words: [
					{
						word: "中A",
						startTime: 0,
						endTime: duration,
						romanWord: " 中A ",
						ruby: [
							{ word: "中A", startTime: 0, endTime: duration / 2 },
							{ word: "文2", startTime: duration / 2, endTime: duration },
						],
					},
					{ word: "文B", startTime: duration, endTime: duration + 500 },
				],
				startTime: 0,
				endTime: duration + 500,
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			});
			try {
				line.rebuildElement();
				const main = line.getElement().children[0];
				const ruby = main.querySelector(`.${styles.rubyWord}`);
				expect(ruby?.textContent).toBe("中A文2");
				expect(ruby?.children).toHaveLength(2);
				for (const part of ruby?.children ?? []) {
					expect(part.childElementCount).toBe(0);
					expect(part.classList.contains(styles.textAutospaceBefore)).toBe(
						false,
					);
				}
				const romans = main.querySelectorAll(`.${styles.romanWord}`);
				expect(Array.from(romans, (el) => el.textContent)).toEqual([
					"中A",
					"\u00A0",
				]);
				for (const annotation of main.querySelectorAll(
					`.${styles.rubyWord}, .${styles.romanWord}`,
				)) {
					expect(
						annotation.querySelector(
							`.${styles.textAutospaceRun}, .${styles.textAutospaceBefore}`,
						),
					).toBeNull();
					expect(
						annotation.classList.contains(styles.textAutospaceBefore),
					).toBe(false);
				}
				for (const base of main.querySelectorAll(`.${styles.rubyBaseWord}`)) {
					expect(
						base.querySelector(`.${styles.textAutospaceBefore}`),
					).not.toBeNull();
				}
			} finally {
				line.dispose();
			}
		},
	);
});
