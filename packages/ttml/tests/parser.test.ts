import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMImplementation, DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { AmllLyricLine, SubLyricContent, TTMLResult } from "../src/index";
import {
	TTMLGenerator,
	TTMLParser,
	toAmllLyrics,
	toTTMLResult,
} from "../src/index";

const XML = readFileSync(
	join(import.meta.dirname, "fixtures", "complex-test-song.ttml"),
	"utf-8",
);

const RUBY_XML = readFileSync(
	join(import.meta.dirname, "fixtures", "ruby-test-song.ttml"),
	"utf-8",
);

describe("TTML Integration Test", () => {
	let parser: TTMLParser;
	let result: TTMLResult;

	beforeAll(() => {
		parser = new TTMLParser({ domParser: new DOMParser() });
		result = parser.parse(XML);
	});

	const getLine = (id: string) => {
		const line = result.lines.find((l) => l.id === id);
		if (!line) throw new Error(`找不到 ID 为 ${id} 的歌词行`);
		return line;
	};

	const getTranslation = (
		item: { translations?: SubLyricContent[] },
		lang: string,
	) => {
		const trans = item.translations?.find((t) => t.language === lang);
		if (!trans) throw new Error(`未找到语言为 ${lang} 的翻译`);
		return trans;
	};

	const getRomanization = (
		item: { romanizations?: SubLyricContent[] },
		lang: string,
	) => {
		const roman = item.romanizations?.find((r) => r.language === lang);
		if (!roman) throw new Error(`未找到语言为 ${lang} 的音译`);
		return roman;
	};

	it("parses global language and timing mode", () => {
		expect(result.metadata.language).toBe("ja");
		expect(result.metadata.timingMode).toBe("Word");
		expect(result.metadata.title).toHaveLength(2);
		expect(result.metadata.title).toEqual([
			"Complex Test Song",
			"複雑なテストソング",
		]);
	});

	it("parses platform IDs", () => {
		expect(result.metadata.platformIds?.ncmMusicId).toContain("123456789");
		expect(result.metadata.platformIds?.qqMusicId).toContain("987654321");
		expect(result.metadata.platformIds?.spotifyId).toContain("abc123xyz");
		expect(result.metadata.platformIds?.appleMusicId).toContain("999888777");
	});

	it("parses artists list", () => {
		expect(result.metadata.artist).toHaveLength(2);
		expect(result.metadata.artist).toContain("Vocalist A (Taro)");
		expect(result.metadata.artist).toContain("Vocalist B (Hanako)");
	});

	it("builds an agent map", () => {
		expect(result.metadata.agents?.v1?.name).toBe("Vocalist A (Taro)");
		expect(result.metadata.agents?.v1000?.name).toBe("Chorus Group");
	});

	it("parses songwriters list", () => {
		expect(result.metadata.songwriters).toBeInstanceOf(Array);
		expect(result.metadata.songwriters).toHaveLength(2);
		expect(result.metadata.songwriters).toContain("作曲者1号");
		expect(result.metadata.songwriters).toContain("作曲者2号");
	});

	it("parses ISRC", () => {
		expect(result.metadata.isrc).toBeInstanceOf(Array);
		expect(result.metadata.isrc).toContain("JPXX02500001");
	});

	it("parses verse and agent in L1", () => {
		const l1 = getLine("L1");
		expect(l1.songPart).toBe("Verse");
		expect(l1.agentId).toBe("v1");
	});

	it("merges translations from Head in L1", () => {
		const l1 = getLine("L1");
		const transEn = getTranslation(l1, "en-US");
		const transZh = getTranslation(l1, "zh-Hans-CN");

		expect(transEn.text).toBe("This is the first line (Vocalist A)");
		expect(transZh.text).toBe("这是第一行歌词 (演唱者A)");
	});

	it("merges word-level romanization from Head", () => {
		const l1 = getLine("L1");
		const roman = getRomanization(l1, "ja-Latn");

		expect(roman.words).toBeInstanceOf(Array);
		expect(roman.words).toMatchObject([
			{ text: "Ko", startTime: 10000, endTime: 10500, endsWithSpace: false },
			{ text: "re", startTime: 10500, endTime: 10800, endsWithSpace: true },
			{ text: "wa", startTime: 10800, endTime: 11000, endsWithSpace: true },
			{
				text: "tesuto",
				startTime: 11200,
				endTime: 11800,
				endsWithSpace: false,
			},
		]);
	});

	it("handles explicit whitespace spans in L1", () => {
		const l1 = getLine("L1");
		expect(l1.words).toMatchObject([
			{ text: "これ" },
			{ text: "は", endsWithSpace: true },
			{ text: "テスト" },
		]);
	});

	it("handles complex background vocal nesting in L3", () => {
		const l3 = getLine("L3");
		expect(l3.songPart).toBe("Chorus");
		expect(l3.agentId).toBe("v1000");

		expect(l3.text).toContain("コーラス です");

		expect(l3.backgroundVocal).toBeDefined();
		expect(l3.backgroundVocal).toBeDefined();

		const bg = l3.backgroundVocal;
		if (!bg) throw new Error("背景人声数组中未找到数据");

		expect(bg.text).toBe("背景");

		const transEn = getTranslation(bg, "en");
		expect(transEn.text).toBe("Background");

		const roman = getRomanization(bg, "ja-Latn");
		expect(roman.text).toBe("haikei");
	});

	it("keeps both inline Body translation (en) and Head translation (en-US) in L3", () => {
		const l3 = getLine("L3");
		const bg = l3.backgroundVocal;
		if (!bg) throw new Error("背景人声数组中未找到数据");

		const transEn = getTranslation(bg, "en");
		expect(transEn.text).toBe("Background");

		const transEnUS = getTranslation(bg, "en-US");
		expect(transEnUS.text).toBe("With background");
	});

	it("parses all lyric lines", () => {
		expect(result.lines).toBeInstanceOf(Array);
		expect(result.lines).toHaveLength(3);

		const lineIds = result.lines.map((l) => l.id);
		expect(lineIds).toContain("L1");
		expect(lineIds).toContain("L2");
		expect(lineIds).toContain("L3");
	});

	it("parses the second line in L2", () => {
		const l2 = getLine("L2");

		expect(l2.songPart).toBe("Verse");
		expect(l2.agentId).toBe("v2");
		expect(l2.text).toContain("二つ目");
		expect(l2.text).toContain("の");
		expect(l2.text).toContain("ライン");
	});

	it("parses word-level timings in L2", () => {
		const l2 = getLine("L2");

		expect(l2.words).toMatchObject([
			{ text: "二つ目", startTime: 15000, endTime: 15800, endsWithSpace: true },
			{ text: "の", startTime: 16000, endTime: 16500, endsWithSpace: true },
			{ text: "ライン", startTime: 16500, endTime: 17000 },
		]);
	});

	it("validates time ranges for all lines", () => {
		const l1 = getLine("L1");
		expect(l1.startTime).toBe(10000);
		expect(l1.endTime).toBe(12000);

		const l2 = getLine("L2");
		expect(l2.startTime).toBe(15000);
		expect(l2.endTime).toBe(17000);

		const l3 = getLine("L3");
		expect(l3.startTime).toBe(20000);
		expect(l3.endTime).toBe(25000);
	});

	it("validates word-level timing accuracy in L1", () => {
		const l1 = getLine("L1");

		expect(l1.words).toMatchObject([
			{ startTime: 10000, endTime: 10500 },
			{ startTime: 10500, endTime: 10800 },
			{ startTime: 11200, endTime: 11800 },
		]);
	});

	it("parses album metadata", () => {
		expect(result.metadata.album).toBeInstanceOf(Array);
		expect(result.metadata.album).toHaveLength(1);
		expect(result.metadata.album?.[0]).toBe("AMLL Parser Test Suite");
	});

	it("parses author metadata", () => {
		expect(result.metadata.authorIds).toBeInstanceOf(Array);
		expect(result.metadata.authorIds).toHaveLength(1);
		expect(result.metadata.authorIds?.[0]).toBe("10001");

		expect(result.metadata.authorNames).toBeInstanceOf(Array);
		expect(result.metadata.authorNames).toHaveLength(1);
		expect(result.metadata.authorNames?.[0]).toBe("TestUser");
	});

	it("merges translations and romanization in L2", () => {
		const l2 = getLine("L2");

		const transEn = getTranslation(l2, "en-US");
		const transZh = getTranslation(l2, "zh-Hans-CN");

		expect(transEn.text).toBe("This is the second line (Vocalist B)");
		expect(transZh.text).toBe("这是第二行歌词 (演唱者B)");

		const roman = getRomanization(l2, "ja-Latn");
		expect(roman.words).toBeInstanceOf(Array);
		expect(roman.words).toHaveLength(3);
	});

	it("parses word-level romanization timings in L2", () => {
		const l2 = getLine("L2");
		const roman = getRomanization(l2, "ja-Latn");

		expect(roman.words).toMatchObject([
			{
				text: "Futatsume",
				startTime: 15000,
				endTime: 15800,
				endsWithSpace: true,
			},
			{ text: "no", startTime: 16000, endTime: 16500, endsWithSpace: true },
			{ text: "rain", startTime: 16500, endTime: 17000 },
		]);
	});

	it("parses word-level timings for main lyrics in L3", () => {
		const l3 = getLine("L3");

		expect(l3.words).toMatchObject([
			{
				text: "コーラス",
				startTime: 20000,
				endTime: 21500,
				endsWithSpace: true,
			},
			{ text: "です", startTime: 21500, endTime: 22000 },
		]);
	});

	it("parses background vocal timing and words in L3", () => {
		const l3 = getLine("L3");
		const bg = l3.backgroundVocal;
		if (!bg) throw new Error("未找到背景人声");

		expect(bg.startTime).toBe(22500);
		expect(bg.endTime).toBe(23800);

		expect(bg.words).toMatchObject([
			{ text: "背景", startTime: 22500, endTime: 23800 },
		]);
	});

	it("parses word-level timings for background romanization in L3", () => {
		const l3 = getLine("L3");
		const bg = l3.backgroundVocal;
		if (!bg) throw new Error("未找到背景人声");

		const roman = bg.romanizations?.find(
			(r) => r.language === "ja-Latn" && r.words && r.words.length > 0,
		);
		if (!roman) throw new Error("未找到包含字级别数据的 ja-Latn 音译");

		expect(roman.words).toMatchObject([
			{ text: "haikei", startTime: 22500, endTime: 23800 },
		]);
	});

	it("keeps both inline Body romanization and Head sidecar word-level romanization in L3", () => {
		const l3 = getLine("L3");
		const bg = l3.backgroundVocal;
		if (!bg) throw new Error("未找到背景人声");

		const jaRomans =
			bg.romanizations?.filter((r) => r.language === "ja-Latn") || [];

		expect(jaRomans.length).toBeGreaterThanOrEqual(2);

		const inlineRoman = jaRomans.find((r) => !r.words || r.words.length === 0);
		expect(inlineRoman?.text).toBe("haikei");

		const sidecarRoman = jaRomans.find((r) => r.words && r.words.length > 0);
		expect(sidecarRoman?.words).toMatchObject([
			{ text: "haikei", startTime: 22500, endTime: 23800 },
		]);
	});

	it("parses background role markers in translations in L3", () => {
		const l3 = getLine("L3");

		const transEn = getTranslation(l3, "en-US");
		expect(transEn.text).toContain("This is the chorus line");

		const transZh = getTranslation(l3, "zh-Hans-CN");
		expect(transZh.text).toContain("这是合唱部分");
	});

	it("includes structured background vocal data in L3", () => {
		const l3 = getLine("L3");
		const translation = getTranslation(l3, "en-US");

		expect(translation.backgroundVocal).toBeTypeOf("object");
		expect(translation.backgroundVocal).toBeDefined;
		expect(translation.backgroundVocal?.text).toBe("With background");
	});

	it("composes full text correctly", () => {
		expect(getLine("L1").text).toBe("これは テスト");
		expect(getLine("L2").text).toBe("二つ目 の ライン");
		expect(getLine("L3").text).toBe("コーラス です");
	});

	it("maps all vocalists correctly", () => {
		expect(result.metadata.agents).toBeDefined();
		expect(Object.keys(result.metadata.agents ?? {})).toHaveLength(3);

		expect(result.metadata.agents?.v1?.name).toBe("Vocalist A (Taro)");
		expect(result.metadata.agents?.v2?.name).toBe("Vocalist B (Hanako)");
		expect(result.metadata.agents?.v1000?.name).toBe("Chorus Group");
	});

	it("parses merged romanized text", () => {
		const l1 = getLine("L1");
		const roman = getRomanization(l1, "ja-Latn");
		expect(roman.text).toBe("Kore wa tesuto");
	});

	it("parses merged translation text", () => {
		const l1 = getLine("L1");
		expect(getTranslation(l1, "en-US").text).toBe(
			"This is the first line (Vocalist A)",
		);
		expect(getTranslation(l1, "zh-Hans-CN").text).toBe(
			"这是第一行歌词 (演唱者A)",
		);
	});

	it("parses obscene marker on regular syllables (amll:obscene) in L1", () => {
		const l1 = getLine("L1");
		expect(l1.words).toBeDefined();

		expect(l1.words?.[0].text).toBe("これ");
		expect(l1.words?.[0].obscene).toBe(true);

		expect(l1.words?.[1].text).toBe("は");
		expect(l1.words?.[1].obscene).toBeUndefined();
	});

	it("parses empty-beat marker on regular syllables (amll:empty-beat) in L1", () => {
		const l1 = getLine("L1");
		expect(l1.words).toBeDefined();

		expect(l1.words?.[2].text).toBe("テスト");
		expect(l1.words?.[2].emptyBeat).toBe(5);

		expect(l1.words?.[1].text).toBe("は");
		expect(l1.words?.[1].emptyBeat).toBeUndefined();
	});

	it("ensures all timings are valid numbers", () => {
		for (const line of result.lines) {
			expect(typeof line.startTime).toBe("number");
			expect(typeof line.endTime).toBe("number");
			expect(line.startTime).toBeGreaterThanOrEqual(0);
			expect(line.endTime).toBeGreaterThan(line.startTime);

			line.words?.forEach((word) => {
				expect(typeof word.startTime).toBe("number");
				expect(typeof word.endTime).toBe("number");
				expect(word.startTime).toBeGreaterThanOrEqual(0);
				expect(word.endTime).toBeGreaterThanOrEqual(word.startTime);
			});

			if (line.backgroundVocal) {
				expect(typeof line.backgroundVocal.startTime).toBe("number");
				expect(typeof line.backgroundVocal.endTime).toBe("number");
				expect(line.backgroundVocal.startTime).toBeGreaterThanOrEqual(0);
				expect(line.backgroundVocal.endTime).toBeGreaterThan(
					line.backgroundVocal.startTime,
				);
			}
		}
	});

	it("ensures all text fields are valid strings", () => {
		for (const line of result.lines) {
			expect(typeof line.text).toBe("string");
			expect(line.text.length).toBeGreaterThan(0);
			expect(typeof line.id).toBe("string");
			expect(line.id?.length).toBeGreaterThan(0);

			line.words?.forEach((word) => {
				expect(typeof word.text).toBe("string");
				expect(word.text.length).toBeGreaterThan(0);
			});
		}
	});

	it("preserve the data structure in Parse -> Generate -> Parse round-trip", () => {
		const originalResult = parser.parse(XML);

		const generator = new TTMLGenerator({
			domImplementation: new DOMImplementation(),
			xmlSerializer: new XMLSerializer(),
			useSidecar: false,
		});
		const generatedXML = generator.generate(originalResult);

		const roundTripParser = new TTMLParser({ domParser: new DOMParser() });
		const roundTripResult = roundTripParser.parse(generatedXML);

		expect(roundTripResult).toEqual(originalResult);
	});
});

