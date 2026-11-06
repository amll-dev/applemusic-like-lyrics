// @vitest-environment happy-dom

import { expect, it, vi } from "vitest";
import { DomLyricPlayer } from "#lyric/dom/index.ts";
import styles from "#styles/lyric-player.module.css";

it("defaults off, rebuilds on toggles, and ignores unchanged values", () => {
	const player = new DomLyricPlayer();
	const rebuild = vi.spyOn(player, "rebuildLyricLines");
	const element = player.getElement();
	const spacing = () =>
		element.style.getPropertyValue("--amll-lp-text-autospace");
	const enabledClass = () =>
		element.classList.contains(styles.enableTextAutospace);
	try {
		expect(player.getEnableTextAutospace()).toBe(false);
		expect(enabledClass()).toBe(false);
		expect(spacing()).toBe("");
		player.setEnableTextAutospace();
		expect(rebuild).not.toHaveBeenCalled();
		player.setEnableTextAutospace(true);
		expect(rebuild).toHaveBeenCalledTimes(1);
		expect(player.getEnableTextAutospace()).toBe(true);
		expect(enabledClass()).toBe(true);
		expect(spacing()).toBe("0.125em");
		player.setEnableTextAutospace(true);
		expect(rebuild).toHaveBeenCalledTimes(1);
		player.setEnableTextAutospace();
		expect(rebuild).toHaveBeenCalledTimes(2);
		expect(player.getEnableTextAutospace()).toBe(false);
		expect(enabledClass()).toBe(false);
		expect(spacing()).toBe("0em");
	} finally {
		rebuild.mockRestore();
		player.dispose();
	}
});
