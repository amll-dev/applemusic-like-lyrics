import { describe, expect, it } from "bun:test";
import { stringifyAss } from "../src/formats/ass";

describe("ass", () => {
	it("stringifies basic timed words into dialogue with k tags", () => {
		const result = stringifyAss([
			{
				startTime: 0,
				endTime: 0,
				words: [
					{ startTime: 1000, endTime: 1200, word: "Hello", romanWord: "" },
					{ startTime: 0, endTime: 0, word: " ", romanWord: "" },
					{ startTime: 1300, endTime: 1500, word: "World", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe(
			"[Script Info]\n[Events]\nFormats: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00, 0:00:01.50, Default, v1,0,0,0,,{\\k20}Hello {\\k10}{\\k20}World\n",
		);
	});

	it("stringifies duet/bg speaker and trans/roman lines", () => {
		const result = stringifyAss([
			{
				startTime: 0,
				endTime: 0,
				words: [
					{ startTime: 1000, endTime: 1500, word: "Hello", romanWord: "" },
				],
				translatedLyric: "你好",
				romanLyric: "ni hao",
				isBG: true,
				isDuet: true,
			},
		]);

		expect(result).toContain(
			"Dialogue: 0,0:00:01.00, 0:00:01.50, Default, v2-bg,0,0,0,,{\\k50}Hello",
		);
		expect(result).toContain(
			"Dialogue: 0,0:00:01.00, 0:00:01.50, Default, v2-bg-trans,0,0,0,,你好",
		);
		expect(result).toContain(
			"Dialogue: 0,0:00:01.00, 0:00:01.50, Default, v2-bg-roman,0,0,0,,ni hao",
		);
	});

	it("skips lines without any valid timed words", () => {
		const result = stringifyAss([
			{
				startTime: 0,
				endTime: 0,
				words: [{ startTime: 0, endTime: 0, word: "NoTime", romanWord: "" }],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toBe(
			"[Script Info]\n[Events]\nFormats: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n",
		);
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyAss([
			{
				startTime: 0,
				endTime: 0,
				words: [
					{
						startTime: Number.NaN,
						endTime: Number.POSITIVE_INFINITY,
						word: "Bad",
						romanWord: "",
					},
					{ startTime: -1, endTime: 100, word: "Ok", romanWord: "" },
				],
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);

		expect(result).toContain(
			"Dialogue: 0,0:00:00.00, 0:00:00.10, Default, v1,0,0,0,,Bad{\\k10}Ok",
		);
	});
});
