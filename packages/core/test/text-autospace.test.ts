import { beforeAll, describe, expect, it, vi } from "vitest";
import * as nativeAutospace from "#utils/text-autospace.ts";

describe("text autospace", () => {
	const autospace = nativeAutospace;

	it.each([
		["。", "A", false],
		["「", "A", false],
		["\u2F00", "A", false],
		["\u32D0", "1", false],
		["中", "Ａ", false],
		["Ａ", "中", false],
		["한", "A", true],
		["A", "한", true],
		["〇", "1", true],
		["ｶﾞ", "A", true],
		["\u1100\u1161\u11A8", "A", true],
		["ー", "A", true],
	] as const)(
		"classifies base code points at the join of %s and %s",
		(previous, next, expected) => {
			expect(autospace.needsTextAutospace(previous, next)).toBe(expected);
			expect(autospace.getTextAutospaceOffsets(previous + next)).toEqual(
				expected ? [previous.length] : [],
			);
		},
	);

	it.each([
		["してtake2だよ", [2, 7]],
		["中文AMLL2026年", [2, 10]],
		["かなAMLL", [2]],
		["カナAMLL", [2]],
		["한글AMLL", [2]],
		["\u1112\u1161\u11ABAMLL\u1100\u1173\u11AF", [3, 7]],
		["A\u1112\u1161\u11AB2", [1, 4]],
		["ｶﾅAMLL", [2]],
		["ガAｶﾞB", [1, 2, 4]],
		["スーパーAMLL", [4]],
		["ｽｰﾊﾟｰAMLL", [5]],
		["A中2文", [1, 2, 3]],
	] as const)(
		"finds CJK/Latin and numeric boundaries in %s",
		(text, offsets) => {
			expect(autospace.getTextAutospaceOffsets(text)).toEqual(offsets);
		},
	);

	it.each(["~", "〜", "～"])(
		"adds gaps on either numeric side of %s only",
		(wave) => {
			expect(
				autospace.getTextAutospaceOffsets(`鳴らせ君の3${wave}6マス`),
			).toEqual([5, 6, 7, 8]);
			expect(autospace.getTextAutospaceOffsets(`3${wave}`)).toEqual([1]);
			expect(autospace.getTextAutospaceOffsets(`${wave}6`)).toEqual([1]);
			expect(autospace.getTextAutospaceOffsets(`A${wave}中`)).toEqual([]);
			expect(autospace.getTextAutospaceOffsets(`中${wave}B`)).toEqual([]);
			expect(autospace.getTextAutospaceOffsets(`３${wave}６`)).toEqual([]);
			expect(autospace.getTextAutospaceOffsets(`3${wave}A`)).toEqual([1]);
		},
	);

	it.each([
		"",
		"中",
		"中文かなカナ한글ｶﾅ",
		"take2",
		"AMLL2026",
		"abcéÅe\u0301",
		"123456",
		"中ＡＢＣ１２３文",
		"Ａ中１文",
		"中、A。文！2？",
		"中・A･文",
		"中αЖ١文",
		"中²𝟚文",
		"3-6",
		"3–6",
	])("does not add unrelated spacing in %s", (text) => {
		expect(autospace.getTextAutospaceOffsets(text)).toEqual([]);
	});

	it.each([
		" ",
		"\t",
		"\r\n",
		"\u00A0",
		"\u1680",
		"\u2002",
		"\u2009",
		"\u2028",
		"\u202F",
		"\u205F",
		"\u3000",
		"\uFEFF",
		"\u200B",
	])("preserves explicit whitespace/separators %j", (space) => {
		expect(autospace.getTextAutospaceOffsets(`中${space}A${space}文`)).toEqual(
			[],
		);
		expect(autospace.getTextAutospaceOffsets(`3${space}〜${space}6`)).toEqual(
			[],
		);
		expect(autospace.needsTextAutospace(`中文${space}`, "AMLL")).toBe(false);
		expect(autospace.needsTextAutospace("中文", `${space}AMLL`)).toBe(false);
	});

	it.each([
		["中e\u0301文", [1, 3]],
		["é中Å", [1, 2]],
		["𠀀A𠮷2", [2, 3, 5]],
		["葛\u{E0100}A文\uFE00B", [3, 4, 6]],
		["𠮷\u{E0100}e\u0301文", [4, 6]],
	] as const)("returns exact UTF-16 boundaries for %s", (text, offsets) => {
		expect(autospace.getTextAutospaceOffsets(text)).toEqual(offsets);
	});

	it("places gaps between intact source graphemes, not code units", () => {
		const text = "𠀀e\u0301文3〜6";
		const offsets = autospace.getTextAutospaceOffsets(text);
		expect(offsets).toEqual([2, 4, 5, 6, 7]);
		const edges = [0, ...offsets, text.length];
		expect(
			edges
				.slice(0, -1)
				.map((start, index) => text.slice(start, edges[index + 1])),
		).toEqual(["𠀀", "e\u0301", "文", "3", "〜", "6"]);
	});

	it.each([
		["中1️⃣文", []],
		["中1\u20E3文", []],
		["1️⃣〜6", [4]],
		["中👩🏽‍💻A文", [9]],
		["A👩‍👩‍👧‍👦中", []],
		["中🇨🇳A文", [6]],
		["中☕️文", []],
		["中🏴\u{E0067}\u{E0062}\u{E007F}文", []],
	] as const)("does not expose emoji internals in %s", (text, offsets) => {
		expect(autospace.getTextAutospaceOffsets(text)).toEqual(offsets);
	});

	it.each([
		["して", "take2", true],
		["take", "2", false],
		["take2", "だよ", true],
		["中文", "AMLL2026", true],
		["AMLL2026", "年", true],
		["\u1112\u1161\u11AB", "AMLL", true],
		["AMLL", "\u1100\u1173\u11AF", true],
		["中文e\u0301", "かな", true],
		["𠀀\u{E0100}", "école", true],
		["AMLL", "𠮷\u{E0100}", true],
		["A中", "文B", false],
		["中A", "B文", false],
		["音3", "〜6", true],
		["3～", "6音", true],
		["中Ａ", "文", false],
		["中", "１文", false],
		["中1️⃣", "文", false],
		["中", "👩‍💻A", false],
		["👩‍💻", "中A", false],
		["A", "\u0301中", false],
		["", "A", false],
		["中", "", false],
		["", "", false],
	] as const)(
		"checks only the graphemes at the join of %s and %s",
		(previous, next, expected) => {
			expect(autospace.needsTextAutospace(previous, next)).toBe(expected);
		},
	);
});

