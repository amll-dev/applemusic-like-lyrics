import { describe, expect, it } from "vitest";
import {
	parseEslrc,
	parseLrc,
	parseLrcA2,
	parseLrcLike,
	parseSPL,
	type StringifyLrcLikeOptions,
	stringifyEslrc,
	stringifyLrc,
	stringifyLrcA2,
	stringifyLrcLike,
	stringifySPL,
} from "../src/formats/lrc";
import { createLine, createWord, MAX_LRC_TIMESTAMP } from "../src/utils";
import {
	invalidTimeStamps,
	timeStampsTestCases,
} from "./timestampcase.fixture";

const PLAIN_OPTIONS: StringifyLrcLikeOptions = { mode: "plain" };

const ENHANCED_OPTIONS: StringifyLrcLikeOptions = {
	mode: "spl",
	inlineBracket: "angle",
};

const ESLYRIC_OPTIONS: StringifyLrcLikeOptions = {
	mode: "spl",
	inlineBracket: "square",
};

describe("lrc-like", () => {
	it.each([
		["普通 LRC", "[00:01.120]Hello", "Hello"],
		[
			"增强型 LRC",
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
			"Hello World",
		],
		[
			"ESLyric 逐词歌词",
			"[00:10.82]Test[00:10.97] Word[00:12.62]",
			"Test Word",
		],
		[
			"SPL 混用两种括号",
			"[00:01.000][00:01.000]Hello <00:01.500>World[00:02.000]",
			"Hello World",
		],
	])("parses %s with a single entry", (_format, input, text) => {
		expect(
			parseLrcLike(input)
				.lines[0].words.map((w) => w.word)
				.join(""),
		).toBe(text);
	});

	it("parses all kinds of line timestamps in plain and word-by-word lines", () => {
		const plain = timeStampsTestCases
			.map(([ts, ms]) => `[${ts}]Should be ${ts} = ${ms} ms`)
			.join("\n");
		const plainLines = parseLrcLike(plain).lines;

		expect(plainLines).toHaveLength(timeStampsTestCases.length);
		plainLines.forEach((line, i) => {
			const [ts, ms] = timeStampsTestCases[i];
			expect(line.words[0].word).toBe(`Should be ${ts} = ${ms} ms`);
			expect(line.startTime).toBe(ms);
		});

		const wordSync = timeStampsTestCases
			.map(([ts]) => `[${ts}]<${ts}>Word<${ts}>`)
			.join("\n");
		const wordSyncLines = parseLrcLike(wordSync).lines;

		expect(wordSyncLines).toHaveLength(timeStampsTestCases.length);
		wordSyncLines.forEach((line, i) => {
			expect(line.startTime).toBe(timeStampsTestCases[i][1]);
		});
	});

	it("keeps an unrecognizable timestamp as plain text", () => {
		// 圆括号不是时间戳定界符，括号里写法不合规的时间戳同样无法识别，
		// 这类写法只是普通文本：行首没有别的时间戳时整行退化成上一行的翻译，
		// 行首还有合法时间戳时则只是一个普通歌词行
		const cases: [line: string, text: string, isTranslation: boolean][] = [
			...invalidTimeStamps.flatMap((ts): [string, string, boolean][] => [
				[`[${ts}]World`, `[${ts}]World`, true],
				[`<${ts}>World`, `<${ts}>World`, true],
			]),
			["(00:02.000)World", "(00:02.000)World", true],
			["[00:12.00]Text[invalid]", "Text[invalid]", false],
		];

		for (const [line, text, isTranslation] of cases) {
			const lines = parseLrcLike(
				`[00:01.000]<00:01.000>Hello<00:02.000>\n${line}`,
			).lines;

			expect(lines).toHaveLength(2);
			expect(lines[0].words.map((w) => w.word).join("")).toBe("Hello");
			expect(lines[1].words[0].word).toBe(text);
			// 翻译与主歌词行同时开始、同时结束；末行的逐行歌词使用默认结束时间
			expect(lines[1].startTime).toBe(isTranslation ? 1000 : 12000);
			expect(lines[1].endTime).toBe(isTranslation ? 2000 : MAX_LRC_TIMESTAMP);
		}
	});

	it("ignores empty lines and lines with only whitespace", () => {
		const lines = parseLrcLike(
			"[00:00.000]   \n[00:01.000]<00:01.000>Hello<00:02.000>\n   \n\n[00:03.000]<00:03.000>World<00:04.000>\n   \n",
		).lines;

		expect(lines.map((line) => line.words.map((w) => w.word).join(""))).toEqual(
			["Hello", "World"],
		);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[1].startTime).toBe(3000);
	});

	it("drops comment lines starting with # or //", () => {
		const result = parseLrcLike(
			[
				"# 文件头部注释",
				"[00:01.120]Hello",
				"  // 缩进后仍算注释",
				"你好",
				"# [00:05.000]注释里的时间戳不作数",
				"[00:03.000]World",
				"[00:07.000]# 行内出现的 # 不是注释",
				"[00:09.000]https://example.com/lyrics",
			].join("\n"),
		);

		expect(result.lines.map((line) => line.words[0].word)).toEqual([
			"Hello",
			"你好",
			"World",
			"# 行内出现的 # 不是注释",
			"https://example.com/lyrics",
		]);
		expect(result.lines[1].startTime).toBe(1120);
		expect(result.lines[1].endTime).toBe(3000);
	});

	it("drops word level timestamps in plain mode", () => {
		const result = parseLrcLike(
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
			{ mode: "plain" },
		);

		expect(result.lines[0].words).toHaveLength(1);
		expect(result.lines[0].words[0].word).toBe("Hello World");
		expect(result.lines[0].words[0].startTime).toBe(1000);
		expect(result.lines[0].words[0].endTime).toBe(2000);
	});

	it("keeps metadata keys as they are", () => {
		const result = parseLrcLike(
			"[ti:标题]\n[ar:艺术家]\n[al:专辑]\n[by:作者]\n[la:zh]\n[offset:500]\n[custom:值]\n[00:01.120]Hello",
		);

		expect(result.metadata).toEqual([
			["ti", ["标题"]],
			["ar", ["艺术家"]],
			["al", ["专辑"]],
			["by", ["作者"]],
			["la", ["zh"]],
			["offset", ["500"]],
			["custom", ["值"]],
		]);
		expect(result.lines).toHaveLength(1);
		expect(result.lines[0].words[0].word).toBe("Hello");
	});

	it("merges repeated metadata keys into one entry", () => {
		const result = parseLrcLike("[ar:甲]\n[ar:乙]\n[ar:甲]\n[00:01.120]Hello");

		expect(result.metadata).toEqual([["ar", ["甲", "乙"]]]);
	});

	it("stringifies metadata lines back", () => {
		const result = stringifyLrcLike({
			lines: [
				createLine({
					startTime: 1120,
					endTime: 3000,
					words: [
						createWord({ word: "Hello", startTime: 1120, endTime: 3000 }),
					],
				}),
			],
			metadata: [
				["ti", ["标题"]],
				["ar", ["甲", "乙"]],
				["empty", [""]],
			],
		});

		expect(result).toBe("[ti:标题]\n[ar:甲/乙]\n[00:01.120]Hello");
	});

	it("outputs translations as separate auxiliary lines", () => {
		const result = stringifyLrcLike([
			createLine({
				startTime: 1120,
				endTime: 3000,
				words: [createWord({ word: "Hello", startTime: 1120, endTime: 3000 })],
				translatedLyric: "你好",
				romanLyric: "hello",
			}),
		]);

		expect(result).toBe("[00:01.120]Hello\n[00:01.120]你好\n[00:01.120]hello");
	});

	it("inlines an auxiliary line in plain mode", () => {
		const lines = [
			createLine({
				startTime: 1120,
				endTime: 3000,
				words: [createWord({ word: "Hello", startTime: 1120, endTime: 3000 })],
				translatedLyric: "你好",
			}),
		];

		expect(
			stringifyLrcLike(lines, {
				mode: "plain",
				auxiliaryLines: { translation: { inline: true } },
			}),
		).toBe("[00:01.120]Hello (你好)");
	});

	it("attaches the following background line to the main line", () => {
		const lines = [
			createLine({
				startTime: 1000,
				endTime: 2000,
				words: [createWord({ word: "Hello", startTime: 1000, endTime: 2000 })],
			}),
			createLine({
				startTime: 2500,
				endTime: 3500,
				isBG: true,
				words: [createWord({ word: "和声", startTime: 2500, endTime: 3500 })],
			}),
		];

		expect(stringifyLrcLike(lines)).toBe("[00:01.000]Hello\n[00:02.500](和声)");
	});

	it("inlines the following background line without matching timestamps", () => {
		const lines = [
			createLine({
				startTime: 1000,
				endTime: 2000,
				words: [createWord({ word: "Hello", startTime: 1000, endTime: 2000 })],
			}),
			createLine({
				startTime: 2500,
				endTime: 3500,
				isBG: true,
				words: [createWord({ word: "和声", startTime: 2500, endTime: 3500 })],
			}),
		];

		expect(
			stringifyLrcLike(lines, {
				mode: "plain",
				auxiliaryLines: { backgroundVocal: { inline: true } },
			}),
		).toBe("[00:01.000]Hello (和声)");
	});

	it("keeps the parentheses of a background line without a host", () => {
		const lines = [
			createLine({
				startTime: 3000,
				endTime: 4000,
				isBG: true,
				words: [createWord({ word: "和声", startTime: 3000, endTime: 4000 })],
			}),
			createLine({
				startTime: 1000,
				endTime: 2000,
				words: [createWord({ word: "Hello", startTime: 1000, endTime: 2000 })],
			}),
		];

		expect(stringifyLrcLike(lines)).toBe("[00:03.000](和声)\n[00:01.000]Hello");
	});

	it("wraps every following background line in parentheses", () => {
		const lines = [
			createLine({
				startTime: 1000,
				endTime: 2000,
				words: [createWord({ word: "Hello", startTime: 1000, endTime: 2000 })],
			}),
			createLine({
				startTime: 3000,
				endTime: 4000,
				isBG: true,
				words: [createWord({ word: "和声甲", startTime: 3000, endTime: 4000 })],
			}),
			createLine({
				startTime: 3000,
				endTime: 4000,
				isBG: true,
				words: [createWord({ word: "和声乙", startTime: 3000, endTime: 4000 })],
			}),
		];

		// 多个背景人声行各自独立写出，只有第一行会成为主歌词行的背景人声
		expect(stringifyLrcLike(lines)).toBe(
			"[00:01.000]Hello\n[00:03.000](和声甲)\n[00:03.000](和声乙)",
		);

		const reparsed = parseLrcLike(stringifyLrcLike(lines)).lines;
		expect(reparsed.map((line) => line.isBG)).toEqual([false, true, true]);
	});

	it("outputs word level timestamps in spl mode", () => {
		const result = stringifyLrcLike(
			[
				createLine({
					startTime: 1000,
					endTime: 2000,
					words: [
						createWord({ word: "Hello ", startTime: 1000, endTime: 1500 }),
						createWord({ word: "World", startTime: 1500, endTime: 2000 }),
					],
				}),
			],
			{ mode: "spl" },
		);

		expect(result).toBe(
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
		);
	});

	it("outputs an explicit end timestamp when the next line is far away", () => {
		const lines = [
			createLine({
				startTime: 1000,
				endTime: 2000,
				words: [createWord({ word: "Hello", startTime: 1000, endTime: 2000 })],
			}),
			createLine({
				startTime: 20000,
				endTime: 21000,
				words: [
					createWord({ word: "World", startTime: 20000, endTime: 21000 }),
				],
			}),
		];

		expect(stringifyLrcLike(lines)).toBe("[00:01.000]Hello\n[00:20.000]World");

		const text = stringifyLrcLike(lines, {
			endTimestamp: { mode: "interval" },
		});
		expect(text).toBe(
			"[00:01.000]Hello\n[00:02.000]\n[00:20.000]World\n[00:21.000]",
		);

		expect(parseLrcLike(text).lines).toEqual(lines);
	});

	it.each([
		{
			name: "普通 LRC",
			input: "[00:01.120]Hello\n你好\n[00:03.000]World",
			options: PLAIN_OPTIONS,
		},
		{
			name: "增强型 LRC",
			input:
				"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>\n[00:03.000]<00:03.000>Again<00:03.500>",
			options: ENHANCED_OPTIONS,
		},
		{
			name: "ESLyric 逐词歌词",
			input:
				"[00:10.82]Test[00:10.97] Word[00:12.62]\n[00:12.62]Next[00:13.20] line[00:14.10]",
			options: ESLYRIC_OPTIONS,
		},
		{
			name: "带元数据与辅助行的歌词",
			input:
				"[ti:标题]\n[00:01.120]Hello\n你好\n[00:01.120](和声)\n[00:03.000]World",
			options: PLAIN_OPTIONS,
		},
	])(
		"keeps parse -> stringify -> parse stable for $name",
		({ input, options }) => {
			const first = parseLrcLike(input);
			const second = parseLrcLike(stringifyLrcLike(first, options));

			expect(second).toEqual(first);
		},
	);
});

