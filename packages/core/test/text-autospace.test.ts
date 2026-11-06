import { expect, it } from "vitest";
import {
	getTextAutospaceOffsets,
	needsTextAutospace,
} from "#utils/text-autospace.ts";

it.each([
	["中文AMLL2026年", [2, 10]],
	["A中2文", [1, 2, 3]],
	["かなAカナ2", [2, 3, 5]],
	["ｶﾞA", [2]],
	["", []],
	["中 A\t文\n2", []],
	["中\u00A0A\u3000文", []],
	["中、A。文！2？", []],
	["中ＡＢＣ１２３文", []],
	["한글AMLL123", []],
	["中αЖ١文", []],
	["中e\u0301文", [1, 3]],
	["𠀀A𠮷2", [2, 3, 5]],
	["葛\u{E0100}A文\uFE00B", [3, 4, 6]],
	["中1️⃣文", []],
	["中1\u20E3文", []],
	["中👩🏽‍💻A文", [9]],
	["A👩‍👩‍👧‍👦中", []],
	["中🇨🇳A文", [6]],
] as const)("finds intact grapheme boundaries in %s", (text, offsets) => {
	expect(getTextAutospaceOffsets(text)).toEqual(offsets);
});

it.each(["~", "〜", "～"])("spaces digits on either side of %s", (wave) => {
	expect(getTextAutospaceOffsets(`中3${wave}6文`)).toEqual([1, 2, 3, 4]);
	expect(getTextAutospaceOffsets(`A${wave}中${wave}３${wave}６`)).toEqual([]);
});

it.each([
	["中文", "AMLL", true],
	["AMLL", "年", true],
	["文", "2", true],
	["2", "文", true],
	["音3", "〜6", true],
	["3～", "6音", true],
	["中文e\u0301", "かな", true],
	["𠀀\u{E0100}", "école", true],
	["中 ", "A", false],
	["中", " A", false],
	["中。", "A", false],
	["中Ａ", "文", false],
	["中1️⃣", "文", false],
	["中", "👩‍💻A", false],
	["中A", "B文", false],
	["", "A", false],
	["中", "", false],
] as const)("checks the join of %s and %s", (previous, next, expected) => {
	expect(needsTextAutospace(previous, next)).toBe(expected);
});
