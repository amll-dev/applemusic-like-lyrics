export const graphemeSegmenter: Intl.Segmenter | null =
	typeof Intl !== "undefined" && Intl.Segmenter
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: null;

export const wordSegmenter: Intl.Segmenter | null =
	typeof Intl !== "undefined" && Intl.Segmenter
		? new Intl.Segmenter(undefined, { granularity: "word" })
		: null;