describe("lrc", () => {
	it("parses basic timestamped lines", () => {
		const lines = parseLrcLike("[00:01.120]Hello\n[00:03.000]World").lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(3000);
		expect(lines[1].endTime).toBe(MAX_LRC_TIMESTAMP);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("handles CRLF line breaks correctly", () => {
		const lines = parseLrcLike("[00:01.120]Hello\r\n[00:03.000]World").lines;

		expect(lines).toHaveLength(2);
		expect(lines.map((line) => line.words[0].word)).toEqual(["Hello", "World"]);
	});

	it("parses multiple timestamps for the same line", () => {
		const lines = parseLrcLike("[00:01.120][00:02.000]Hello").lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(2000);
		expect(lines[1].endTime).toBe(MAX_LRC_TIMESTAMP);
		expect(lines[1].words[0].word).toBe("Hello");
	});

	it("treats a line without timestamps as the translation of the previous line", () => {
		const lines = parseLrcLike(
			"[00:01.120]Hello\n你好\n[00:03.000]World",
		).lines;

		expect(lines).toHaveLength(3);
		expect(lines[0].words[0].word).toBe("Hello");
		// 翻译会展开成与主歌词行同时开始、同时结束的独立歌词行
		expect(lines[1].words[0].word).toBe("你好");
		expect(lines[1].startTime).toBe(1120);
		expect(lines[1].endTime).toBe(3000);
		expect(lines[2].words[0].word).toBe("World");
	});

	it("treats a line with the same timestamp as the translation of the previous line", () => {
		const lines = parseLrcLike(
			"[00:01.120]Hello\n[00:01.120]你好\n[00:03.000]World",
		).lines;

		expect(lines).toHaveLength(3);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].words[0].word).toBe("你好");
		expect(lines[1].startTime).toBe(1120);
		expect(lines[1].endTime).toBe(3000);
		expect(lines[2].words[0].word).toBe("World");
	});

	it("treats a line with the same timestamp as the translation of an earlier line", () => {
		const lines = parseLrcLike(
			"[00:01.120]Hello\n[00:03.000]World\n[00:01.120]你好",
		).lines;

		expect(lines).toHaveLength(3);
		// 翻译行不必紧挨着主歌词行，时间戳相同且位于其后即可
		expect(lines.map((line) => line.words[0].word)).toEqual([
			"Hello",
			"你好",
			"World",
		]);
		// 翻译不参与结束时间的推导，否则主歌词行会退化成零时长
		expect(lines[0].startTime).toBe(1120);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[1].startTime).toBe(1120);
		expect(lines[1].endTime).toBe(3000);
	});

	it("expands every translation line into its own lyric line", () => {
		const lines = parseLrcLike("[00:01.120]Hello\n你好\nこんにちは").lines;

		expect(lines.map((line) => line.words[0].word)).toEqual([
			"Hello",
			"你好",
			"こんにちは",
		]);
		expect(lines.map((line) => line.startTime)).toEqual([1120, 1120, 1120]);
		// 解析结果里每一行都是普通歌词行，翻译不占用 translatedLyric 字段
		expect(lines.map((line) => line.translatedLyric)).toEqual(["", "", ""]);
	});

	it("attaches translations to every line of a repeated line group", () => {
		const lines = parseLrcLike("[00:01.000][00:02.000]Hello\n你好").lines;

		expect(lines).toHaveLength(4);
		expect(lines.map((line) => line.words[0].word)).toEqual([
			"Hello",
			"你好",
			"Hello",
			"你好",
		]);
		expect(lines.map((line) => line.startTime)).toEqual([
			1000, 1000, 2000, 2000,
		]);
	});

	it("attaches a translation without timestamp to the immediately preceding line only", () => {
		const lines = parseLrcLike(
			"[00:01.000]你好椒盐音乐\n[00:02.000]不要糖醋放椒盐\nHello Salt Player",
		).lines;

		expect(lines).toHaveLength(3);
		expect(lines.map((line) => line.words[0].word)).toEqual([
			"你好椒盐音乐",
			"不要糖醋放椒盐",
			"Hello Salt Player",
		]);
		expect(lines[2].startTime).toBe(2000);
		expect(lines[2].endTime).toBe(MAX_LRC_TIMESTAMP);
	});

	it("treats a line with only a timestamp as the end time of the previous line", () => {
		const lines = parseLrcLike(
			"[00:01.120]Hello\n[00:03.000]\n[00:05.000]World",
		).lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[0].endTime).toBe(3000);
		expect(lines[1].words[0].word).toBe("World");
		expect(lines[1].endTime).toBe(MAX_LRC_TIMESTAMP);
	});

	it("parses an inline explicit end timestamp on a plain line", () => {
		const lines = parseLrcLike("[00:05.220]你好椒盐音乐[00:06.220]").lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(5220);
		expect(lines[0].endTime).toBe(6220);
		expect(lines[0].words).toHaveLength(1);
		expect(lines[0].words[0].word).toBe("你好椒盐音乐");
	});

	it("closes the last word of a word-by-word line with a standalone timestamp", () => {
		const lines = parseLrcLike(
			"[00:01.120]<00:01.120>Hello <00:02.120>World\n[00:03.000]",
		).lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].endTime).toBe(3000);
		expect(lines[0].words[1].word).toBe("World");
		expect(lines[0].words[1].endTime).toBe(3000);
	});

	it("ignores a standalone timestamp that cannot end the previous line", () => {
		expect(parseLrcLike("[00:01.000]\n[00:02.000]Hello").lines).toHaveLength(1);

		const earlier = parseLrcLike("[00:02.000]Hello\n[00:01.000]").lines;
		expect(earlier).toHaveLength(1);
		expect(earlier[0].endTime).toBe(MAX_LRC_TIMESTAMP);

		expect(
			parseLrcLike("[00:02.000]Hello\n[00:03.000]\n[00:01.000]").lines,
		).toHaveLength(1);
	});

	it("marks a line wrapped in parentheses as a background line", () => {
		const lines = parseLrcLike("[00:01.120](Hello)\n[00:03.000]（Hi）").lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].isBG).toBe(true);
		expect(lines[1].words[0].word).toBe("Hi");
	});

	it("keeps partial parentheses as normal text", () => {
		const lines = parseLrcLike(
			"[00:01.120]Say (Hello)\n[00:03.000](Hi) there\n[00:05.000]()",
		).lines;

		expect(lines.map((line) => [line.isBG, line.words[0].word])).toEqual([
			[false, "Say (Hello)"],
			[false, "(Hi) there"],
			[false, "()"],
		]);
	});

	it("keeps background lines with word level timestamps", () => {
		const lines = parseLrcLike(
			"[00:01.000]<00:01.000>(和<00:01.500>声)<00:02.000>",
		).lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].isBG).toBe(true);
		expect(lines[0].words.map((word) => word.word)).toEqual(["和", "声"]);
	});

	it("does not treat a background line as a translation", () => {
		// 括号包裹的写法一律按背景人声处理，即使时间戳与上一行相同
		const lines = parseLrcLike("[00:01.000]Hello\n[00:01.000](和声)").lines;

		expect(lines).toHaveLength(2);
		expect(lines[1].isBG).toBe(true);
		expect(lines[1].words[0].word).toBe("和声");
		expect(lines[1].startTime).toBe(1000);
	});

	it.each([
		{
			name: "逐行歌词",
			text: "[00:01.000]Hello\n[00:01.000](和声)\n[00:03.000](和声乙)",
			options: PLAIN_OPTIONS,
		},
		{
			name: "逐字歌词",
			text: "[00:01.000]Hello[00:01.000]\n[00:01.000]<00:01.000>(和<00:01.500>声)<00:02.000>",
			options: ENHANCED_OPTIONS,
		},
	])(
		"writes $name background lines back with their parentheses",
		({ text, options }) => {
			const lines = parseLrcLike(text).lines;

			expect(lines.some((line) => line.isBG)).toBe(true);
			expect(stringifyLrcLike(lines, options)).toBe(text);
		},
	);

	it("parses a line timestamp without the milliseconds part", () => {
		// 省略毫秒段是 LRC 的常见写法，`[mm:ss]` 与 `[mm:ss.ms]` 同样算数
		const lines = parseLrcLike("[00:13]Hello\n[2:01]World").lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(13_000);
		expect(lines[0].words[0].word).toBe("Hello");
		expect(lines[1].startTime).toBe(2 * 60_000 + 1_000);
		expect(lines[1].words[0].word).toBe("World");
	});

	it("keeps the spaces inside a line as they are", () => {
		const lines = parseLrcLike("[00:01.120] Hello \n[00:03.000] World ").lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].words[0].word).toBe(" Hello");
		expect(lines[0].endTime).toBe(3000);
		expect(lines[1].words[0].word).toBe(" World");
	});

	it("keeps a word-by-word line with out-of-order timestamps", () => {
		const lines = parseLrcLike(
			"[00:05.220]你好[00:08.220]椒盐音乐[00:07.220]\n[00:09.000]Next",
		).lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(5220);
		expect(lines[0].endTime).toBe(7220);
		expect(lines[0].words.map((word) => word.word)).toEqual([
			"你好",
			"椒盐音乐",
		]);
		expect(lines[0].words[0].startTime).toBe(5220);
		expect(lines[0].words[0].endTime).toBe(8220);
		expect(lines[0].words[1].startTime).toBe(8220);
		expect(lines[0].words[1].endTime).toBe(7220);
		expect(lines[1].words[0].word).toBe("Next");
	});

	it("accepts a colon between seconds and milliseconds as a compatibility quirk", () => {
		// 超出 SPL 的兼容行为：秒与毫秒间也接受半角冒号
		const lines = parseLrcLike("[00:01:500]Hello").lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1500);
		expect(lines[0].words[0].word).toBe("Hello");
	});

	it("keeps an end timestamp before a word timestamp", () => {
		const lines = parseLrcLike(
			"[00:05.220]你好[00:06.220]椒盐音乐[00:05.000]",
		).lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(5220);
		expect(lines[0].endTime).toBe(5000);
		expect(lines[0].words.map((word) => word.word)).toEqual([
			"你好",
			"椒盐音乐",
		]);
	});

	it("keeps repeated word-by-word lines without expanding them", () => {
		// 逐字歌词不兼容重复行特性，重复时间戳成了首个音节的开始时间，
		// 但乱序时间戳仍按输入顺序保留
		const lines = parseLrcLike(
			"[00:05.220][00:15.220]你好[00:08.220]椒盐音乐[00:09.220]",
		).lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(5220);
		expect(lines[0].endTime).toBe(9220);
		expect(lines[0].words.map((word) => word.word)).toEqual([
			"你好",
			"椒盐音乐",
		]);
		expect(lines[0].words[0].startTime).toBe(15220);
		expect(lines[0].words[0].endTime).toBe(8220);
		expect(lines[0].words[1].startTime).toBe(8220);
		expect(lines[0].words[1].endTime).toBe(9220);
	});

	it("parses a delayed word timestamp where the first word starts after the line", () => {
		const lines = parseLrcLike(
			"[00:05.220]<00:06.220>你好<00:08.220>椒盐音乐[00:09.220]",
		).lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(5220);
		expect(lines[0].endTime).toBe(9220);
		expect(lines[0].words.map((w) => w.word)).toEqual(["你好", "椒盐音乐"]);
		expect(lines[0].words[0].startTime).toBe(6220);
		expect(lines[0].words[0].endTime).toBe(8220);
		expect(lines[0].words[1].startTime).toBe(8220);
		expect(lines[0].words[1].endTime).toBe(9220);
	});

	it("stringifies lines to expected lrc text", () => {
		const result = stringifyLrcLike(
			[
				createLine({
					startTime: 1120,
					endTime: 3000,
					words: [
						createWord({ word: "Hello", startTime: 1120, endTime: 3000 }),
						createWord({ word: " ", startTime: 0, endTime: 0 }),
						createWord({ word: "world!", startTime: 1120, endTime: 3000 }),
					],
				}),
			],
			PLAIN_OPTIONS,
		);

		expect(result).toBe("[00:01.120]Hello world!");
	});

	it("normalizes invalid start time when stringifying", () => {
		const baseLine = {
			endTime: 3000,
			words: [createWord({ word: "Hello" })],
		};

		expect(
			stringifyLrcLike(
				[createLine({ ...baseLine, startTime: -1 })],
				PLAIN_OPTIONS,
			),
		).toBe("[00:00.000]Hello");
		expect(
			stringifyLrcLike(
				[createLine({ ...baseLine, startTime: Number.NaN })],
				PLAIN_OPTIONS,
			),
		).toBe("[00:00.000]Hello");
		expect(
			stringifyLrcLike(
				[createLine({ ...baseLine, startTime: Number.POSITIVE_INFINITY })],
				PLAIN_OPTIONS,
			),
		).toBe("[00:00.000]Hello");
	});

	it("clamps a timestamp beyond the representable maximum", () => {
		const lines = [
			createLine({
				startTime: 1120,
				endTime: MAX_LRC_TIMESTAMP + 40_000,
				words: [createWord({ word: "Hello", startTime: 1120, endTime: -1 })],
			}),
		];

		const text = stringifyLrcLike(lines, {
			mode: "plain",
			endTimestamp: { mode: "always" },
		});

		expect(text).toBe("[00:01.120]Hello\n[999:59.999]");
		expect(parseLrcLike(text).lines[0].endTime).toBe(MAX_LRC_TIMESTAMP);
	});
});

