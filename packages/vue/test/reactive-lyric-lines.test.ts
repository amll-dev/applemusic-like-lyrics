import type { LyricLine } from "@applemusic-like-lyrics/core";
import { describe, expect, it } from "vitest";
import { isProxy, ref } from "vue";
import { unwrapLyricLines } from "../src/utils/unwrap-lyric-lines";

function createLine(): LyricLine {
	return {
		words: [{ word: "test", startTime: 0, endTime: 1000 }],
		translatedLyric: "",
		romanLyric: "",
		startTime: 0,
		endTime: 1000,
		isBG: false,
		isDuet: false,
	};
}

describe("unwrapLyricLines", () => {
	it("unwraps deeply reactive lyric lines before passing them to core", () => {
		const lyricLines = ref<LyricLine[]>([createLine()]);

		expect(isProxy(lyricLines.value)).toBe(true);
		expect(isProxy(lyricLines.value[0])).toBe(true);

		const unwrapped = unwrapLyricLines(lyricLines.value);

		expect(isProxy(unwrapped)).toBe(false);
		expect(isProxy(unwrapped[0])).toBe(false);
		expect(() => structuredClone(unwrapped)).not.toThrow();
	});
});
