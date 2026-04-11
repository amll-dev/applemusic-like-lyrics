import { describe, expect, it } from "vitest";
import { parseQRC, stringifyQRC } from "../src/formats/qrc";

describe("qrc", () => {
	it("parses basic word-timestamped line", () => {
		const lines = parseQRC(
			"[1000,1000]Hello(1000,500)World(1500,500)\n[3000,1000]Again(3000,1000)",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[0].words[0].startTime).toBe(1000);
		expect(lines[0].words[0].endTime).toBe(1500);
		expect(lines[0].words[1].word).toBe("World");
		expect(lines[0].words[1].startTime).toBe(1500);
		expect(lines[0].words[1].endTime).toBe(2000);
		expect(lines[1].words[0].word).toBe("Again");
	});

	it("handles CRLF and ignores lines without valid line timestamp", () => {
		const lines = parseQRC(
			"no timestamp\r\n[invalid,100]Bad(0,100)\r\n[-1,100]Bad(0,100)\r\n[1000,1000]Hello(1000,1000)",
		);

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
	});

	it("ignores empty lines and lines with only whitespace", () => {
		const lines = parseQRC(
			"[0,20]   \n[0,20]\n[0,20]Test(10,10)\n   \n\n[0,20]   \n",
		);
		expect(lines).toHaveLength(1);
		expect(lines[0].words[0].word).toBe("Test");
	});

	it("stringifies words and preserves spaces", () => {
		const result = stringifyQRC([
			{
				startTime: 1000,
				endTime: 3000,
				words: [
					{ startTime: 1000, endTime: 2000, word: "Hello", romanWord: "" },
					{ startTime: 0, endTime: 0, word: " ", romanWord: "" },
					{ startTime: 2000, endTime: 3000, word: "World", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[1000,2000]Hello(1000,1000) World(2000,1000)");
	});

	it("stringifies bg lines with full-width wrapping parentheses", () => {
		const result = stringifyQRC([
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
		]);

		expect(result).toBe("[1000,1000]（Hello）(1000,1000)");
	});

	it("parses and keeps bg wrapper lines stable", () => {
		const input = "[1000,1000]（Hello,(1000,1000) world）(2000,2000)";
		const lines = parseQRC(input);

		expect(lines).toHaveLength(1);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].words).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Hello,");
		expect(lines[0].words[1].word).toBe(" world");
		expect(stringifyQRC(lines)).toBe(input);
	});

	it("keeps parenthesized fragments in plain word text", () => {
		const lines = parseQRC("[0,20]A(x)B(0,10) C(10,10)");

		expect(lines).toHaveLength(1);
		expect(lines[0].words.map((w) => w.word)).toEqual(["A(x)B", " C"]);
		expect(lines[0].words[0].startTime).toBe(0);
		expect(lines[0].words[0].endTime).toBe(10);
		expect(lines[0].words[1].startTime).toBe(10);
		expect(lines[0].words[1].endTime).toBe(20);
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyQRC([
			{
				startTime: Number.NaN,
				endTime: Number.POSITIVE_INFINITY,
				words: [
					{
						startTime: -1,
						endTime: Number.POSITIVE_INFINITY,
						word: "Hello",
						romanWord: "",
					},
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[0,0]Hello(0,0)");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input =
			"[1000,1000]Hello (1000,500)World(1500,500)\n[3000,1000]Again(3000,1000)";
		const first = parseQRC(input);
		const text = stringifyQRC(first);
		const second = parseQRC(text);

		expect(second).toEqual(first);
	});
});
