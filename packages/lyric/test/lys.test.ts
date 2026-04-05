import { describe, expect, it } from "vitest";
import { parseLYS, stringifyLYS } from "../src/formats/lys";

describe("lys", () => {
	it("parses basic word-timestamped line", () => {
		const lines = parseLYS("[0]Hello(1000,500) World(1500,500)");

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].isBG).toBe(false);
		expect(lines[0].isDuet).toBe(false);
		expect(lines[0].words.map((w) => w.word)).toEqual(["Hello", " World"]);
	});

	it("parses bg + duet flags from prop and strips bg wrappers", () => {
		const lines = parseLYS("[8](Hello(1000,500)World(1500,500))");

		expect(lines).toHaveLength(1);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].isDuet).toBe(true);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("HelloWorld");
	});

	it("handles CRLF and ignores lines without valid prop prefix", () => {
		const lines = parseLYS(
			"no prop\r\n#comment\r\n{meta:true}\r\n[4]Hello(1000,500)World(1500,500)",
		);

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
	});

	it("ignores lines with bad word timestamps", () => {
		const lines = parseLYS(
			"[0]Hello(1000,500)\n[0]Bad(a,b)\n[0]AlsoBad(1000,-10)\n[0]World(2000,500)",
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("Hello");
		expect(lines[1].words.map((w) => w.word).join("")).toBe("World");
	});

	it("stringifies words and preserves spaces", () => {
		const result = stringifyLYS([
			{
				startTime: 1000,
				endTime: 2000,
				words: [
					{ startTime: 1000, endTime: 1500, word: "Hello", romanWord: "" },
					{ startTime: 0, endTime: 0, word: " ", romanWord: "" },
					{ startTime: 1500, endTime: 2000, word: "World", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[4]Hello (1000,500)World(1500,500)");
	});

	it("stringifies props according to duet/background presence", () => {
		const result = stringifyLYS([
			{
				startTime: 0,
				endTime: 0,
				words: [{ startTime: 1000, endTime: 1500, word: "A", romanWord: "" }],
				translatedLyric: "",
				romanLyric: "",
				isBG: true,
				isDuet: true,
			},
			{
				startTime: 0,
				endTime: 0,
				words: [{ startTime: 2000, endTime: 2500, word: "B", romanWord: "" }],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[8]A(1000,500)\n[4]B(2000,500)");
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyLYS([
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
					{
						startTime: -1,
						endTime: -2,
						word: "World",
						romanWord: "",
					},
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe("[4]Hello(0,0)World(0,0)");
	});

	it("keeps parse -> stringify -> parse stable for content and timing", () => {
		const input = "[4]Hello(1000,500) World(1500,500)\n[8](Again(3000,500))";
		const first = parseLYS(input);
		const text = stringifyLYS(first);
		const second = parseLYS(text);

		expect(second).toEqual(first);
	});
});
