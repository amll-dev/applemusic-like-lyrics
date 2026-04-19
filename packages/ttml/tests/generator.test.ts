import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMImplementation, DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { AmllLyricLine, AmllMetadata, TTMLResult } from "../src/index";
import { TTMLGenerator, TTMLParser, toTTMLResult } from "../src/index";

const XML = readFileSync(
	join(import.meta.dirname, "fixtures", "complex-test-song.ttml"),
	"utf-8",
);

describe("TTML Generator Integration", () => {
	let parser: TTMLParser;
	let generator: TTMLGenerator;
	let originalResult: TTMLResult;
	let generatedXML: string;
	let parsedGeneratedResult: TTMLResult;

	beforeAll(() => {
		parser = new TTMLParser({ domParser: new DOMParser() });
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});

		originalResult = parser.parse(XML);
		generatedXML = generator.generate(originalResult);
		parsedGeneratedResult = parser.parse(generatedXML);
	});

	it("generates an XML string", () => {
		expect(generatedXML).toBeDefined();
		expect(typeof generatedXML).toBe("string");
		expect(generatedXML.length).toBeGreaterThan(0);
		expect(generatedXML).toContain("<tt");
		expect(generatedXML).toContain("</tt>");
	});

	it("matches the XML snapshot", () => {
		expect(generatedXML).toMatchSnapshot();
	});

	it("preserves metadata after round-trip generation", () => {
		expect(parsedGeneratedResult.metadata.language).toBe(
			originalResult.metadata.language,
		);
		expect(parsedGeneratedResult.metadata.timingMode).toBe(
			originalResult.metadata.timingMode,
		);
		expect(parsedGeneratedResult.metadata.title).toEqual(
			originalResult.metadata.title,
		);
		expect(parsedGeneratedResult.metadata.artist).toEqual(
			originalResult.metadata.artist,
		);
		expect(parsedGeneratedResult.metadata.album).toEqual(
			originalResult.metadata.album,
		);
		expect(parsedGeneratedResult.metadata.isrc).toEqual(
			originalResult.metadata.isrc,
		);
		expect(parsedGeneratedResult.metadata.platformIds).toEqual(
			originalResult.metadata.platformIds,
		);
		expect(parsedGeneratedResult.metadata.authorIds).toEqual(
			originalResult.metadata.authorIds,
		);
		expect(parsedGeneratedResult.metadata.authorNames).toEqual(
			originalResult.metadata.authorNames,
		);
		expect(parsedGeneratedResult.metadata.songwriters).toEqual(
			originalResult.metadata.songwriters,
		);
		expect(parsedGeneratedResult.metadata.agents).toEqual(
			originalResult.metadata.agents,
		);
	});

	it("preserves line count after round-trip generation", () => {
		expect(parsedGeneratedResult.lines.length).toBe(
			originalResult.lines.length,
		);
	});

	it("preserves line content after round-trip generation", () => {
		for (let i = 0; i < originalResult.lines.length; i++) {
			const originalLine = originalResult.lines[i];
			const generatedLine = parsedGeneratedResult.lines[i];

			expect(generatedLine.id).toBe(originalLine.id);
			expect(generatedLine.startTime).toBe(originalLine.startTime);
			expect(generatedLine.endTime).toBe(originalLine.endTime);
			expect(generatedLine.agentId).toBe(originalLine.agentId);
			expect(generatedLine.songPart).toBe(originalLine.songPart);
			expect(generatedLine.text).toBe(originalLine.text);

			expect(generatedLine.words?.length).toBe(originalLine.words?.length);
			if (originalLine.words && generatedLine.words) {
				for (let j = 0; j < originalLine.words.length; j++) {
					expect(generatedLine.words[j].text).toBe(originalLine.words[j].text);
					expect(generatedLine.words[j].startTime).toBe(
						originalLine.words[j].startTime,
					);
					expect(generatedLine.words[j].endTime).toBe(
						originalLine.words[j].endTime,
					);
				}
			}

			expect(generatedLine.translations?.length).toBe(
				originalLine.translations?.length,
			);
			if (originalLine.translations && generatedLine.translations) {
				for (let j = 0; j < originalLine.translations.length; j++) {
					expect(generatedLine.translations[j].language).toBe(
						originalLine.translations[j].language,
					);
					expect(generatedLine.translations[j].text).toBe(
						originalLine.translations[j].text,
					);
				}
			}

			expect(generatedLine.romanizations?.length).toBe(
				originalLine.romanizations?.length,
			);
			if (originalLine.romanizations && generatedLine.romanizations) {
				for (let j = 0; j < originalLine.romanizations.length; j++) {
					expect(generatedLine.romanizations[j].language).toBe(
						originalLine.romanizations[j].language,
					);
					expect(generatedLine.romanizations[j].text).toBe(
						originalLine.romanizations[j].text,
					);
				}
			}
		}
	});

	it("generates separated sidecar nodes for mismatched languages between main and background", () => {
		const mockResult: TTMLResult = {
			metadata: { timingMode: "Line" },
			lines: [
				{
					id: "L1",
					startTime: 0,
					endTime: 1000,
					text: "Main",
					translations: [{ language: "en", text: "Main English" }],
					backgroundVocal: {
						startTime: 0,
						endTime: 1000,
						text: "(Bg)",
						translations: [{ language: "es", text: "Bg Spanish" }],
					},
				},
			],
		};

		const generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
			useSidecar: true,
		});

		const xml = generator.generate(mockResult);

		const doc = new DOMParser().parseFromString(xml, "application/xml");
		const translations = Array.from(doc.getElementsByTagName("translation"));

		const enTrans = translations.find(
			(el) => el.getAttribute("xml:lang") === "en",
		);
		const esTrans = translations.find(
			(el) => el.getAttribute("xml:lang") === "es",
		);

		expect(enTrans).toBeDefined();
		expect(esTrans).toBeDefined();

		expect(enTrans?.textContent).toContain("Main English");
		expect(enTrans?.getElementsByTagName("span").length).toBe(0);

		expect(esTrans?.textContent).toContain("Bg Spanish");
		expect(esTrans?.textContent).not.toContain("Main English");

		const esSpans = esTrans?.getElementsByTagName("span");
		expect(esSpans?.length).toBe(1);
		expect(esSpans?.[0].getAttribute("ttm:role")).toBe("x-bg");
	});

	it("ensures inline translations and background vocals do not deeply nest each other", () => {
		const mockResult: TTMLResult = {
			metadata: { timingMode: "Line" },
			lines: [
				{
					id: "L1",
					startTime: 0,
					endTime: 1000,
					text: "Main Lyric",
					translations: [{ language: "en", text: "Main Trans" }],
					backgroundVocal: {
						startTime: 0,
						endTime: 1000,
						text: "(Bg Lyric)",
						translations: [{ language: "en", text: "Bg Trans" }],
					},
				},
			],
		};

		const generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
			useSidecar: false,
		});
		const xmlStr = generator.generate(mockResult);

		const doc = new DOMParser().parseFromString(xmlStr, "application/xml");
		const pNode = doc.getElementsByTagName("p")[0];

		const childSpans = Array.from(pNode.childNodes).filter(
			(n) => n.nodeType === 1 && n.nodeName.toLowerCase() === "span",
		) as unknown as Element[];

		const mainTransSpan = childSpans.find(
			(span) => span.getAttribute("ttm:role") === "x-translation",
		);
		const bgSpan = childSpans.find(
			(span) => span.getAttribute("ttm:role") === "x-bg",
		);

		expect(mainTransSpan).toBeDefined();
		expect(mainTransSpan?.textContent).toBe("Main Trans");

		expect(bgSpan).toBeDefined();
		expect(bgSpan?.textContent).toContain("Bg Lyric");

		if (!bgSpan) throw new Error();

		const nestedTransSpans = Array.from(bgSpan.getElementsByTagName("span"));
		expect(nestedTransSpans).toHaveLength(1);
		expect(nestedTransSpans[0].getAttribute("ttm:role")).toBe("x-translation");
		expect(nestedTransSpans[0].textContent).toBe("Bg Trans");
	});
});

