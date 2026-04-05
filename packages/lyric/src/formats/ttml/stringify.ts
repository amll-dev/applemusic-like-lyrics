import type { LyricLine, LyricWord, TTMLLyric } from "../../types";
import { formatTime } from "../../utils";

type AcceptAttrs = Record<string, string | number | undefined>;
type AcceptContent = string | Element[];

function createXMLDocument(): XMLDocument {
	return new DOMParser().parseFromString("<root/>", "application/xml");
}

function h(
	doc: XMLDocument,
	tag: string,
	arg1?: AcceptAttrs | AcceptContent,
	arg2?: AcceptAttrs | AcceptContent,
): Element {
	const isAttrs = (
		value: AcceptAttrs | AcceptContent | undefined,
	): value is AcceptAttrs => typeof value === "object" && !Array.isArray(value);
	const isContent = (
		value: AcceptAttrs | AcceptContent | undefined,
	): value is AcceptContent =>
		typeof value === "string" || Array.isArray(value);

	const el = doc.createElement(tag);
	const content = isContent(arg1) ? arg1 : isContent(arg2) ? arg2 : undefined;
	const attrs = isAttrs(arg1) ? arg1 : isAttrs(arg2) ? arg2 : undefined;

	if (attrs) {
		Object.entries(attrs).forEach(([key, value]) => {
			if (value !== undefined) el.setAttribute(key, String(value));
		});
	}

	if (content) {
		if (typeof content === "string")
			el.appendChild(doc.createTextNode(content));
		else
			content.forEach((child) => {
				el.appendChild(child);
			});
	}

	return el;
}

const makeWordSpan = (doc: XMLDocument, word: LyricWord): Element =>
	h(doc, "span", word.word, {
		begin: formatTime(word.startTime),
		end: formatTime(word.endTime),
	});

const makeRomanizationSpan = (doc: XMLDocument, word: LyricWord): Element =>
	h(doc, "span", word.romanWord, {
		begin: formatTime(word.startTime),
		end: formatTime(word.endTime),
	});

const makeRootTT = (doc: XMLDocument, content: Element[]): Element =>
	h(doc, "tt", content, {
		xmlns: "http://www.w3.org/ns/ttml",
		"xmlns:ttm": "http://www.w3.org/ns/ttml#metadata",
		"xmlns:amll": "http://www.example.com/ns/amll",
		"xmlns:itunes": "http://music.apple.com/lyric-ttml-internal",
	});

const makeLineTransSpan = (doc: XMLDocument, text: string): Element =>
	h(doc, "span", text, {
		"ttm:role": "x-translation",
		"xml:lang": "zh-CN",
	});

const makeLineRomanSpan = (doc: XMLDocument, text: string): Element =>
	h(doc, "span", text, {
		"ttm:role": "x-roman",
	});

function makeMetadataEl(
	doc: XMLDocument,
	ttmlLyric: TTMLLyric,
	lines: LyricLine[],
	extraChildren?: Element[],
): Element {
	const hasDuet = lines.some((line) => line.isDuet);
	const agentChildren: Element[] = [
		h(doc, "ttm:agent", { type: "person", "xml:id": "v1" }),
	];
	if (hasDuet)
		agentChildren.push(h(doc, "ttm:agent", { type: "other", "xml:id": "v2" }));

	const metadataChildren: Element[] = [
		...agentChildren,
		...ttmlLyric.metadata.flatMap(([key, values]) =>
			values.map((value) => h(doc, "amll:meta", { key, value })),
		),
		...(extraChildren ?? []),
	];

	return h(doc, "metadata", metadataChildren);
}

function makeItunesRomanMetadataEls(
	doc: XMLDocument,
	romanizationMap: Map<string, { main: LyricWord[]; bg: LyricWord[] }>,
): Element[] {
	if (romanizationMap.size === 0) return [];

	const itunesMeta = h(doc, "iTunesMetadata", {
		xmlns: "http://music.apple.com/lyric-ttml-internal",
	});

	const transliterations = h(doc, "transliterations");
	const transliteration = h(doc, "transliteration");

	for (const [key, { main, bg }] of romanizationMap.entries()) {
		const textEl = h(doc, "text", { for: key });

		for (const word of main) {
			if (word.romanWord && word.romanWord.trim().length > 0)
				textEl.appendChild(makeRomanizationSpan(doc, word));
			else if (word.word.trim().length === 0 && textEl.hasChildNodes())
				textEl.appendChild(doc.createTextNode(word.word));
		}

		const hasBgRoman = bg.some(
			(word) => word.romanWord && word.romanWord.trim().length > 0,
		);
		if (hasBgRoman) {
			const bgSpan = h(doc, "span", { "ttm:role": "x-bg" });
			const romanBgWords = bg.filter(
				(word) => word.romanWord && word.romanWord.trim().length > 0,
			);

			for (const [wordIndex, word] of romanBgWords.entries()) {
				const span = makeRomanizationSpan(doc, word);
				if (wordIndex === 0 && span.firstChild)
					span.firstChild.nodeValue = `(${span.firstChild.nodeValue}`;
				if (wordIndex === romanBgWords.length - 1 && span.firstChild)
					span.firstChild.nodeValue = `${span.firstChild.nodeValue})`;
				bgSpan.appendChild(span);

				const originalIndex = bg.indexOf(word);
				if (originalIndex > -1 && originalIndex < bg.length - 1) {
					const nextWord = bg[originalIndex + 1];
					if (nextWord?.word.trim().length === 0)
						bgSpan.appendChild(doc.createTextNode(nextWord.word));
				}
			}
			textEl.appendChild(bgSpan);
		}

		transliteration.appendChild(textEl);
	}

	transliterations.appendChild(transliteration);
	itunesMeta.appendChild(transliterations);
	return [itunesMeta];
}

