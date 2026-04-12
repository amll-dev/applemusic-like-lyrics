import { describe, expect, it } from "bun:test";
import { parseLyl, stringifyLyl } from "../src/formats/lyl";

describe("lyl", () => {
	it("parses basic line-timestamped lines", () => {
		const lines = parseLyl("[1000,2000]Hello\n[3000,4000]World");

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].endTime).toBe(4000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("handles CRLF and ignores non-lyric lines", () => {
		const lines = parseLyl(
			"[type:LyricifyLines]\r\n#comment\r\n{meta:true}\r\nno timestamp\r\n[1000,2000]Hello",
		);

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
	});

	it("ignores lines with bad timestamps", () => {
		const lines = parseLyl(
			"[1000,2000]Hello\n[invalid,2000]Bad\n[-1,2000]Bad\n[NaN,NaN]Bad\n[3000,4000]World",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].endTime).toBe(4000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("identifies background lines with parentheses", () => {
		const lines = parseLyl(
			"[1000,2000](Hello)\n[3000,4000]（Hi）\n[5000,6000]World",
		);

		expect(lines).toHaveLength(3);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].isBG).toBe(true);
		expect(lines[1].words[0].word).toBe("Hi");
		expect(lines[2].isBG).toBe(false);
		expect(lines[2].words[0].word).toBe("World");
	});

	it("trims whitespace from lines and ignore empty lines", () => {
		const lines = parseLyl(
			"[0,500]\n[600,1000]   \n[1000,2000]   Hello   \n\n[3000,4000] World \n[5000,6000]   \n",
		);
		expect(lines).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].words[0].word).toBe("World");
	});

	it("stringifies with header and bg markers", () => {
		const result = stringifyLyl([
			{
				startTime: 1000,
				endTime: 2000,
				words: [
					{ startTime: 1000, endTime: 2000, word: "Hello", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: true,
				isDuet: false,
			},
			{
				startTime: 3000,
				endTime: 4000,
				words: [
					{ startTime: 3000, endTime: 4000, word: "World", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe(
			"[type:LyricifyLines]\n[1000,2000](Hello)\n[3000,4000]World",
		);
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyLyl([
			{
				startTime: Number.NaN,
				endTime: Number.POSITIVE_INFINITY,
				words: [{ startTime: 0, endTime: 0, word: "Hello", romanWord: "" }],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
			{
				startTime: -1,
				endTime: -2,
				words: [{ startTime: 0, endTime: 0, word: "World", romanWord: "" }],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[type:LyricifyLines]\n[0,0]Hello\n[0,0]World");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input = "[1000,2000]Hello\n[3000,4000](World)";
		const first = parseLyl(input);
		const text = stringifyLyl(first);
		const second = parseLyl(text);

		expect(second).toEqual(first);
	});
});