describe("toAmllLyrics Conversion", () => {
	let parser: TTMLParser;
	let result: TTMLResult;
	let amllLines: AmllLyricLine[];

	beforeAll(() => {
		parser = new TTMLParser({ domParser: new DOMParser() });
		result = parser.parse(XML);
		amllLines = toAmllLyrics(result).lines;
	});

	it("converts to a flattened array", () => {
		expect(amllLines).toBeInstanceOf(Array);
		expect(amllLines).toHaveLength(4);
	});

	it("bes sorted correctly", () => {
		for (let i = 0; i < amllLines.length - 1; i++) {
			expect(amllLines[i].startTime).toBeLessThanOrEqual(
				amllLines[i + 1].startTime,
			);
		}
	});

	it("preserves word alignment for L1", () => {
		const l1 = amllLines[0];
		expect(l1.words).toMatchObject([
			{ romanWord: "Ko" },
			{ romanWord: "re" },
			{ romanWord: "tesuto" },
		]);
	});

	it("handles duet flags", () => {
		expect(amllLines[0].isDuet).toBe(false);
		expect(amllLines[1].isDuet).toBe(true);
		expect(amllLines[2].isDuet).toBe(false);
	});

	it("sets the isBG flag", () => {
		const bgLine = amllLines[3];
		expect(bgLine.isBG).toBe(true);
		expect(bgLine.translatedLyric).toBe("Background");
		expect(bgLine.romanLyric).toBe("haikei");
	});

	it("passs through obscene to AmllLyricWord", () => {
		const l1 = amllLines[0];

		expect(l1.words[0].word).toBe("これ");
		expect(l1.words[0].obscene).toBe(true);

		expect(l1.words[1].word).toBe("は ");
		expect(l1.words[1].obscene).toBeUndefined();
	});

	it("passs through emptyBeat to AmllLyricWord", () => {
		const l1 = amllLines[0];

		expect(l1.words[2].word).toBe("テスト");
		expect(l1.words[2].emptyBeat).toBe(5);

		expect(l1.words[1].word).toBe("は ");
		expect(l1.words[1].emptyBeat).toBeUndefined();
	});

	const toLayoutSnapshot = (lines: AmllLyricLine[]) =>
		lines.map((line) => {
			const time = (line.startTime / 1000).toFixed(2).padStart(6, " ");
			const position = line.isDuet ? "右" : "左";
			const typeMark = line.isBG ? "[bg]" : "[main]";
			const text = line.words
				.map((w) => w.word)
				.join("")
				.trim();
			return `[${time}s] ${position} ${typeMark} : ${text}`;
		});

	it.each([
		[
			"left-right duet layout in Apple Music style with multiple singers",
			"apple-music-duet.ttml",
		],
		["Apple Music TTML with v2000 other agent", "apple-music-other-duet.ttml"],
	])("computes %s correctly in duet alignment", (_, fixture) => {
		const xml = readFileSync(
			join(import.meta.dirname, "fixtures", fixture),
			"utf-8",
		);
		const lines = toAmllLyrics(parser.parse(xml)).lines;
		expect(toLayoutSnapshot(lines)).toMatchSnapshot();
	});

	it("converts Syllable.ruby to AmllLyricWord.ruby", () => {
		const mockRubyResult: TTMLResult = {
			metadata: {},
			lines: [
				{
					startTime: 0,
					endTime: 1000,
					text: "所詮",
					words: [
						{
							text: "所",
							startTime: 0,
							endTime: 500,
							ruby: [{ text: "しょ", startTime: 0, endTime: 500 }],
						},
						{
							text: "詮",
							startTime: 500,
							endTime: 1000,
							ruby: [
								{ text: "せ", startTime: 500, endTime: 750 },
								{ text: "ん", startTime: 750, endTime: 1000 },
							],
						},
					],
				},
			],
		};

		const lines = toAmllLyrics(mockRubyResult).lines;

		expect(lines[0].words[0].ruby).toBeDefined();
		expect(lines[0].words[0].ruby).toMatchObject([
			{ word: "しょ", startTime: 0, endTime: 500 },
		]);

		expect(lines[0].words[1].ruby).toBeDefined();
		expect(lines[0].words[1].ruby).toMatchObject([
			{ word: "せ", startTime: 500, endTime: 750 },
			{ word: "ん", startTime: 750, endTime: 1000 },
		]);
	});
});