describe("eslrc", () => {
	it("parses basic word-ended-timestamp lines", () => {
		const lines = parseLrcLike(
			"[00:10.82]Test[00:10.97] Word[00:12.62]\n[00:12.62]Next[00:13.20] line[00:14.10]",
		).lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].startTime).toBe(10820);
		expect(lines[0].endTime).toBe(12620);
		expect(lines[0].words[0].word).toBe("Test");
		expect(lines[0].words[0].startTime).toBe(10820);
		expect(lines[0].words[0].endTime).toBe(10970);
		expect(lines[0].words[1].word).toBe(" Word");
		expect(lines[0].words[1].startTime).toBe(10970);
		expect(lines[0].words[1].endTime).toBe(12620);
		expect(lines[1].startTime).toBe(12620);
		expect(lines[1].endTime).toBe(14100);
	});

	it("handles CRLF and degrades lines without a trailing timestamp", () => {
		const lines = parseLrcLike(
			"[00:10.82]Ok[00:11.00]\r\n[00:12.00]Broken no end\r\n[00:13.00]Fine[00:13.50]",
		).lines;

		expect(lines).toHaveLength(3);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("Ok");
		expect(lines[1].words.map((w) => w.word).join("")).toBe("Broken no end");
		expect(lines[1].words).toHaveLength(1);
		expect(lines[1].startTime).toBe(12000);
		expect(lines[2].words.map((w) => w.word).join("")).toBe("Fine");
	});

	it("sorts parsed lines by timestamp", () => {
		const lines = parseLrcLike(
			"[00:20.00]Second[00:21.00]\n[00:10.00]First[00:11.00]",
		).lines;

		expect(lines).toHaveLength(2);
		expect(lines[0].words.map((w) => w.word).join("")).toBe("First");
		expect(lines[1].words.map((w) => w.word).join("")).toBe("Second");
	});

	it("stringifies words with their own end timestamps only", () => {
		const lines = [
			createLine({
				startTime: 10820,
				endTime: 12620,
				words: [
					createWord({ word: "Test", startTime: 10820, endTime: 10970 }),
					createWord({ word: " Word", startTime: 10970, endTime: 12620 }),
				],
			}),
		];

		const result = stringifyLrcLike(lines, ESLYRIC_OPTIONS);

		expect(result).toBe("[00:10.820]Test[00:10.970] Word[00:12.620]");
		expect(parseLrcLike(result).lines).toEqual(lines);
	});

	it("takes the line timestamp from the first word", () => {
		const lines = [
			createLine({
				startTime: 5220,
				endTime: 9220,
				words: [
					createWord({ word: "你好", startTime: 6220, endTime: 8220 }),
					createWord({ word: "椒盐音乐", startTime: 8220, endTime: 9220 }),
				],
			}),
		];

		expect(stringifyLrcLike(lines, ESLYRIC_OPTIONS)).toBe(
			"[00:06.220]你好[00:08.220]椒盐音乐[00:09.220]",
		);
		expect(
			parseLrcLike(stringifyLrcLike(lines, ESLYRIC_OPTIONS)).lines[0].words,
		).toEqual(lines[0].words);
		expect(stringifyLrcLike(lines, ENHANCED_OPTIONS)).toBe(
			"[00:05.220]<00:06.220>你好<00:08.220>椒盐音乐<00:09.220>",
		);
	});
});

