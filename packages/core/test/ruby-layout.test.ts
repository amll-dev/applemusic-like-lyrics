// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	applyRubyCollisionSpacing,
	findRubyCollisions,
	type RubySpacedWord,
} from "#lyric/dom/ruby-layout.ts";
import styles from "#styles/lyric-player.module.css";

const band = (left: number, right: number, top = 0, bottom = 10) => ({
	left,
	right,
	top,
	bottom,
	width: right - left,
	height: bottom - top,
});

describe("注音占位碰撞判定", () => {
	it("同行交叠的假名占位判为碰撞", () => {
		expect(findRubyCollisions([band(0, 40), band(30, 90)])).toEqual(
			new Set([0, 1]),
		);
	});

	it("交叠量不足最小间距时不算碰撞", () => {
		expect(findRubyCollisions([band(0, 40), band(39.6, 90)])).toEqual(
			new Set(),
		);
	});

	it("不同行的占位不算碰撞", () => {
		expect(
			findRubyCollisions([band(0, 40, 0, 10), band(10, 50, 20, 30)]),
		).toEqual(new Set());
	});

	it("链式交叠的占位全部判为碰撞", () => {
		expect(
			findRubyCollisions([band(0, 40), band(30, 70), band(60, 120)]),
		).toEqual(new Set([0, 1, 2]));
	});

	it("宽占位只与相邻的交叠者互判", () => {
		expect(
			findRubyCollisions([band(0, 40), band(30, 200), band(210, 260)]),
		).toEqual(new Set([0, 1]));
	});
});

/**
 * 构造带假名占位的单词
 * @param bands - 词内每段假名的左右边界，缺省表示该词无注音
 */
const createWord = (bands?: [number, number][]): RubySpacedWord => {
	const mainElement = document.createElement("span");
	if (!bands) return { mainElement };
	const rubyElement = document.createElement("span");
	for (const [left, right] of bands) {
		const part = document.createElement("span");
		part.getBoundingClientRect = () => band(left, right) as DOMRect;
		rubyElement.append(part);
	}
	mainElement.append(rubyElement);
	return { mainElement, rubyElement };
};

const spacingOf = (words: RubySpacedWord[]) =>
	words.map((word) =>
		word.mainElement.classList.contains(styles.rubySpaced)
			? "spaced"
			: "compact",
	);

describe("注音碰撞撑开", () => {
	it("相撞的单词挂上撑开标记", () => {
		const words = [createWord([[0, 40]]), createWord([[30, 90]])];
		applyRubyCollisionSpacing(words);
		expect(spacingOf(words)).toEqual(["spaced", "spaced"]);
	});

	it("保留间距的单词保持紧凑", () => {
		const words = [createWord([[0, 40]]), createWord([[60, 110]])];
		applyRubyCollisionSpacing(words);
		expect(spacingOf(words)).toEqual(["compact", "compact"]);
	});

	it("清除上一次判定留下的撑开标记", () => {
		const words = [createWord([[0, 40]]), createWord([[60, 110]])];
		words[0].mainElement.classList.add(styles.rubySpaced);
		applyRubyCollisionSpacing(words);
		expect(spacingOf(words)).toEqual(["compact", "compact"]);
	});

	it("无注音的单词不参与撑开", () => {
		const words = [
			createWord(),
			createWord([[-5, 95]]),
			createWord([[30, 60]]),
		];
		applyRubyCollisionSpacing(words);
		expect(words[0].mainElement.className).toBe("");
		expect(spacingOf(words.slice(1))).toEqual(["spaced", "spaced"]);
	});
});