describe("TTML Ruby Integration Test", () => {
	let parser: TTMLParser;
	let result: TTMLResult;

	beforeAll(() => {
		parser = new TTMLParser({ domParser: new DOMParser() });
		result = parser.parse(RUBY_XML);
	});

	it("parses full line text including ruby base text", () => {
		const l1 = result.lines.find((l) => l.id === "L1");
		expect(l1).toBeDefined();
		expect(l1?.text).toBe("これは所詮");
	});

	it("extracts ruby containers as standalone syllables with inferred timings", () => {
		const l1 = result.lines.find((l) => l.id === "L1");
		const words = l1?.words;

		expect(words).toBeDefined();
		expect(words).toHaveLength(3);

		expect(words?.[0].text).toBe("これは");
		expect(words?.[0].startTime).toBe(27000);

		expect(words?.[1].text).toBe("所");
		expect(words?.[1].startTime).toBe(27690);
		expect(words?.[1].endTime).toBe(27820);

		expect(words?.[2].text).toBe("詮");
		expect(words?.[2].startTime).toBe(27820);
		expect(words?.[2].endTime).toBe(27950);
	});

	it("extracts ruby annotation arrays (RubyTags)", () => {
		const l1 = result.lines.find((l) => l.id === "L1");
		const words = l1?.words;

		const ruby1 = words?.[1].ruby;
		expect(ruby1).toBeDefined();
		expect(ruby1).toHaveLength(1);
		expect(ruby1?.[0]).toMatchObject({
			text: "しょ",
			startTime: 27690,
			endTime: 27820,
		});

		const ruby2 = words?.[2].ruby;
		expect(ruby2).toBeDefined();
		expect(ruby2).toHaveLength(2);
		expect(ruby2?.[0]).toMatchObject({
			text: "せ",
			startTime: 27820,
			endTime: 27880,
		});
		expect(ruby2?.[1]).toMatchObject({
			text: "ん",
			startTime: 27880,
			endTime: 27950,
		});
	});

	it("excludes ruby from regular syllables", () => {
		const l1 = result.lines.find((l) => l.id === "L1");
		const words = l1?.words;

		expect(words?.[0].ruby).toBeUndefined();
	});
});

