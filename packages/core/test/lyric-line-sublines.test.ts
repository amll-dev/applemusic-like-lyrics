// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";
import styles from "#styles/lyric-player.module.css";

describe.each([true, false])(
	"plain sub-lines (non-dynamic: %s)",
	(nonDynamic) => {
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
			vi.restoreAllMocks();
		});

		it.each(["我们在Tokyo直到3点", "", "<b>中A</b> & かな2"])(
			"preserves %j as plain text across rebuilds with autospace enabled",
			(text) => {
				const player = {
					_getIsNonDynamic: () => nonDynamic,
					getEnableTextAutospace: () => true,
				} as unknown as DomLyricPlayer;
				const line = new LyricLineEl(player, {
					words: [{ word: "中A", startTime: 0, endTime: 500 }],
					startTime: 0,
					endTime: 500,
					translatedLyric: text,
					romanLyric: text,
					isBG: false,
					isDuet: false,
				});
				try {
					for (let i = 0; i < 2; i++) {
						line.rebuildElement();
						const [main, trans, roman] = line.getElement().children;
						for (const sub of [trans, roman]) {
							expect(sub.textContent).toBe(text);
							expect(sub.childElementCount).toBe(0);
						}
						expect(
							main.querySelector(`.${styles.textAutospaceBefore}`),
						).not.toBeNull();
					}
				} finally {
					line.dispose();
				}
			},
		);
	},
);
