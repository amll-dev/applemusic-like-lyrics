// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { DomLyricPlayer } from "#lyric/dom/index.ts";

describe("player text autospace", () => {
	it("starts disabled and restores the disabled default after opt-in", () => {
		const player = new DomLyricPlayer();
		const spacing = () =>
			player.getElement().style.getPropertyValue("--amll-lp-text-autospace");
		try {
			expect(player.getEnableTextAutospace()).toBe(false);
			expect(spacing()).toBe("0em");
			expect(player.setEnableTextAutospace()).toBe(false);
			expect(player.setEnableTextAutospace(true)).toBe(true);
			expect(player.getEnableTextAutospace()).toBe(true);
			expect(spacing()).toBe("0.125em");
			expect(player.setEnableTextAutospace(true)).toBe(false);
			expect(player.setEnableTextAutospace()).toBe(true);
			expect(player.getEnableTextAutospace()).toBe(false);
			expect(spacing()).toBe("0em");
		} finally {
			player.dispose();
		}
	});
});