describe("toTTMLResult Conversion", () => {
	it("converts AmllLyricWord.ruby to Syllable.ruby", () => {
		const mockAmllLines: AmllLyricLine[] = [
			{
				startTime: 0,
				endTime: 1000,
				isBG: false,
				isDuet: false,
				translatedLyric: "",
				romanLyric: "",
				words: [
					{
						word: "所",
						startTime: 0,
						endTime: 500,
						ruby: [{ word: "しょ", startTime: 0, endTime: 500 }],
					},
					{
						word: "詮",
						startTime: 500,
						endTime: 1000,
						ruby: [
							{ word: "せ", startTime: 500, endTime: 750 },
							{ word: "ん", startTime: 750, endTime: 1000 },
						],
					},
				],
			},
		];

		const result = toTTMLResult(mockAmllLines, []);

		const words = result.lines[0].words;
		expect(words).toBeDefined();

		expect(words?.[0].ruby).toBeDefined();
		expect(words?.[0].ruby).toMatchObject([
			{ text: "しょ", startTime: 0, endTime: 500 },
		]);

		expect(words?.[1].ruby).toBeDefined();
		expect(words?.[1].ruby).toMatchObject([
			{ text: "せ", startTime: 500, endTime: 750 },
			{ text: "ん", startTime: 750, endTime: 1000 },
		]);
	});
});
