import { describe, expect, it } from "bun:test";
import { parseLrcA2, stringifylrcA2 } from "../src/formats/lrca2";
import { timeStampsTestCases } from "./timestampcase.fixture";

describe("lrca2", () => {
	it("parses basic word-timestamped line", () => {
		const lines = parseLrcA2(
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
		);

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[0].words[0].startTime).toBe(1000);
		expect(lines[0].words[0].endTime).toBe(1500);
		expect(lines[0].words[1].word).toBe(" ");
		expect(lines[0].words[2].word).toBe("World");
		expect(lines[0].words[2].startTime).toBe(1500);
		expect(lines[0].words[2].endTime).toBe(2000);
	});

	it("handles CRLF and ignores non-lyric lines", () => {
		const lines = parseLrcA2(
			"[ar: Artist]\r\n#comment\r\n{meta:true}\r\n[00:01.000]<00:01.000>Hello<00:02.000>",
		);

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
	});

	it("ignores lines with bad timestamps", () => {
		const lines = parseLrcA2(
			"[00:01.000]<00:01.000>Hello<00:02.000>\n[invalid]<00:03.000>Bad<00:04.000>\n[-1:00.000]<00:03.000>Bad<00:04.000>\n[NaN:NaN]<00:03.000>Bad<00:04.000>\n[00:03.000]<00:03.000>World<00:04.000>",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].endTime).toBe(4000);
		expect(lines[1].words.map((w) => w.word).join("")).toBe("World");
	});

	it("parses all kinds of valid line timestamps", () => {
		const input = timeStampsTestCases
			.map(([ts]) => `[${ts}]<${ts}>Word<${ts}>`)
			.join("\n");
		const lines = parseLrcA2(input);

		expect(lines).toHaveLength(timeStampsTestCases.length);
		lines.forEach((line, i) => {
			const [, ms] = timeStampsTestCases[i];
			expect(line.startTime).toBe(ms);
		});
	});

	it("ignores empty lines and lines with only whitespace", () => {
		const lines = parseLrcA2(
			"[00:00.000]   \n[00:01.000]<00:01.000>Hello<00:02.000>\n   \n\n[00:03.000]<00:03.000>World<00:04.000>\n   \n",
		);
		expect(lines).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].words[0].word).toBe("World");
	});

	it("stringifies words and preserves spaces", () => {
		const result = stringifylrcA2([
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

		expect(result).toBe(
			"[00:01.000]<00:01.000>Hello <00:02.000>World<00:03.000>",
		);
	});

	it("stringifies empty-word line as bare line timestamp", () => {
		const result = stringifylrcA2([
			{
				startTime: 1000,
				endTime: 1000,
				words: [],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[00:01.000]");
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifylrcA2([
			{
				startTime: Number.NaN,
				endTime: 0,
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

		expect(result).toBe("[00:00.000]<00:00.000>Hello<00:00.000>");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input =
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>\n[00:03.000]<00:03.000>Again<00:03.500>";
		const first = parseLrcA2(input);
		const text = stringifylrcA2(first);
		const second = parseLrcA2(text);

		expect(second).toEqual(first);
	});

	it("keeps exactly one space between adjacent words in '<time> word <time> word' pattern", () => {
		const input = "[00:01.000]<00:01.000> word <00:01.500> word<00:02.000>";
		const output = stringifylrcA2(parseLrcA2(input));

		expect(output).toBe(
			"[00:01.000]<00:01.000>word <00:01.500>word<00:02.000>",
		);
		expect(output).not.toContain("  ");
	});
});