describe("lrca2", () => {
	it("parses basic word-timestamped line", () => {
		const lines = parseLrcLike(
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
		).lines;

		expect(lines).toHaveLength(1);
		expect(lines[0].startTime).toBe(1000);
		expect(lines[0].endTime).toBe(2000);
		expect(lines[0].words.map((w) => w.word)).toEqual(["Hello ", "World"]);
		expect(lines[0].words[0].startTime).toBe(1000);
		expect(lines[0].words[0].endTime).toBe(1500);
		expect(lines[0].words[1].startTime).toBe(1500);
		expect(lines[0].words[1].endTime).toBe(2000);
	});

	it("skips lines without any text", () => {
		// LRC 家族无法表达没有文本的歌词行，写出去只会变成上一行的结束标记，因此整行略去
		expect(
			stringifyLrcLike(
				[
					createLine({ startTime: 1000, endTime: 2000 }),
					createLine({
						startTime: 3000,
						endTime: 4000,
						words: [
							createWord({ word: "Hello", startTime: 3000, endTime: 4000 }),
						],
					}),
					createLine({
						startTime: 5000,
						endTime: 6000,
						words: [
							createWord({ word: "   ", startTime: 5000, endTime: 6000 }),
						],
					}),
				],
				ENHANCED_OPTIONS,
			),
		).toBe("[00:03.000]Hello[00:04.000]");
	});

	it("normalizes invalid timestamps when stringifying", () => {
		const result = stringifyLrcLike(
			[
				createLine({
					startTime: Number.NaN,
					endTime: 0,
					words: [
						createWord({
							word: "Hello",
							startTime: -1,
							endTime: Number.POSITIVE_INFINITY,
						}),
					],
				}),
			],
			ENHANCED_OPTIONS,
		);

		expect(result).toBe("[00:00.000]Hello[00:00.000]");
	});
});