describe("TTML Generator - toTTMLResult", () => {
	let generator: TTMLGenerator;
	let parser: TTMLParser;

	beforeAll(() => {
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});
		parser = new TTMLParser({ domParser: new DOMParser() });
	});

	it("generates TTMLResult from AMLL data and serialize it to XML", () => {
		const amllMetadata: AmllMetadata[] = [
			["musicName", ["Test Song"]],
			["artists", ["Artist A", "Artist B"]],
		];

		const amllLines: AmllLyricLine[] = [
			{
				startTime: 1000,
				endTime: 3000,
				isBG: false,
				isDuet: false,
				translatedLyric: "你好",
				romanLyric: "ni hao",
				words: [
					{ startTime: 1000, endTime: 2000, word: "你", romanWord: "ni" },
					{ startTime: 2000, endTime: 3000, word: "好", romanWord: "hao" },
				],
			},
			{
				startTime: 3000,
				endTime: 5000,
				isBG: true,
				isDuet: false,
				translatedLyric: "世界",
				romanLyric: "shi jie",
				words: [
					{ startTime: 3000, endTime: 4000, word: "世", romanWord: "shi" },
					{ startTime: 4000, endTime: 5000, word: "界", romanWord: "jie" },
				],
			},
		];

		const ttmlResult = toTTMLResult(amllLines, amllMetadata, {
			translationLanguage: "en",
			romanizationLanguage: "zh-Latn",
		});

		expect(ttmlResult.metadata.title).toEqual(["Test Song"]);
		expect(ttmlResult.metadata.artist).toEqual(["Artist A", "Artist B"]);
		expect(ttmlResult.lines.length).toBe(1);
		expect(ttmlResult.lines[0].backgroundVocal).toBeDefined();

		const xml = generator.generate(ttmlResult);
		expect(xml).toContain("<tt");
		expect(xml).toContain("Test Song");
		expect(xml).toContain("Artist A");
		expect(xml).toMatchSnapshot();

		const parsed = parser.parse(xml);
		expect(parsed.metadata.title).toEqual(["Test Song"]);
		expect(parsed.lines.length).toBe(1);
		expect(parsed.lines[0].text).toBe("你好");
		expect(parsed.lines[0].backgroundVocal?.text).toBe("世界");
	});
});

