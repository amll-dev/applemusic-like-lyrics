import { describe, expect, it } from "vitest";
import { calcBalancedBreaks } from "../src/utils/lyric-line-break.ts";

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

function balance(text: string, width: number): number[] {
	return calcBalancedBreaks(
		[...text].map((char) => ({
			text: char,
			width: 1,
			isSpace: char.trim().length === 0,
		})),
		width,
		text,
		segmenter,
	);
}

function segments(text: string): string[] {
	return [...segmenter.segment(text)].map(({ segment }) => segment);
}

describe("calcBalancedBreaks", () => {
	it("提高单字词相邻边界的惩罚，避免细碎分词导致的不自然断行", () => {
		const text = "说了第一九四三句对不起之后";
		expect(segments(text)).toEqual([
			"说",
			"了",
			"第",
			"一九",
			"四",
			"三句",
			"对不起",
			"之后",
		]);
		expect(balance(text, 8)).toEqual([8]);
	});

	it("保留多字词之间接近中点的断行", () => {
		const text = "美丽世界温暖阳光幸福生活";
		expect(segments(text)).toEqual([
			"美丽",
			"世界",
			"温暖",
			"阳光",
			"幸福",
			"生活",
		]);
		expect(balance(text, 8)).toEqual([6]);
	});

	it("仍然避免在词组内部断行", () => {
		const text = "我们一起走过的那些日子永远不会忘记";
		expect(segments(text)).toEqual([
			"我们",
			"一起",
			"走过",
			"的",
			"那些",
			"日子",
			"永远",
			"不会",
			"忘记",
		]);
		expect(balance(text, 10)).toEqual([9]);
	});

	it("保留标点和空格处的断行优先级", () => {
		expect(balance("甲乙，丙丁戊", 4)).toEqual([3]);
		expect(balance("甲乙 丙丁戊", 4)).toEqual([3]);
	});

	it("空文本、无效宽度及无需换行时不插入断点", () => {
		expect(balance("", 8)).toEqual([]);
		expect(balance("美丽世界", 0)).toEqual([]);
		expect(balance("美丽世界", -1)).toEqual([]);
		expect(balance("美丽世界", 4)).toEqual([]);
	});
});