describe("spl", () => {
	// SPL 是其余格式的超集，同一份歌词里可以混用 [mm:ss.ms] 与 <mm:ss.ms> 两种逐字标记
	const input =
		"[00:10.82]Test[00:10.97] Word[00:12.62]\n[00:12.62]<00:12.62>Next <00:13.20>line<00:14.10>";

	it("parses both bracket styles and writes them back as angle brackets", () => {
		const result = parseLrcLike(input);

		expect(result.lines).toHaveLength(2);
		expect(
			result.lines.map((line) => line.words.map((w) => w.word).join("")),
		).toEqual(["Test Word", "Next line"]);
		expect(stringifyLrcLike(result, ENHANCED_OPTIONS)).toBe(
			"[00:10.820]<00:10.820>Test<00:10.970> Word<00:12.620>\n[00:12.620]<00:12.620>Next <00:13.200>line<00:14.100>",
		);
	});

	it("writes metadata back when given a parse result", () => {
		const result = parseLrcLike(
			"[ti:标题]\n[00:01.120]<00:01.120>Hello <00:02.120>World<00:03.000>",
		);

		expect(stringifyLrcLike(result, ENHANCED_OPTIONS)).toBe(
			"[ti:标题]\n[00:01.120]<00:01.120>Hello <00:02.120>World<00:03.000>",
		);
	});
});

describe("格式别名", () => {
	const input = "[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>";

	it("parses identically through all four format names", () => {
		const expected = parseLrcLike(input).lines;

		expect(parseLrc(input)).toEqual(expected);
		expect(parseEslrc(input)).toEqual(expected);
		expect(parseLrcA2(input)).toEqual(expected);
		expect(parseSPL(input)).toEqual(expected);
	});

	it("generates with each format's own preset", () => {
		const lines = [
			createLine({
				startTime: 1000,
				endTime: 2000,
				words: [
					createWord({ word: "Hello ", startTime: 1000, endTime: 1500 }),
					createWord({ word: "World", startTime: 1500, endTime: 2000 }),
				],
			}),
		];

		expect(stringifyLrc(lines)).toBe("[00:01.000]Hello World");
		expect(stringifyEslrc(lines)).toBe(
			"[00:01.000]Hello [00:01.500]World[00:02.000]",
		);
		expect(stringifyLrcA2(lines)).toBe(
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
		);
		expect(stringifySPL(lines)).toBe(
			"[00:01.000]<00:01.000>Hello <00:01.500>World<00:02.000>",
		);
	});
});
