import { describe, expect, it } from "vitest";
import { chunkAndSplitLyricWords } from "#utils/lyric-split-words.ts";

describe("chunkAndSplitLyricWords romanWord split", () => {
	it("splits word and romanWord by space when counts match", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "su gar so",
				romanWord: "su ga so",
				startTime: 0,
				endTime: 700,
			},
		]);

		expect(result).toEqual([
			{
				word: "su",
				romanWord: "su",
				startTime: 0,
				endTime: 200,
				obscene: false,
			},
			{
				word: " ",
				romanWord: "",
				startTime: 200,
				endTime: 200,
				obscene: false,
			},
			{
				word: "gar",
				romanWord: "ga",
				startTime: 200,
				endTime: 500,
				obscene: false,
			},
			{
				word: " ",
				romanWord: "",
				startTime: 500,
				endTime: 500,
				obscene: false,
			},
			{
				word: "so",
				romanWord: "so",
				startTime: 500,
				endTime: 700,
				obscene: false,
			},
		]);
	});

	it("assigns full romanWord to first syllable when counts mismatch", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "gar so",
				romanWord: "gabu",
				startTime: 0,
				endTime: 500,
			},
		]);

		expect(result).toEqual([
			{
				word: "gar",
				romanWord: "gabu",
				startTime: 0,
				endTime: 300,
				obscene: false,
			},
			{
				word: " ",
				romanWord: "",
				startTime: 300,
				endTime: 300,
				obscene: false,
			},
			{
				word: "so",
				romanWord: "",
				startTime: 300,
				endTime: 500,
				obscene: false,
			},
		]);
	});

	it("handles single word with single romanWord", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "gar",
				romanWord: "ga",
				startTime: 0,
				endTime: 100,
			},
		]);

		expect(result).toEqual([
			{
				word: "gar",
				romanWord: "ga",
				startTime: 0,
				endTime: 100,
				obscene: false,
			},
		]);
	});

	it("handles single word without space in word even if romanWord contains space", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "sugar",
				romanWord: "su ga",
				startTime: 0,
				endTime: 500,
			},
		]);

		expect(result).toEqual([
			{
				word: "sugar",
				romanWord: "su ga",
				startTime: 0,
				endTime: 500,
				obscene: false,
			},
		]);
	});

	it("groups adjacent no-space words into an array", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "su",
				romanWord: "su",
				startTime: 0,
				endTime: 200,
			},
			{
				word: "gar",
				romanWord: "ga",
				startTime: 200,
				endTime: 500,
			},
		]);

		expect(result).toEqual([
			[
				{
					word: "su",
					romanWord: "su",
					startTime: 0,
					endTime: 200,
					obscene: false,
				},
				{
					word: "gar",
					romanWord: "ga",
					startTime: 200,
					endTime: 500,
					obscene: false,
				},
			],
		]);
	});

	it("splits multi-character CJK words when romanWord is empty", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "你好",
				romanWord: "",
				startTime: 0,
				endTime: 200,
			},
		]);

		expect(result).toEqual([
			{
				word: "你",
				romanWord: "",
				startTime: 0,
				endTime: 100,
				obscene: false,
			},
			{
				word: "好",
				romanWord: "",
				startTime: 100,
				endTime: 200,
				obscene: false,
			},
		]);
	});

	it("handles ruby (phonetic notation) with leading/trailing spaces", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: " 汉字 ",
				ruby: [{ word: "hàn", startTime: 0, endTime: 100 }],
				startTime: 0,
				endTime: 200,
			},
		]);

		expect(result).toEqual([
			{
				word: " ",
				romanWord: "",
				startTime: 0,
				endTime: 0,
				obscene: false,
			},
			{
				word: "汉字",
				ruby: [{ word: "hàn", startTime: 0, endTime: 100 }],
				startTime: 0,
				endTime: 200,
				obscene: false,
			},
			{
				word: " ",
				romanWord: "",
				startTime: 200,
				endTime: 200,
				obscene: false,
			},
		]);
	});
});
