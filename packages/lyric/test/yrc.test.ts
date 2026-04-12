import { describe, expect, it } from "bun:test";
import { parseYrc, stringifyYrc } from "../src/formats/yrc";

describe("yrc", () => {
	it("parses basic word-timestamped line", () => {
		const lines = parseYrc(
			"[1000,1000](1000,500,0)Hello(1500,500,0)World\n[3000,1000](3000,1000,0)Again",
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
		const lines = parseYrc(
			"no timestamp\r\n[invalid,100](0,100,0)Bad\r\n[-1,100](0,100,0)Bad\r\n[1000,1000](1000,1000,0)Hello",
		);

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
	});

	it("ignores empty lines and lines with only whitespace", () => {
		const lines = parseYrc(
			"[0,20]   \n[0,20]\n[0,20](10,10,0)Test\n   \n\n[0,20]   \n",
		);
		expect(lines).toHaveLength(1);
		expect(lines[0].words[0].word).toBe("Test");
	});

	it("stringifies words and preserves spaces", () => {
		const result = stringifyYrc([
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

		expect(result).toBe("[1000,2000](1000,1000,0)Hello (2000,1000,0)World");
	});

	it("stringifies bg lines with full-width wrapping parentheses", () => {
		const result = stringifyYrc([
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

		expect(result).toBe("[1000,1000](1000,1000,0)（Hello）");
	});

	it("parses and keeps bg wrapper lines stable", () => {
		const input = "[1000,1000](1000,1000,0)（Hello, (2000,2000,0)world）";
		const lines = parseYrc(input);

		expect(lines).toHaveLength(1);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].words).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Hello, ");
		expect(lines[0].words[1].word).toBe("world");
		expect(stringifyYrc(lines)).toBe(input);
	});

	it("keeps parenthesized fragments in plain word text", () => {
		const lines = parseYrc("[0,20](0,10,0)A(x)(10,10,0) B");

		expect(lines).toHaveLength(1);
		expect(lines[0].words.map((w) => w.word)).toEqual(["A(x)", " B"]);
		expect(lines[0].words[0].startTime).toBe(0);
		expect(lines[0].words[0].endTime).toBe(10);
		expect(lines[0].words[1].startTime).toBe(10);
		expect(lines[0].words[1].endTime).toBe(20);
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyYrc([
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

		expect(result).toBe("[0,0](0,0,0)Hello");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input =
			"[1000,1000](1000,500,0)Hello (1500,500,0)World\n[3000,1000](3000,1000,0)Again";
		const first = parseYrc(input);
		const text = stringifyYrc(first);
		const second = parseYrc(text);

		expect(second).toEqual(first);
	});
});
