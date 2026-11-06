import styles from "#styles/lyric-player.module.css";
import { getTextAutospaceOffsets } from "./text-autospace.ts";

/** Render spacing without adding characters or timed lyric words. */
export function appendTextWithAutospace(
	parent: Node,
	text: string,
	leading = false,
	enabled = true,
): void {
	const offsets = enabled ? getTextAutospaceOffsets(text) : [];
	let start = 0;
	let spaced = leading;
	for (let i = 0; i <= offsets.length; i++) {
		const end = offsets[i] ?? text.length;
		if (end > start) {
			const part = text.slice(start, end);
			if (spaced) {
				const span = document.createElement("span");
				span.classList.add(styles.textAutospaceRun, styles.textAutospaceBefore);
				span.textContent = part;
				parent.appendChild(span);
			} else {
				parent.appendChild(document.createTextNode(part));
			}
		}
		start = end;
		spaced = true;
	}
}

/** The player initializes the inherited private length in em. */
export function getTextAutospaceWidth(style: CSSStyleDeclaration): number {
	const em = Number.parseFloat(
		style.getPropertyValue("--amll-lp-text-autospace"),
	);
	const fontSize = Number.parseFloat(style.fontSize) || 0;
	return Number.isFinite(em) ? em * fontSize : 0;
}