describe("TTML Generator - Line ID Generation", () => {
	let generator: TTMLGenerator;

	beforeAll(() => {
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});
	});

	const createMockResult = (
		lines: Partial<TTMLResult["lines"][0]>[],
	): TTMLResult => ({
		metadata: { agents: { v1: { id: "v1" } } },
		lines: lines as TTMLResult["lines"],
	});

	it("auto-generates line IDs from L1 when all IDs are missing", () => {
		const result = createMockResult([
			{ startTime: 0, endTime: 1000, text: "Line 1" },
			{ startTime: 1000, endTime: 2000, text: "Line 2" },
		]);

		const xml = generator.generate(result);

		expect(xml).toContain('itunes:key="L1"');
		expect(xml).toContain('itunes:key="L2"');
	});

	it("regenerates all line IDs when only some IDs are provided", () => {
		const result = createMockResult([
			{ id: "Custom1", startTime: 0, endTime: 1000, text: "Line 1" },
			{ startTime: 1000, endTime: 2000, text: "Line 2" },
			{ id: "Custom3", startTime: 2000, endTime: 3000, text: "Line 3" },
		]);

		const xml = generator.generate(result);

		expect(xml).not.toContain('"Custom1"');
		expect(xml).not.toContain('"Custom3"');

		expect(xml).toContain('itunes:key="L1"');
		expect(xml).toContain('itunes:key="L2"');
		expect(xml).toContain('itunes:key="L3"');
	});

	it("keeps existing line IDs when all valid IDs are provided", () => {
		const result = createMockResult([
			{ id: "Custom1", startTime: 0, endTime: 1000, text: "Line 1" },
			{ id: "Custom2", startTime: 1000, endTime: 2000, text: "Line 2" },
		]);

		const xml = generator.generate(result);

		expect(xml).toContain('itunes:key="Custom1"');
		expect(xml).toContain('itunes:key="Custom2"');
		expect(xml).not.toContain('itunes:key="L1"');
	});
});

