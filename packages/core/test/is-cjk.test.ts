import { describe, expect, it } from "vitest";
import { isCJK } from "#utils/is-cjk.ts";

describe("isCJK", () => {
	it.each([
		"你",
		"好",
		"漢",
		"あ",
		"ア",
		"ー",
		"々",
		"〇",
		"。",
		"，",
		"！",
		"【",
		"𠀀",
		"𠀁",
		"ﾀ",
	])("treats %s as CJK", (char) => {
		expect(isCJK(char)).toBe(true);
	});

	it("treats a kana combining mark as CJK when attached to its base", () => {
		expect(isCJK(`か${String.fromCharCode(0x3099)}`)).toBe(true);
	});

	it.each([
		"ज",
		"ै",
		"जैसे",
		"बंदूक",
		"की",
		"गोली",
		"ก",
		"ภาษาไทย",
		"བོད",
		"က",
		"a",
		"A",
		"1",
		",",
	])("does not treat %s as CJK", (char) => {
		expect(isCJK(char)).toBe(false);
	});

	it("requires the whole string to be CJK", () => {
		expect(isCJK("你好，世界")).toBe(true);
		expect(isCJK("こんにちは")).toBe(true);
		expect(isCJK("カタカナ")).toBe(true);
		expect(isCJK("ﾃｽﾄ")).toBe(true);
		expect(isCJK("जैसे,")).toBe(false);
		expect(isCJK("hello")).toBe(false);
		expect(isCJK("你好world")).toBe(false);
		expect(isCJK("")).toBe(false);
	});
});
