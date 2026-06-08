import { describe, expect, it } from "vitest";
import { computeGroupPresentation } from "../src/lyric-player/base/layout.ts";

describe("lyric group presentation", () => {
	it("keeps a buffered group mounted without treating it as active", () => {
		const presentation = computeGroupPresentation({
			groupIndex: 0,
			scrollToIndex: 1,
			latestIndex: 1,
			hasHot: false,
			hasBuffered: true,
			hidePassedLines: false,
			isPlaying: true,
			isNonDynamic: false,
			enableBlur: true,
			isUserScrolling: false,
			isCompact: false,
		});

		expect(presentation.isActive).toBe(false);
		expect(presentation.shouldKeepMounted).toBe(true);
	});
});