describe("TTML Generator - Agent Inference and Completion", () => {
	let generator: TTMLGenerator;

	beforeAll(() => {
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});
	});

	it("infers and generate default v1 when meta.agents and line agentId are missing", () => {
		const result: TTMLResult = {
			metadata: {},
			lines: [
				{ startTime: 0, endTime: 1000, text: "Line 1" },
				{ startTime: 1000, endTime: 2000, text: "Line 2" },
			],
		};

		const xml = generator.generate(result);

		expect(xml).toContain('<ttm:agent type="person" xml:id="v1"');
		const pTagMatches = xml.match(/ttm:agent="v1"/g);
		expect(pTagMatches?.length).toBe(2);
	});

	it("infers unique agents from line agentIds when meta.agents is missing", () => {
		const result: TTMLResult = {
			metadata: {},
			lines: [
				{ agentId: "v1", startTime: 0, endTime: 1000, text: "Line 1" },
				{ agentId: "v2", startTime: 1000, endTime: 2000, text: "Line 2" },
				{ agentId: "v1", startTime: 2000, endTime: 3000, text: "Line 3" },
			],
		};

		const xml = generator.generate(result);

		const v1AgentDeclMatches = xml.match(
			/<ttm:agent type="person" xml:id="v1"/g,
		);
		const v2AgentDeclMatches = xml.match(
			/<ttm:agent type="person" xml:id="v2"/g,
		);

		expect(v1AgentDeclMatches?.length).toBe(1);
		expect(v2AgentDeclMatches?.length).toBe(1);
	});

	it("uses provided meta.agents without auto-inference", () => {
		const result: TTMLResult = {
			metadata: {
				agents: {
					v3: { id: "v3", name: "Custom Singer", type: "person" },
				},
			},
			lines: [
				{ agentId: "v1", startTime: 0, endTime: 1000, text: "Line 1" },
				{ agentId: "v2", startTime: 1000, endTime: 2000, text: "Line 2" },
			],
		};

		const xml = generator.generate(result);

		expect(xml).toContain('xml:id="v3"');
		expect(xml).toContain("Custom Singer");

		expect(xml).not.toContain('<ttm:agent type="person" xml:id="v1"');
		expect(xml).not.toContain('<ttm:agent type="person" xml:id="v2"');

		expect(xml).toContain(
			'<p begin="0.000" end="1.000" itunes:key="L1" ttm:agent="v1">',
		);
		expect(xml).toContain(
			'<p begin="1.000" end="2.000" itunes:key="L2" ttm:agent="v2">',
		);
	});

	it("infers v1000 as a group agent", () => {
		const result: TTMLResult = {
			metadata: {},
			lines: [
				{
					agentId: "v1",
					startTime: 0,
					endTime: 1000,
					text: "Line 1",
				},
				{
					agentId: "v1000",
					startTime: 1000,
					endTime: 2000,
					text: "Chorus Line",
				},
			],
		};

		const xml = generator.generate(result);

		expect(xml).toContain('<ttm:agent type="person" xml:id="v1"');
		expect(xml).toContain('<ttm:agent type="group" xml:id="v1000"');
		expect(xml).toContain(
			'<p begin="0.000" end="1.000" itunes:key="L1" ttm:agent="v1">',
		);
		expect(xml).toContain(
			'<p begin="1.000" end="2.000" itunes:key="L2" ttm:agent="v1000">',
		);
	});
});

describe("TTML Generator - Ruby Generation", () => {
	let generator: TTMLGenerator;
	let parser: TTMLParser;

	beforeAll(() => {
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});
		parser = new TTMLParser({ domParser: new DOMParser() });
	});

	it("generates ruby XML with tts namespace and four-level nesting for round-trip", () => {
		const rubyResult: TTMLResult = {
			metadata: {
				title: ["Ruby Generation Test"],
			},
			lines: [
				{
					id: "L1",
					startTime: 27000,
					endTime: 28000,
					text: "これは所詮",
					words: [
						{ text: "これは", startTime: 27000, endTime: 27500 },
						{
							text: "所",
							startTime: 27690,
							endTime: 27820,
							ruby: [{ text: "しょ", startTime: 27690, endTime: 27820 }],
						},
						{
							text: "詮",
							startTime: 27820,
							endTime: 27950,
							ruby: [
								{ text: "せ", startTime: 27820, endTime: 27880 },
								{ text: "ん", startTime: 27880, endTime: 27950 },
							],
						},
					],
				},
			],
		};

		const xml = generator.generate(rubyResult);

		expect(xml).toContain('xmlns:tts="http://www.w3.org/ns/ttml#styling"');

		expect(xml).toContain('tts:ruby="container"');
		expect(xml).toContain('tts:ruby="base"');
		expect(xml).toContain('tts:ruby="textContainer"');
		expect(xml).toContain('tts:ruby="text"');

		expect(xml).toContain('begin="27.000" end="27.500">これは</span>');

		const parsedResult = parser.parse(xml);
		const parsedLine = parsedResult.lines[0];

		expect(parsedLine.text).toBe("これは所詮");
		expect(parsedLine.words).toBeDefined();
		expect(parsedLine.words).toHaveLength(3);

		const rubyWord1 = parsedLine.words?.[1];
		expect(rubyWord1?.text).toBe("所");
		expect(rubyWord1?.ruby).toHaveLength(1);
		expect(rubyWord1?.ruby?.[0]).toMatchObject({
			text: "しょ",
			startTime: 27690,
			endTime: 27820,
		});

		const rubyWord2 = parsedLine.words?.[2];
		expect(rubyWord2?.text).toBe("詮");
		expect(rubyWord2?.ruby).toHaveLength(2);
		expect(rubyWord2?.ruby?.[0]).toMatchObject({
			text: "せ",
			startTime: 27820,
			endTime: 27880,
		});
		expect(rubyWord2?.ruby?.[1]).toMatchObject({
			text: "ん",
			startTime: 27880,
			endTime: 27950,
		});
	});
});

