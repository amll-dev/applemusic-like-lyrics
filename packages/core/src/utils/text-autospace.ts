import { graphemeSegmenter } from "./segmenter.ts";

/** Render-only gap size, relative to the surrounding font size. */
export const TEXT_AUTOSPACE_EM = 0.125;

const CJK_RE =
	/^(?=[\p{Letter}\p{Number}])(?:\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}+|\u30FC|\uFF70)[\p{Mark}\uFF9E\uFF9F]*$/u;
const LATIN_RE =
	/^(?![\uFF21-\uFF3A\uFF41-\uFF5A])(?=\p{Letter})\p{Script=Latin}\p{Mark}*$/u;
const NUMBER_RE = /^[0-9]\p{Mark}*$/u;
const WAVE_RE = /^[~〜～]$/u;
const EMOJI_RE =
	/[\u200D\u20E3]|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}/u;

type GraphemeKind = "cjk" | "latin" | "number" | "wave" | "other";

function classifyGrapheme(grapheme: string): GraphemeKind {
	// A keycap's ASCII digit and an emoji's joiner must never act as boundaries.
	if (EMOJI_RE.test(grapheme)) return "other";
	if (CJK_RE.test(grapheme)) return "cjk";
	if (LATIN_RE.test(grapheme)) return "latin";
	if (NUMBER_RE.test(grapheme)) return "number";
	if (WAVE_RE.test(grapheme)) return "wave";
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
	if (graphemeSegmenter) {
		return (
			graphemeSegmenter.segment(text).containing(last ? text.length - 1 : 0)
				?.segment ?? ""
		);
	}

	const points = Array.from(text);
	return points[last ? points.length - 1 : 0] ?? "";
}

/** Check only the last/first grapheme at the join between two source strings. */
export function needsTextAutospace(previous: string, next: string): boolean {
	if (!previous || !next) return false;
	return needsGap(
		classifyGrapheme(boundaryGrapheme(previous, true)),
		classifyGrapheme(boundaryGrapheme(next, false)),
	);
}
