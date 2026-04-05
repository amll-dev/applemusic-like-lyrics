import type { LyricLine, TTMLLyric } from "../../types";
import { createLine, createWord } from "../../utils";

interface RomanWord {
	startTime: number;
	endTime: number;
	text: string;
}

interface LineMetadata {
	main: string;
	bg: string;
}

interface WordRomanMetadata {
	main: RomanWord[];
	bg: RomanWord[];
}

const trimBraces = (text: string): string =>
	text
		.trim()
		.replace(/^[（(]/, "")
		.replace(/[)）]$/, "")
		.trim();

const timeRegex =
	/^(((?<hour>[0-9]+):)?(?<min>[0-9]+):)?((?<sec>[0-9]+)([.:](?<frac>[0-9]{1,3}))?)$/;

function parseTimeNullable(time: string): number | null {
	const matches = timeRegex.exec(time);
	if (!matches) return null;
	const hour = Number(matches.groups?.hour || "0");
	const min = Number(matches.groups?.min || "0");
	const sec = Number(matches.groups?.sec || "0");
	const frac = Number((matches.groups?.frac || "0").padEnd(3, "0"));
	if ([hour, min, sec, frac].some((v) => Number.isNaN(v))) return null;
	return (hour * 3600 + min * 60 + sec) * 1000 + frac;
}

function parseTime(time: string | null | undefined): number {
	if (!time) return 0;
	const parsed = parseTimeNullable(time);
	if (parsed === null) throw new TypeError(`Invalid time string: ${time}`);
	return parsed;
}

const hasTimestamps = (el: Element): boolean =>
	el.hasAttribute("begin") && el.hasAttribute("end");

const isWordTimed = (
	wordText: string,
	startTime: number,
	endTime: number,
): boolean => Boolean((startTime || endTime) && wordText.trim());

function alignLineTime(line: LyricLine): void {
	for (const word of line.words) {
		if (isWordTimed(word.word, word.startTime, word.endTime)) {
			line.startTime = word.startTime;
			break;
		}
	}
	for (let i = line.words.length - 1; i >= 0; i--) {
		const word = line.words[i];
		if (isWordTimed(word.word, word.startTime, word.endTime)) {
			line.endTime = word.endTime;
			break;
		}
	}
}

class StringAccum {
	private parts: string[] = [];

	append(text: string | null | undefined) {
		if (typeof text !== "string" || text.length === 0) return;
		this.parts.push(text);
	}

	toString() {
		return this.parts.join("");
	}
}

function parseItunesTranslations(
	ttmlDoc: XMLDocument,
): Map<string, LineMetadata> {
	const itunesTranslations = new Map<string, LineMetadata>();
	const translationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	translationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		const mainStrs = new StringAccum();
		const bgStrs = new StringAccum();

		textEl.childNodes.forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) mainStrs.append(node.textContent);
			else if (node.nodeType === Node.ELEMENT_NODE) {
				if ((node as Element).getAttribute("ttm:role") === "x-bg")
					bgStrs.append(node.textContent);
			}
		});

		const main = mainStrs.toString().trim();
		const bg = trimBraces(bgStrs.toString());

		if (main || bg) itunesTranslations.set(key, { main, bg });
	});

	return itunesTranslations;
}

function parseItunesRomanizations(ttmlDoc: XMLDocument): {
	itunesLineRomanizations: Map<string, LineMetadata>;
	itunesWordRomanizations: Map<string, WordRomanMetadata>;
} {
	const itunesLineRomanizations = new Map<string, LineMetadata>();
	const itunesWordRomanizations = new Map<string, WordRomanMetadata>();

	const romanizationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > transliterations > transliteration > text[for]",
	);

	const spanToRomanWord = (
		span: Element,
		trimTextBraces = false,
	): RomanWord => ({
		startTime: parseTime(span.getAttribute("begin")),
		endTime: parseTime(span.getAttribute("end")),
		text: trimTextBraces
			? trimBraces(span.textContent ?? "")
			: (span.textContent ?? "").trim(),
	});

	romanizationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		const mainWords: RomanWord[] = [];
		const bgWords: RomanWord[] = [];
		const lineRomanMainStrs = new StringAccum();
		const lineRomanBgStrs = new StringAccum();
		let isWordByWord = false;

		textEl.childNodes.forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				lineRomanMainStrs.append(node.textContent);
				return;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return;
			const el = node as Element;
			if (el.getAttribute("ttm:role") === "x-bg") {
				const nestedSpans = el.querySelectorAll("span[begin][end]");
				if (nestedSpans.length === 0) lineRomanBgStrs.append(el.textContent);
				else {
					isWordByWord = true;
					bgWords.push(
						...[...nestedSpans].map((span) => spanToRomanWord(span, true)),
					);
				}
			} else if (hasTimestamps(el)) {
				isWordByWord = true;
				mainWords.push(spanToRomanWord(el));
			}
		});

		if (isWordByWord) {
			itunesWordRomanizations.set(key, { main: mainWords, bg: bgWords });
		}

		const lineRomanMain = lineRomanMainStrs.toString().trim();
		const lineRomanBg = trimBraces(lineRomanBgStrs.toString());

		if (lineRomanMain || lineRomanBg) {
			itunesLineRomanizations.set(key, {
				main: lineRomanMain,
				bg: lineRomanBg,
			});
		}
	});

	return { itunesLineRomanizations, itunesWordRomanizations };
}

