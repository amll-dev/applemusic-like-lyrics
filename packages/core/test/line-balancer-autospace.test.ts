// @vitest-environment happy-dom

import { expect, it, vi } from "vitest";
import styles from "#styles/lyric-player.module.css";
import { LineBalancer } from "#utils/line-balancer.ts";
import type { ChildNodeInfo } from "#utils/lyric-line-break.ts";

interface Adapter {
	resetDOM(): void;
	buildChildInfos(): unknown;
	applyBreaks(breaks: number[], children: ChildNodeInfo[]): void;
}

function fixture(enabled: boolean, dynamic = false) {
	const main = document.createElement("div");
	main.textContent = "中A";
	if (dynamic)
		main.innerHTML = `<span>中</span><span class="${styles.textAutospaceBefore}">A</span>`;
	const balancer = new LineBalancer(main, () => enabled) as unknown as {
		balanceDynamicLineBreaks(width: number, segmenter: Intl.Segmenter): void;
		balanceNonDynamicLineBreaks(
			width: number,
			style: CSSStyleDeclaration,
			segmenter: Intl.Segmenter,
		): void;
		executeLineBalance(width: number, adapter: Adapter): void;
	};
	const execute = vi
		.spyOn(balancer, "executeLineBalance")
		.mockImplementation(() => {});
	if (dynamic) balancer.balanceDynamicLineBreaks(100, new Intl.Segmenter());
	else
		balancer.balanceNonDynamicLineBreaks(
			100,
			getComputedStyle(main),
			new Intl.Segmenter(),
		);
	const adapter = execute.mock.calls[0][1];
	if (dynamic) adapter.buildChildInfos();
	const children = [
		{ text: "中", width: 50, isSpace: false },
		{ text: "A", width: 60, isSpace: false, leadingSpacing: enabled ? 10 : 0 },
	];
	return { main, adapter, children };
}

it("keeps disabled text plain before and after balancing", () => {
	const { main, adapter, children } = fixture(false);
	adapter.resetDOM();
	expect(main.childNodes).toHaveLength(1);
	expect(main.firstChild?.nodeType).toBe(Node.TEXT_NODE);
	adapter.applyBreaks([1], children);
	expect(main.innerHTML).toBe("中<br>A");
	expect(Array.from(main.childNodes, (node) => node.nodeType)).toEqual([
		3, 1, 3,
	]);
});

it("marks the line start without removing its boundary class", () => {
	const { main, adapter, children } = fixture(true, true);
	adapter.applyBreaks([1], children);
	const start = main.querySelector("br")?.nextSibling as HTMLElement;
	expect(start.classList.contains(styles.textAutospaceBefore)).toBe(true);
	expect(start.classList.contains(styles.textAutospaceLineStart)).toBe(true);
	adapter.resetDOM();
	expect(start.classList.contains(styles.textAutospaceLineStart)).toBe(false);
	expect(start.classList.contains(styles.textAutospaceBefore)).toBe(true);
});

it("omits a non-dynamic leading gap at a break", () => {
	const { main, adapter, children } = fixture(true);
	adapter.applyBreaks([], children);
	expect(main.querySelector(`.${styles.textAutospaceBefore}`)).not.toBeNull();
	adapter.applyBreaks([1], children);
	expect(main.innerHTML).toBe("中<br>A");
});
