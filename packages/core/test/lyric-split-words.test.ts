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

	it("does not split Devanagari words with combining marks", () => {
		const words = [
			{ word: "जैसे, ", startTime: 0, endTime: 500 },
			{ word: "जैसे, ", startTime: 500, endTime: 1000 },
			{ word: "बंदूक ", startTime: 1000, endTime: 1500 },
			{ word: "की ", startTime: 1500, endTime: 2000 },
			{ word: "गोली", startTime: 2000, endTime: 2500 },
		];

		const result = chunkAndSplitLyricWords(words);
		const atoms = result.flatMap((chunk) =>
			Array.isArray(chunk) ? chunk : [chunk],
		);

		expect(atoms.map((atom) => atom.word).join("")).toBe(
			words.map((word) => word.word).join(""),
		);
		expect(atoms.some((atom) => atom.word === "बंदूक")).toBe(true);
		expect(atoms.some((atom) => atom.word === "की")).toBe(true);
		expect(atoms.some((atom) => atom.word === "गोली")).toBe(true);
		expect(atoms.every((atom) => !/^\p{M}/u.test(atom.word))).toBe(true);
	});

	it("splits CJK words by grapheme clusters instead of UTF-16 code units", () => {
		const result = chunkAndSplitLyricWords([
			{
				word: "𠀀𠀁",
				romanWord: "",
				startTime: 0,
				endTime: 400,
			},
		]);

		expect(result).toEqual([
			{
				word: "𠀀",
				romanWord: "",
				startTime: 0,
				endTime: 200,
				obscene: false,
			},
			{
				word: "𠀁",
				romanWord: "",
				startTime: 200,
				endTime: 400,
				obscene: false,
			},
		]);
	});

	it("keeps a kana combining mark attached to its base character", () => {
		const combiningDakuten = String.fromCharCode(0x3099);
		const result = chunkAndSplitLyricWords([
			{
				word: `か${combiningDakuten}き`,
				romanWord: "",
				startTime: 0,
				endTime: 300,
			},
		]);

		expect(result).toEqual([
			{
				word: `か${combiningDakuten}`,
				romanWord: "",
				startTime: 0,
				endTime: 200,
				obscene: false,
			},
			{
				word: "き",
				romanWord: "",
				startTime: 200,
				endTime: 300,
				obscene: false,
			},
		]);
	});
});