describe("TTML Generator - Obscene words", () => {
	let generator: TTMLGenerator;
	let parser: TTMLParser;

	beforeAll(() => {
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});
		parser = new TTMLParser({ domParser: new DOMParser() });
	});

	it("injects amll:obscene in generated XML and supports round-trip", () => {
		const result: TTMLResult = {
			metadata: {},
			lines: [
				{
					id: "L1",
					startTime: 0,
					endTime: 3000,
					text: "bad word rubyBad",
					words: [
						{ text: "bad", startTime: 0, endTime: 1000, obscene: true },
						{
							text: "word",
							startTime: 1000,
							endTime: 2000,
							endsWithSpace: true,
						},
						{
							text: "rubyBad",
							startTime: 2000,
							endTime: 3000,
							obscene: true,
							ruby: [{ text: "rb", startTime: 2000, endTime: 3000 }],
						},
					],
				},
			],
		};

		const xml = generator.generate(result);

		expect(xml).toContain('amll:obscene="true">bad</span>');
		expect(xml).not.toContain('amll:obscene="true">word</span>');
		expect(xml).toContain('tts:ruby="container" amll:obscene="true"');

		const parsed = parser.parse(xml);
		const parsedWords = parsed.lines[0].words;

		expect(parsedWords).toBeDefined();
		expect(parsedWords).toHaveLength(3);
		expect(parsedWords?.[0].obscene).toBe(true);
		expect(parsedWords?.[1].obscene).toBeUndefined();
		expect(parsedWords?.[2].obscene).toBe(true);
	});

	it("restores obscene from AMLL fallback structure", () => {
		const amllLines: AmllLyricLine[] = [
			{
				startTime: 0,
				endTime: 1000,
				isBG: false,
				isDuet: false,
				translatedLyric: "",
				romanLyric: "",
				words: [
					{
						startTime: 0,
						endTime: 500,
						word: "bad ",
						romanWord: "",
						obscene: true,
					},
					{ startTime: 500, endTime: 1000, word: "word", romanWord: "" },
				],
			},
		];

		const ttmlResult = toTTMLResult(amllLines, []);
		const words = ttmlResult.lines[0].words;

		expect(words).toBeDefined();
		expect(words).toHaveLength(2);

		expect(words?.[0].text).toBe("bad");
		expect(words?.[0].endsWithSpace).toBe(true);
		expect(words?.[0].obscene).toBe(true);

		expect(words?.[1].text).toBe("word");
		expect(words?.[1].endsWithSpace).toBe(false);
		expect(words?.[1].obscene).toBeUndefined();
	});
});

describe("TTML Generator - Empty Beat", () => {
	let generator: TTMLGenerator;
	let parser: TTMLParser;

	beforeAll(() => {
		generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
		});
		parser = new TTMLParser({ domParser: new DOMParser() });
	});

	it("injects amll:empty-beat in generated XML and support round-trip", () => {
		const result: TTMLResult = {
			metadata: {},
			lines: [
				{
					id: "L1",
					startTime: 0,
					endTime: 2000,
					text: "wait word",
					words: [
						{ text: "wait", startTime: 0, endTime: 1000, emptyBeat: 4 },
						{ text: "word", startTime: 1000, endTime: 2000 },
					],
				},
			],
		};

		const xml = generator.generate(result);

		expect(xml).toContain('amll:empty-beat="4">wait</span>');
		expect(xml.match(/amll:empty-beat/g)?.length).toBe(1);

		const parsed = parser.parse(xml);
		const parsedWords = parsed.lines[0].words;

		expect(parsedWords).toBeDefined();
		expect(parsedWords).toHaveLength(2);
		expect(parsedWords?.[0].emptyBeat).toBe(4);
		expect(parsedWords?.[1].emptyBeat).toBeUndefined();
	});

	it("restores emptyBeat from AMLL fallback structure", () => {
		const amllLines: AmllLyricLine[] = [
			{
				startTime: 0,
				endTime: 1000,
				isBG: false,
				isDuet: false,
				translatedLyric: "",
				romanLyric: "",
				words: [
					{
						startTime: 0,
						endTime: 500,
						word: "wait ",
						romanWord: "",
						emptyBeat: 8,
					},
					{ startTime: 500, endTime: 1000, word: "word", romanWord: "" },
				],
			},
		];

		const ttmlResult = toTTMLResult(amllLines, []);
		const words = ttmlResult.lines[0].words;

		expect(words).toBeDefined();
		expect(words).toHaveLength(2);

		expect(words?.[0].text).toBe("wait");
		expect(words?.[0].emptyBeat).toBe(8);

		expect(words?.[1].text).toBe("word");
		expect(words?.[1].emptyBeat).toBeUndefined();
	});
});
