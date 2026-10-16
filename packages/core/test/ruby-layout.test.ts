import { describe, expect, it } from "vitest";
import type { LyricWord } from "#interfaces";
import { resolveRubyHangMap } from "#lyric/dom/ruby-layout.ts";

/**
 * 构造歌词单词
 * @param text - 单词文本
 * @param ruby - 注音内容，缺省表示无注音
 */
const word = (text: string, ruby?: string): LyricWord => ({
	word: text,
	startTime: 0,
	endTime: 100,
	...(ruby === undefined
		? {}
		: { ruby: [{ word: ruby, startTime: 0, endTime: 100 }] }),
});

/**
 * 取指定单词的悬挂判定结果
 * @param words - 按渲染顺序排列的单词
 * @param target - 需要查询的单词
 */
const hangOf = (words: LyricWord[], target: LyricWord): boolean | undefined =>
	resolveRubyHangMap(words).get(target);

describe("注音悬挂判定", () => {
	it("两侧均为假名时允许悬挂", () => {
		const wo = word("を");
		const shi = word("司", "つかさど");
		const ru = word("る");
		expect(hangOf([wo, shi, ru], shi)).toBe(true);
	});

	it("相邻为汉字时不允许悬挂", () => {
		const mon = word("物", "もの");
		const go = word("語", "がたり");
		expect(hangOf([mon, go], mon)).toBe(false);
		expect(hangOf([mon, go], go)).toBe(false);
	});

	it("位于行首或行尾时不允许悬挂", () => {
		const first = word("始", "はじめ");
		const kana = word("を");
		const last = word("終", "おわり");
		expect(hangOf([first, kana, last], first)).toBe(false);
		expect(hangOf([first, kana, last], last)).toBe(false);
	});

	it("相邻注音自身不溢出到本词上方时仍允许悬挂", () => {
		const wo = word("を", "を");
		const shi = word("司", "つかさど");
		const ru = word("る", "る");
		expect(hangOf([wo, shi, ru], shi)).toBe(true);
	});

	it("相邻注音自身也会溢出时不允许悬挂", () => {
		const target = word("司", "つかさど");
		const wide = word("わ", "はなれ");
		expect(hangOf([word("を"), target, wide], target)).toBe(false);
	});

	it("注音跨越相邻假名仍会压到汉字时不允许悬挂", () => {
		const target = word("司", "たかまがはら");
		expect(hangOf([word("を"), target, word("神")], target)).toBe(false);
	});

	it("两侧假名足以容纳溢出时允许悬挂", () => {
		const target = word("司", "たかまがはら");
		const words = [word("を"), word("を"), target, word("る"), word("る")];
		expect(hangOf(words, target)).toBe(true);
	});

	it("相邻为空白时允许悬挂", () => {
		const left = word("を");
		const target = word("司", "つかさど");
		expect(hangOf([left, target, word(" ")], target)).toBe(true);
	});

	it("相邻为长音符与小假名时允许悬挂", () => {
		const small = word("っ");
		const choonpu = word("ー");
		const target = word("司", "つかさど");
		expect(hangOf([small, target, choonpu], target)).toBe(true);
	});

	it("相邻为拉丁字母或数字时不允许悬挂", () => {
		const latin = word("Love");
		const digit = word("1");
		const target = word("司", "つかさど");
		expect(hangOf([latin, target, digit], target)).toBe(false);
	});

	it("无注音单词不参与判定", () => {
		const kana = word("を");
		const target = word("司", "つかさど");
		const flags = resolveRubyHangMap([kana, target, word("る")]);
		expect(flags.has(kana)).toBe(false);
		expect(flags.size).toBe(1);
	});

	it("合并成组的单词同样参与相邻判定", () => {
		const target = word("司", "つかさど");
		const group = [word("る"), word("そ")];
		const flags = resolveRubyHangMap([word("を"), target, group]);
		expect(flags.get(target)).toBe(true);
	});

	it("组内首字为空白时仍视为可悬挂邻居", () => {
		const target = word("司", "つかさど");
		const group = [word(" る"), word("そ")];
		const flags = resolveRubyHangMap([word("を"), target, group]);
		expect(flags.get(target)).toBe(true);
	});
});
