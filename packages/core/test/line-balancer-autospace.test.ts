// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import styles from "#styles/lyric-player.module.css";
import { LineBalancer } from "#utils/line-balancer.ts";
import type { ChildNodeInfo } from "#utils/lyric-line-break.ts";

interface Adapter {
	resetDOM(): void;
	applyBreaks(breaks: number[], children: ChildNodeInfo[]): void;
}

function fixture(text: string) {
	const main = document.createElement("div");
	main.textContent = text;
	let adapter: Adapter | undefined;
	const balancer = new LineBalancer(main, styles) as unknown as {
		balanceNonDynamicLineBreaks(
			width: number,
			style: CSSStyleDeclaration,
			segmenter: Intl.Segmenter,
		): void;
		executeLineBalance(width: number, adapter: Adapter): void;
	};
	balancer.executeLineBalance = (_, value) => {
		adapter = value;
	};
	balancer.balanceNonDynamicLineBreaks(
		100,
		getComputedStyle(main),
		new Intl.Segmenter(undefined, { granularity: "word" }),
	);
	return { main, adapter };
}

describe("non-dynamic autospace line starts", () => {
	it("uses the line-start class without removing the boundary class", () => {
		const { main, adapter } = fixture("中A");
		const children = [
			{ text: "中", width: 50, isSpace: false },
			{ text: "A", width: 60, isSpace: false, leadingSpacing: 10 },
		];
		adapter?.applyBreaks([1], children);
		const lineStart = main.querySelector("br")?.nextSibling as HTMLElement;
		expect(lineStart.classList.contains(styles.textAutospaceBefore)).toBe(true);
		expect(lineStart.classList.contains(styles.textAutospaceLineStart)).toBe(
			true,
		);
		expect(main.textContent).toBe("中A");

		adapter?.resetDOM();
		expect(main.querySelector("br")).toBeNull();
		expect(main.querySelector(`.${styles.textAutospaceLineStart}`)).toBeNull();
		expect(main.querySelector(`.${styles.textAutospaceBefore}`)).not.toBeNull();

		adapter?.applyBreaks([], children);
		expect(main.querySelector(`.${styles.textAutospaceLineStart}`)).toBeNull();
		expect(main.querySelector(`.${styles.textAutospaceBefore}`)).not.toBeNull();
	});

	it("does not balance empty or whitespace-only lines", () => {
		expect(fixture("").adapter).toBeUndefined();
		expect(fixture("  ").adapter).toBeUndefined();
	});
});
