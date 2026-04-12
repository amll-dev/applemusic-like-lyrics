import { describe, expect, it } from "bun:test";
import { parseEslrc, stringifyEslrc } from "../src/formats/eslrc";

describe("eslrc", () => {
	it("parses basic word-ended-timestamp lines", () => {
		const lines = parseEslrc(
			"[00:10.82]Test[00:10.97] Word[00:12.62]\n[00:12.62]Next[00:13.20] line[00:14.10]",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(10820);
		expect(lines[0].endTime).toBe(12620);
		expect(lines[0].words[0].word).toBe("Test");
		expect(lines[0].words[0].startTime).toBe(10820);
		expect(lines[0].words[0].endTime).toBe(10970);
		expect(lines[0].words[1].word).toBe(" Word");
		expect(lines[0].words[1].startTime).toBe(10970);
		expect(lines[0].words[1].endTime).toBe(12620);
	});

	it("handles CRLF and ignores malformed lines", () => {
		const lines = parseEslrc(
			"[00:10.82]Ok[00:11.00]\r\nno timestamp\r\n[00:12.00]Broken no end\r\n[00:12.00]AlsoBroken[invalid]\r\n[00:13.00]Fine[00:13.50]",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("Ok");
		expect(lines[1].words.map((w) => w.word).join("")).toBe("Fine");
	});

	it("sorts parsed lines by first word timestamp", () => {
		const lines = parseEslrc(
			"[00:20.00]Second[00:21.00]\n[00:10.00]First[00:11.00]",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("First");
		expect(lines[1].words.map((w) => w.word).join("")).toBe("Second");
	});

	it("clamps parsed timestamps to max lrc time", () => {
		const lines = parseEslrc("[999:99.999]Max[1000:40.000]");

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(60039999);
		expect(lines[0].endTime).toBe(60039999);
		expect(lines[0].words[0].startTime).toBe(60039999);
		expect(lines[0].words[0].endTime).toBe(60039999);
	});

	it("ignores empty lines and lines with only whitespace", () => {
		const lines = parseEslrc(
			"[00:01.000]   \n[00:02.000]\n[00:10.82]Test[00:10.97] Word[00:12.62]\n   \n[00:12.62]Next[00:13.20] line[00:14.10]\n   \n",
		);
		expect(lines).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Test");
		expect(lines[1].words[0].word).toBe("Next");
	});

	it("stringifies to expected eslrc text", () => {
		const result = stringifyEslrc([
			{
				startTime: 0,
				endTime: 0,
				words: [
					{ startTime: 10820, endTime: 10970, word: "Test", romanWord: "" },
					{ startTime: 10970, endTime: 12620, word: " Word", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[00:10.820]Test[00:10.970] Word[00:12.620]");
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyEslrc([
			{
				startTime: 0,
				endTime: 0,
				words: [
					{
						startTime: Number.NaN,
						endTime: Number.POSITIVE_INFINITY,
						word: "Hello",
						romanWord: "",
					},
					{ startTime: -1, endTime: -2, word: "World", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[00:00.000]Hello[00:00.000]World[00:00.000]");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input =
			"[00:10.82]Test[00:10.97] Word[00:12.62]\n[00:12.62]Next[00:13.20] line[00:14.10]";
		const first = parseEslrc(input);
		const text = stringifyEslrc(first);
		const second = parseEslrc(text);

		expect(second).toEqual(first);
	});
});
