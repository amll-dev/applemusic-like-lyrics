// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";
import styles from "#styles/lyric-player.module.css";

describe("player text autospace", () => {
	it.each(["中A", "", "<b>中A</b>"])(
		"rebuilds plain main text %j on toggles without seeking",
		(text) => {
			const player = new DomLyricPlayer();
			vi.spyOn(player, "_getIsNonDynamic").mockReturnValue(true);
			const line = new LyricLineEl(player, {
				words: [{ word: text, startTime: 0, endTime: 1000 }],
				startTime: 0,
				endTime: 1000,
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			});
			const rebuild = vi
				.spyOn(player, "rebuildLyricLines")
				.mockImplementation(() => line.rebuildElement());
			try {
				player.setCurrentTime(500);
				line.rebuildElement();
				const main = line.getElement().children[0];
				expect(main.innerHTML).toBe(
					document
						.createTextNode(text)
						.textContent?.replaceAll("&", "&amp;")
						.replaceAll("<", "&lt;")
						.replaceAll(">", "&gt;"),
				);
				expect(main.childElementCount).toBe(0);
				player.setEnableTextAutospace(true);
				expect(rebuild).toHaveBeenCalledTimes(1);
				expect(main.textContent).toBe(text);
				expect(
					Boolean(main.querySelector(`.${styles.textAutospaceBefore}`)),
				).toBe(text.length > 0);
				expect(
					player.getElement().classList.contains(styles.enableTextAutospace),
				).toBe(true);
				expect(player.getCurrentTime()).toBe(500);
				player.setEnableTextAutospace(false);
				expect(rebuild).toHaveBeenCalledTimes(2);
				expect(main.textContent).toBe(text);
				expect(main.childElementCount).toBe(0);
				expect(player.getCurrentTime()).toBe(500);
			} finally {
				line.dispose();
				player.dispose();
				vi.restoreAllMocks();
			}
		},
	);

	it("starts disabled and restores the disabled default after opt-in", () => {
		const player = new DomLyricPlayer();
		const spacing = () =>
			player.getElement().style.getPropertyValue("--amll-lp-text-autospace");
		const rebuild = vi.spyOn(player, "rebuildLyricLines");
		try {
			expect(player.getEnableTextAutospace()).toBe(false);
			expect(spacing()).toBe("");
			player.setEnableTextAutospace();
			expect(rebuild).not.toHaveBeenCalled();
			player.setEnableTextAutospace(true);
			expect(rebuild).toHaveBeenCalledTimes(1);
			expect(player.getEnableTextAutospace()).toBe(true);
			expect(spacing()).toBe("0.125em");
			player.setEnableTextAutospace(true);
			expect(rebuild).toHaveBeenCalledTimes(1);
			player.setEnableTextAutospace();
			expect(rebuild).toHaveBeenCalledTimes(2);
			expect(player.getEnableTextAutospace()).toBe(false);
			expect(spacing()).toBe("0em");
		} finally {
			rebuild.mockRestore();
			player.dispose();
		}
	});
});