function parseMetadata(ttmlDoc: XMLDocument): [string, string[]][] {
	const metadataMap = new Map<string, string[]>();
	ttmlDoc.querySelectorAll("meta").forEach((meta) => {
		if (meta.tagName !== "amll:meta") return;
		const key = meta.getAttribute("key");
		const value = meta.getAttribute("value");
		if (!key || !value) return;
		if (metadataMap.has(key)) metadataMap.get(key)?.push(value);
		else metadataMap.set(key, [value]);
	});
	return [...metadataMap.entries()];
}

function findMainAgentId(ttmlDoc: XMLDocument): string {
	for (const agent of ttmlDoc.querySelectorAll("ttm\\:agent")) {
		if (agent.getAttribute("type") !== "person") continue;
		const id = agent.getAttribute("xml:id");
		if (id) return id;
	}
	return "v1";
}

/**
 * 解析 TTML 格式歌词。
 * @param ttmlText TTML 文本
 * @returns 含 metadata 的 TTML 歌词对象
 */
export function parseTTML(ttmlText: string): TTMLLyric {
	const domParser = new DOMParser();
	const ttmlDoc = domParser.parseFromString(ttmlText, "application/xml");

	const itunesTranslations = parseItunesTranslations(ttmlDoc);
	const { itunesLineRomanizations, itunesWordRomanizations } =
		parseItunesRomanizations(ttmlDoc);
	const metadata = parseMetadata(ttmlDoc);
	const mainAgentId = findMainAgentId(ttmlDoc);

	const lines: LyricLine[] = [];

	ttmlDoc.querySelectorAll("body p[begin][end]").forEach((lineEl) => {
		parseLineElement(lineEl, false, false, null);
	});

	function parseLineElement(
		lineEl: Element,
		isBG = false,
		isDuet = false,
		parentItunesKey: string | null = null,
	): void {
		if (!isBG) {
			const agentAttr = lineEl.getAttribute("ttm:agent");
			isDuet = agentAttr !== null && agentAttr !== mainAgentId;
		}

		const startTime = parseTime(lineEl.getAttribute("begin"));
		const endTime = parseTime(lineEl.getAttribute("end"));
		const line = createLine({ isBG, isDuet, startTime, endTime });
		lines.push(line);

		const itunesKey = isBG
			? parentItunesKey
			: lineEl.getAttribute("itunes:key");
		const romanWordData = itunesKey
			? itunesWordRomanizations.get(itunesKey)
			: undefined;
		const sourceRomanList = isBG ? romanWordData?.bg : romanWordData?.main;
		const availableRomanWords = sourceRomanList ? [...sourceRomanList] : [];

		if (itunesKey) {
			const metadataAttr = isBG ? "bg" : "main";
			line.translatedLyric =
				itunesTranslations.get(itunesKey)?.[metadataAttr] ?? "";
			line.romanLyric =
				itunesLineRomanizations.get(itunesKey)?.[metadataAttr] ?? "";
		}

		lineEl.childNodes.forEach((wordNode) => {
			if (wordNode.nodeType === Node.TEXT_NODE) {
				const word = wordNode.textContent ?? "";
				line.words.push(
					createWord({
						word,
						startTime: word.trim() ? startTime : 0,
						endTime: word.trim() ? endTime : 0,
					}),
				);
				return;
			}

			if (wordNode.nodeType !== Node.ELEMENT_NODE) return;
			const wordEl = wordNode as Element;
			const role = wordEl.getAttribute("ttm:role");

			if (wordEl.nodeName === "span" && role) {
				if (role === "x-bg")
					parseLineElement(wordEl, true, line.isDuet, itunesKey);
				else if (role === "x-translation")
					line.translatedLyric ||= (wordEl.textContent ?? "").trim();
				else if (role === "x-roman")
					line.romanLyric ||= (wordEl.textContent ?? "").trim();
				return;
			}

			if (!hasTimestamps(wordEl)) return;
			const wordStartTime = parseTime(wordEl.getAttribute("begin"));
			const wordEndTime = parseTime(wordEl.getAttribute("end"));
			const lyricWord = createWord({
				word: wordEl.textContent ?? "",
				startTime: wordStartTime,
				endTime: wordEndTime,
			});

			if (availableRomanWords.length > 0) {
				const matchIndex = availableRomanWords.findIndex(
					(romanWord) =>
						romanWord.startTime === lyricWord.startTime &&
						romanWord.endTime === lyricWord.endTime,
				);
				if (matchIndex !== -1) {
					lyricWord.romanWord = availableRomanWords[matchIndex].text;
					availableRomanWords.splice(matchIndex, 1);
				}
			}

			line.words.push(lyricWord);
		});

		if (!startTime && !endTime) alignLineTime(line);

		if (isBG) {
			const firstWord = line.words[0];
			if (firstWord) {
				firstWord.word = firstWord.word.replace(/^\s*[（(]/, "");
				if (!firstWord.word.trim()) line.words.shift();
			}

			const lastWord = line.words[line.words.length - 1];
			if (lastWord) {
				lastWord.word = lastWord.word.replace(/[)）]\s*$/, "");
				if (!lastWord.word.trim()) line.words.pop();
			}
		}
	}

	return { metadata, lines };
}
