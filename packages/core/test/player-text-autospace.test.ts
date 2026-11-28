// @vitest-environment happy-dom

import { expect, it, vi } from "vitest";
import { DomLyricPlayer } from "#lyric/dom/index.ts";
import styles from "#styles/lyric-player.module.css";

it("defaults off, rebuilds on toggles, and ignores unchanged values", () => {
	const player = new DomLyricPlayer();
	const element = player.getElement();
	const enabledClass = () =>
		element.classList.contains(styles.enableTextAutospace);
	const rebuild = vi
		.spyOn(player, "rebuildLyricLines")
		.mockImplementation(() => {
			expect(enabledClass()).toBe(player.getEnableTextAutospace());
		});
	try {
		expect(player.getEnableTextAutospace()).toBe(false);
		expect(enabledClass()).toBe(false);
		player.setEnableTextAutospace();
		expect(rebuild).not.toHaveBeenCalled();
		player.setEnableTextAutospace(true);
		expect(rebuild).toHaveBeenCalledTimes(1);
		expect(player.getEnableTextAutospace()).toBe(true);
		expect(enabledClass()).toBe(true);
		player.setEnableTextAutospace(true);
		expect(rebuild).toHaveBeenCalledTimes(1);
		player.setEnableTextAutospace();
		expect(rebuild).toHaveBeenCalledTimes(2);
		expect(player.getEnableTextAutospace()).toBe(false);
		expect(enabledClass()).toBe(false);
	} finally {
		rebuild.mockRestore();
		player.dispose();
	}
});