describe("code-point fallback", () => {
	let autospace = nativeAutospace;

	beforeAll(async () => {
		const intlWithoutSegmenter = Object.create(Intl);
		Object.defineProperty(intlWithoutSegmenter, "Segmenter", {
			value: undefined,
		});
		vi.stubGlobal("Intl", intlWithoutSegmenter);
		vi.resetModules();
		try {
			autospace = await import("#utils/text-autospace.ts");
		} finally {
			vi.unstubAllGlobals();
			vi.resetModules();
		}
	});

	it("keeps code points and their UTF-16 indices", () => {
		expect([...autospace.textGraphemes("𠀀e\u0301")]).toEqual([
			{ segment: "𠀀", index: 0 },
			{ segment: "e", index: 2 },
			{ segment: "\u0301", index: 3 },
		]);
		expect(autospace.getTextAutospaceOffsets("𠀀A文2")).toEqual([2, 3, 4]);
		expect(autospace.needsTextAutospace("𠀀", "A")).toBe(true);
		expect(autospace.needsTextAutospace("A", "𠀀")).toBe(true);
	});

	it("handles empty text and separators", () => {
		expect([...autospace.textGraphemes("")]).toEqual([]);
		expect(autospace.getTextAutospaceOffsets("")).toEqual([]);
		expect(autospace.getTextAutospaceOffsets("中 A")).toEqual([]);
		expect(autospace.needsTextAutospace("", "A")).toBe(false);
		expect(autospace.needsTextAutospace("中", "")).toBe(false);
		expect(autospace.needsTextAutospace("中 ", "A")).toBe(false);
	});
});
