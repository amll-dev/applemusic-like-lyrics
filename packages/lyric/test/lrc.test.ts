import { describe, expect, it } from "bun:test";
import { parseLrc, stringifyLrc } from "../src/formats/lrc";
import { MAX_LRC_TIMESTAMP } from "../src/utils";
import { timeStampsTestCases } from "./timestampcase.fixture";

describe("lrc", () => {
	it("parses basic timestamped lines", () => {
		const lines = parseLrc("[00:01.120]Hello\n[00:03.000]World");

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("handles CRLF line breaks correctly", () => {
		const lines = parseLrc("[00:01.120]Hello\r\n[00:03.000]World");

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("parses multiple timestamps for the same line", () => {
		const lines = parseLrc("[00:01.120][00:02.000]Hello");

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(2000);
		expect(lines[1].words[0].word).toBe("Hello");
	});

	it("ignores lines without timestamps", () => {
		const lines = parseLrc(
			"This is a line without timestamp\n[ar: Artist]\n[00:01.120]Hello\n# This is a comment\n{ some: 'metadata' }\n\n[00:03.000]World",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("ignores lines with bad timestamps", () => {
		const lines = parseLrc(
			"[00:01.120]Hello\n[invalid]Bad line\n[xx:yy.zzz]Bad line\n[-1:00.000]Bad line\n[NaN:NaN]Bad line\n[00:03.000]World",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("sorts lines by timestamp and sets end times correctly", () => {
		const lines = parseLrc("[00:03.000]World\n[00:01.120][00:05.000]Hello");

		expect(lines).toHaveLength(3);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].endTime).toBe(5000);
		expect(lines[1].words[0].word).toBe("World");
		expect(lines[2].startTime).toBe(5000);
		expect(lines[2].endTime).toBe(MAX_LRC_TIMESTAMP);
		expect(lines[2].words[0].word).toBe("Hello");
	});

	it("parses all kinds of timestamps", () => {
		const input = timeStampsTestCases
			.map(([ts, ms]) => `[${ts}]Should be ${ts} = ${ms} ms`)
			.join("\n");
		const lines = parseLrc(input);
		expect(lines).toHaveLength(timeStampsTestCases.length);
		lines.forEach((line, i) => {
			const [ts, ms] = timeStampsTestCases[i];
			expect(line.words[0].word).toBe(`Should be ${ts} = ${ms} ms`);
			expect(line.startTime).toBe(ms);
		});
	});

	it("identifies background lines with parentheses", () => {
		const lines = parseLrc(
			"[00:01.120](Hello)\n[00:03.000]（Hi）\n[00:03.000]World",
		);

		expect(lines).toHaveLength(3);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].words).toHaveLength(1);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].isBG).toBe(true);
		expect(lines[1].words).toHaveLength(1);
		expect(lines[1].words[0].word).toBe("Hi");
		expect(lines[2].isBG).toBe(false);
		expect(lines[2].words).toHaveLength(1);
		expect(lines[2].words[0].word).toBe("World");
	});

	it("trims whitespace from lines and ignore empty lines, while preserving end times", () => {
		const lines = parseLrc(
			"[00:00.000]\n[00:01.000]   \n[00:01.120] Hello   \n[00:02.333]\n[00:03.000] World \n[00:05.000]   \n",
		);
		expect(lines).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[0].endTime).toBe(2333);
		expect(lines[1].words[0].word).toBe("World");
		expect(lines[1].endTime).toBe(5000);
	});

	it("stringifies background lines with parentheses and normal lines without", () => {
		const lines = [
			{
				startTime: 1120,
				endTime: 3000,
				words: [
					{ startTime: 1120, endTime: 3000, word: "Hello", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: true,
				isDuet: false,
			},
			{
				startTime: 3000,
				endTime: 3000,
				words: [
					{ startTime: 3000, endTime: 3000, word: "World", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		];

		const result = stringifyLrc(lines);
		expect(result).toBe("[00:01.120](Hello)\n[00:03.000]World");
	});

	it("stringifies lines to expected lrc text", () => {
		const result = stringifyLrc([
			{
				startTime: 1120,
				endTime: 3000,
				words: [
					{ startTime: 1120, endTime: 3000, word: "Hello", romanWord: "" },
					{ startTime: 0, endTime: 0, word: " ", romanWord: "" },
					{ startTime: 1120, endTime: 3000, word: "world!", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[00:01.120]Hello world!");
	});

	it("normalizes invalid startTime when stringifying", () => {
		const baseLine = {
			endTime: 3000,
			words: [{ startTime: 0, endTime: 0, word: "Hello", romanWord: "" }],
			translatedLyric: "",
			romanLyric: "",
			isBG: false,
			isDuet: false,
		};

		expect(stringifyLrc([{ ...baseLine, startTime: -1 }])).toBe(
			"[00:00.000]Hello",
		);
		expect(stringifyLrc([{ ...baseLine, startTime: Number.NaN }])).toBe(
			"[00:00.000]Hello",
		);
		expect(
			stringifyLrc([{ ...baseLine, startTime: Number.POSITIVE_INFINITY }]),
		).toBe("[00:00.000]Hello");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input = "[00:01.120]Hello\n[00:03.000](World)";
		const first = parseLrc(input);
		const text = stringifyLrc(first);
		const second = parseLrc(text);

		expect(second).toEqual(first);
	});
});