/**
 * 将歌词与元数据转换为 TTML 字符串。
 * @param ttmlLyric TTML 歌词对象
 * @returns TTML 文本
 */
export function stringifyTTML(ttmlLyric: TTMLLyric): string {
	const lines = ttmlLyric.lines;
	const doc = createXMLDocument();

	const docStartTime = lines[0]?.startTime ?? 0;
	const docEndTime = lines[lines.length - 1]?.endTime ?? 0;

	const romanizationMap = new Map<
		string,
		{ main: LyricWord[]; bg: LyricWord[] }
	>();

	const isWordLevelLyric = lines.some(
		(line) => line.words.filter((word) => word.word.trim()).length > 1,
	);

	interface LineGroup {
		main: LyricLine;
		background?: LyricLine;
	}

	const groupedLines: LineGroup[] = [];
	for (const line of lines) {
		if (!line.isBG) {
			groupedLines.push({ main: line });
			continue;
		}
		const lastGroup = groupedLines[groupedLines.length - 1];
		if (lastGroup) {
			if (lastGroup.background) groupedLines.push({ main: line });
			else lastGroup.background = line;
		} else groupedLines.push({ main: line });
	}

	const lineEls: Element[] = [];

	for (const [lineKey, lineGroup] of groupedLines.entries()) {
		const { main: line, background: bgLine } = lineGroup;
		const itunesKey = `L${lineKey}`;
		const lineP = h(doc, "p", {
			begin: formatTime(line.startTime),
			end: formatTime(line.endTime),
			"ttm:agent": line.isDuet ? "v2" : "v1",
			"itunes:key": itunesKey,
		});

		const mainWords = line.words;
		let bgWords: LyricWord[] = [];

		if (isWordLevelLyric) {
			for (const word of mainWords) {
				if (word.word.trim().length === 0)
					lineP.appendChild(doc.createTextNode(word.word));
				else lineP.appendChild(makeWordSpan(doc, word));
			}
		} else {
			const word = mainWords[0];
			if (word) {
				lineP.appendChild(doc.createTextNode(word.word));
				lineP.setAttribute("begin", formatTime(word.startTime));
				lineP.setAttribute("end", formatTime(word.endTime));
			}
		}

		if (bgLine) {
			bgWords = bgLine.words;
			const bgLineSpan = h(doc, "span", { "ttm:role": "x-bg" });

			if (isWordLevelLyric) {
				let beginTime = Number.POSITIVE_INFINITY;
				let endTime = 0;
				const firstWordIndex = bgLine.words.findIndex(
					(word) => word.word.trim().length > 0,
				);
				const lastWordIndex = bgLine.words
					.map((word) => word.word.trim().length > 0)
					.lastIndexOf(true);

				for (const [wordIndex, word] of bgLine.words.entries()) {
					if (word.word.trim().length === 0) {
						bgLineSpan.appendChild(doc.createTextNode(word.word));
						continue;
					}
					const span = makeWordSpan(doc, word);
					if (wordIndex === firstWordIndex && span.firstChild)
						span.firstChild.nodeValue = `(${span.firstChild.nodeValue}`;
					if (wordIndex === lastWordIndex && span.firstChild)
						span.firstChild.nodeValue = `${span.firstChild.nodeValue})`;
					bgLineSpan.appendChild(span);
					beginTime = Math.min(beginTime, word.startTime);
					endTime = Math.max(endTime, word.endTime);
				}

				bgLineSpan.setAttribute("begin", formatTime(beginTime));
				bgLineSpan.setAttribute("end", formatTime(endTime));
			} else {
				const word = bgLine.words[0];
				if (word) {
					bgLineSpan.appendChild(doc.createTextNode(`(${word.word})`));
					bgLineSpan.setAttribute("begin", formatTime(word.startTime));
					bgLineSpan.setAttribute("end", formatTime(word.endTime));
				}
			}

			if (bgLine.translatedLyric)
				bgLineSpan.appendChild(makeLineTransSpan(doc, bgLine.translatedLyric));
			if (bgLine.romanLyric)
				bgLineSpan.appendChild(makeLineRomanSpan(doc, bgLine.romanLyric));

			lineP.appendChild(bgLineSpan);
		}

		if (line.translatedLyric)
			lineP.appendChild(makeLineTransSpan(doc, line.translatedLyric));
		if (line.romanLyric)
			lineP.appendChild(makeLineRomanSpan(doc, line.romanLyric));

		if (
			mainWords.some(
				(word) => word.romanWord && word.romanWord.trim().length > 0,
			) ||
			bgWords.some((word) => word.romanWord && word.romanWord.trim().length > 0)
		) {
			romanizationMap.set(itunesKey, { main: mainWords, bg: bgWords });
		}

		lineEls.push(lineP);
	}

	const rootTT = makeRootTT(doc, [
		h(doc, "head", [
			makeMetadataEl(
				doc,
				ttmlLyric,
				lines,
				makeItunesRomanMetadataEls(doc, romanizationMap),
			),
		]),
		h(doc, "body", { dur: formatTime(docEndTime) }, [
			h(
				doc,
				"div",
				{ begin: formatTime(docStartTime), end: formatTime(docEndTime) },
				lineEls,
			),
		]),
	]);

	const previousRoot = doc.documentElement;
	doc.replaceChild(rootTT, previousRoot);
	return new XMLSerializer().serializeToString(doc);
}
