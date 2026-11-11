import { graphemeSegmenter } from "./segmenter.ts";

const AUTOSPACE_IDEOGRAPH_RE =
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30FC\uFF70]/u;
const ALNUM_RE = /[\p{Letter}\p{Number}]/u;
const LETTER_RE = /\p{Letter}/u;
const LATIN_LETTER_RE = /\p{Script=Latin}/u;
const FULLWIDTH_LATIN_RE = /[\uFF21-\uFF3A\uFF41-\uFF5A]/u;
const EMOJI_RE =
	/[\u200D\u20E3]|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}/u;

type GraphemeKind = "cjk" | "latin" | "number" | "wave" | "other";

// Unlike isCJK (word splitting/emphasis), autospace excludes punctuation, radicals and symbols.
function isAutospaceIdeograph(base: string): boolean {
	return ALNUM_RE.test(base) && AUTOSPACE_IDEOGRAPH_RE.test(base);
}

function classifyGrapheme(grapheme: string): GraphemeKind {
	// A keycap's ASCII digit and an emoji's joiner must never act as boundaries.
	if (EMOJI_RE.test(grapheme)) return "other";
	const base = String.fromCodePoint(grapheme.codePointAt(0) ?? 0);
	if (isAutospaceIdeograph(base)) return "cjk";
	if (
		LETTER_RE.test(base) &&
		LATIN_LETTER_RE.test(base) &&
		!FULLWIDTH_LATIN_RE.test(base)
	)
		return "latin";
	if (base >= "0" && base <= "9") return "number";
	if (base === "~" || base === "〜" || base === "～") return "wave";
	return "other";
}

function needsGap(previous: GraphemeKind, next: GraphemeKind): boolean {
	return (
		(previous === "cjk" && (next === "latin" || next === "number")) ||
		(next === "cjk" && (previous === "latin" || previous === "number")) ||
		(previous === "number" && next === "wave") ||
		(previous === "wave" && next === "number")
	);
}

/** Shared traversal for spacing and word rendering. */
export function textGraphemes(
	text: string,
): Iterable<{ segment: string; index: number }> {
	if (graphemeSegmenter) return graphemeSegmenter.segment(text);
	let index = 0;
	return Array.from(text, (segment) => {
		const point = { segment, index };
		index += segment.length;
		return point;
	});
}

/**
 * UTF-16 offsets before graphemes that need a render-only gap. Source text is
 * never rewritten; whitespace and unclassified punctuation block adjacency.
 */
export function getTextAutospaceOffsets(text: string): number[] {
	const offsets: number[] = [];
	let previous: GraphemeKind = "other";
	for (const { segment, index } of textGraphemes(text)) {
		const next = classifyGrapheme(segment);
		if (needsGap(previous, next)) offsets.push(index);
		previous = next;
	}

	return offsets;
}

function boundaryGrapheme(text: string, last: boolean): string {
	let boundary = "";
	for (const { segment } of textGraphemes(text)) {
		boundary = segment;
		if (!last) break;
	}
	return boundary;
}

/** Check only the last/first grapheme at the join between two source strings. */
export function needsTextAutospace(previous: string, next: string): boolean {
	if (!previous || !next) return false;
	return needsGap(
		classifyGrapheme(boundaryGrapheme(previous, true)),
		classifyGrapheme(boundaryGrapheme(next, false)),
	);
}
