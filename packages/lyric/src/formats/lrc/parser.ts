import type { LyricLine, LyricParseResult, LyricWord } from "../../types";
import {
	createLine,
	createWord,
	MAX_LRC_TIMESTAMP,
	parseTimestampParts,
} from "../../utils";
import {
	isBackgroundVocalText,
	isWordSyncLyric,
	joinWords,
	trimBackgroundVocalParentheses,
} from "./helpers";
import { mergeMetadata, parseLrcMetadataLine } from "./metadata";
import { LRC_MODE_FEATURES, type LrcMetadata, type LrcMode } from "./types";

type TokenType = "time" | "text";

interface BaseToken {
	type: TokenType;
}

/**
 * 一个时间戳被解析后的内容，如 `<05:21.22>`
 */
interface TimeToken extends BaseToken {
	type: "time";
	val: number;
}

/**
 * 一段文本被解析后的内容
 */
interface TextToken extends BaseToken {
	type: "text";
	val: string;
}

type Token = TimeToken | TextToken;

interface LineFeature {
	firstTextIndex: number;
	isWordSync: boolean;
	/** 该行是否为背景人声行，即整行文本都被圆括号包裹 */
	isBG: boolean;
	/** 该行所有文本原样拼接的结果，背景人声行保留最外层的圆括号 */
	text: string;
}

/**
 * 解析过程中累积的行状态
 */
interface ParseState {
	/**
	 * 上一（组）主歌词行
	 */
	lastMainLines: LyricLine[];
	/**
	 * 已经出现过的主歌词行，按开始时间索引到其中最早的那一条
	 *
	 * 带时间戳的翻译行不必紧挨着主歌词行，只需时间戳相同且位于其后，
	 * 因此需要这份全局索引而不能只看 `lastMainLines`。
	 * 同一时间已有多条主歌词行时以最早的那条为准——在前的一句才是主歌词文本
	 */
	mainLinesByStartTime: Map<number, LyricLine>;
	/**
	 * 每一行待展开的翻译
	 *
	 * 翻译要等结束时间推导出来之后才能展开成独立歌词行
	 */
	translations: Map<LyricLine, string[]>;
}

export interface ParseLrcLikeOptions {
	/**
	 * 解析模式，详见 {@link LrcMode}
	 * @default "spl"
	 */
	mode?: LrcMode;
}

/**
 * 注释行的行首标记
 *
 * `#` 是 LRC 生态中常见的注释写法，`//` 则是 SPL 标准在示例里标注说明的写法，
 * 两者都没有被写进格式规范，这里一并按整行丢弃处理
 */
const COMMENT_PREFIXES = ["#", "//"];

export class LrcParser {
	private readonly mode: LrcMode;

	/**
	 * 匹配行内所有的逐字时间戳
	 *
	 * 例如 `<05:21.22>` 或 `[05:23.22]`，`[00:13]` 这样省略毫秒段的写法同样算数，省略时视作 `0`。
	 * 秒与毫秒之间本应使用半角句号，这里也接受半角冒号，以兼容不规范的既有歌词文件
	 */
	private static readonly WORD_TIMESTAMP_REGEX =
		/(?:\[|<)(?<min>\d{1,3}):(?<sec>\d{1,2})(?:[:.](?<ms>\d{1,6}))?(?:\]|>)/g;

	constructor(options?: ParseLrcLikeOptions) {
		this.mode = options?.mode ?? "spl";
	}

	/**
	 * 解析 LRC 家族歌词
	 * @param text 歌词文本
	 * @returns 解析结果
	 */
	public parse(text: string): LyricParseResult {
		const metadata: LrcMetadata = [];
		const allParsedLines: LyricLine[] = [];
		const state: ParseState = {
			lastMainLines: [],
			mainLinesByStartTime: new Map(),
			translations: new Map(),
		};

		for (const rawLine of text.split(/\r?\n/)) {
			const trimmedLine = rawLine.trim();
			if (!trimmedLine) continue;

			// 注释行整行丢弃，只有开头为注释标记才丢弃，避免影响行中间带注释标记的歌词
			if (COMMENT_PREFIXES.some((prefix) => trimmedLine.startsWith(prefix))) {
				continue;
			}

			const parsedMeta = parseLrcMetadataLine(trimmedLine);
			if (parsedMeta) {
				mergeMetadata(metadata, parsedMeta);
				continue;
			}

			const tokens = this.tokenizeLine(trimmedLine);

			// 无时间戳的隐式翻译行
			if (tokens.every((t) => t.type === "text")) {
				this.appendTranslation(trimmedLine, [], state);
				continue;
			}

			const features = this.getLineFeatures(tokens);

			// 只有时间戳、没有文本的行标记的是上一（组）歌词行的结束时间，本身不构成歌词行
			if (features.text.trim() === "") {
				this.appendExplicitEndTime(tokens, state.lastMainLines);
				continue;
			}

			const newLines = features.isWordSync
				? this.parseWordSyncLine(tokens, features, state)
				: this.parsePlainLines(tokens, features, state);

			if (newLines.length > 0) {
				this.applyBackgroundVocal(newLines, features.isBG);
				allParsedLines.push(...newLines);
				state.lastMainLines = newLines;
				for (const line of newLines) {
					if (!state.mainLinesByStartTime.has(line.startTime)) {
						state.mainLinesByStartTime.set(line.startTime, line);
					}
				}
			}
		}

		return {
			metadata,
			lines: this.expandTranslations(
				this.finalizeLyricLines(allParsedLines),
				state.translations,
			),
		};
	}

	/**
	 * 语法分析器
	 */
	private tokenizeLine(line: string): Token[] {
		const tokens: Token[] = [];
		let lastIndex = 0;

		for (const match of line.matchAll(LrcParser.WORD_TIMESTAMP_REGEX)) {
			if (!match.groups) continue;

			const matchIndex = match.index ?? 0;
			const textBefore = line.substring(lastIndex, matchIndex);

			// 时间戳前面的文本
			if (textBefore) {
				tokens.push({ type: "text", val: textBefore });
			}

			const time = parseTimestampParts(
				match.groups.min,
				match.groups.sec,
				match.groups.ms,
			);
			tokens.push({ type: "time", val: time });

			lastIndex = matchIndex + match[0].length;
		}

		// 最后一部分隐式结束时间戳的文本
		const textAfter = line.substring(lastIndex);
		if (textAfter) {
			tokens.push({ type: "text", val: textAfter });
		}

		return tokens;
	}

	private getLineFeatures(tokens: Token[]): LineFeature {
		const firstTextIndex = tokens.findIndex((t) => t.type === "text");
		let isWordSync = false;
		// 检查文本后面是否还跟着时间戳以判断是否为逐字歌词
		// 必须要有行首时间戳才能是合法的歌词行
		if (firstTextIndex > 0) {
			for (let i = firstTextIndex + 1; i < tokens.length; i++) {
				if (tokens[i].type === "time") {
					isWordSync = true;
					break;
				}
			}
		}

		const text = tokens
			.filter((t) => t.type === "text")
			.map((t) => t.val)
			.join("");

		return {
			firstTextIndex,
			isWordSync,
			isBG: isBackgroundVocalText(text),
			text,
		};
	}

	/**
	 * 把整行被圆括号包裹的歌词行标记为背景人声，并去掉最外层的括号
	 *
	 * 与 YRC、QRC 的做法一致，只按整行是否被括号包裹判断。
	 * 多个背景人声行各自独立处理，不做归并或配对
	 * @param lines 已解析出来的歌词行
	 * @param isBG 该行是否为背景人声行
	 */
	private applyBackgroundVocal(lines: LyricLine[], isBG: boolean): void {
		if (!isBG) return;
		for (const line of lines) {
			line.isBG = true;
			trimBackgroundVocalParentheses(line.words);
		}
	}

	/**
	 * 尝试将一段文本记录为已出现过的某（组）歌词行的翻译
	 *
	 * 时间信息必须一致才会认为是翻译，否则视为独立的歌词行
	 * @returns 是否成功记录为翻译
	 */
	private appendTranslation(
		text: string,
		baseTimes: number[],
		state: ParseState,
	): boolean {
		if (text.trim() === "") return false;

		// 无时间戳的隐式翻译行只跟随紧挨着的上一（组）全部歌词行
		const targets =
			baseTimes.length === 0
				? state.lastMainLines
				: this.matchLinesByTime(baseTimes, state.mainLinesByStartTime);
		if (!targets || targets.length === 0) return false;

		for (const line of targets) {
			const texts = state.translations.get(line);
			if (texts) {
				texts.push(text);
			} else {
				state.translations.set(line, [text]);
			}
		}
		return true;
	}

	/**
	 * 按时间戳找出与之对应的歌词行
	 *
	 * 翻译行可以不紧挨着主歌词行，所以在全部已出现的主歌词行里按开始时间查找。
	 * 重复行写法的翻译需要每个时间戳都能找到宿主，只要有一个落空就不算翻译
	 * @returns 对应的歌词行，时间信息不一致时为 `null`
	 */
	private matchLinesByTime(
		baseTimes: number[],
		mainLinesByStartTime: Map<number, LyricLine>,
	): LyricLine[] | null {
		const targets: LyricLine[] = [];
		for (const baseTime of baseTimes) {
			const line = mainLinesByStartTime.get(baseTime);
			if (!line) return null;
			targets.push(line);
		}
		return targets;
	}

	/**
	 * 将一行只有时间戳的歌词行作为上一（组）歌词行的显式结束时间
	 *
	 * 与行内写法 `文本[结束时间]` 一致，取该行最后一个时间戳作为结束时间。
	 * 上一（组）歌词行不存在、已经有结束时间，或该时间戳不晚于其开始时间时，整行被忽略
	 *
	 * 重复行写法（`[t1][t2]文本`）会产生多条内容相同的歌词行，
	 * 此时这个结束时间应该归属哪一条存在语义模糊：
	 * 给最早的一条会让组内各行的结束时间不一致，给所有行又会造成时间区间相互重叠，
	 * 格式本身没有说明哪种解读正确。这里选择只标记最后一条（即时间上最近一次出现）的行，
	 * 组内其余行仍交给后续的推导逻辑决定结束时间
	 */
	private appendExplicitEndTime(
		tokens: Token[],
		lastMainLines: LyricLine[],
	): void {
		const lastTimeToken = tokens.findLast(
			(token): token is TimeToken => token.type === "time",
		);
		const lastLine = lastMainLines[lastMainLines.length - 1];
		if (!lastTimeToken || !lastLine) return;

		const endTime = lastTimeToken.val;
		if (lastLine.endTime !== -1 || endTime <= lastLine.startTime) return;

		lastLine.endTime = endTime;
	}

	private parsePlainLines(
		tokens: Token[],
		features: LineFeature,
		state: ParseState,
	): LyricLine[] {
		const baseTimes: number[] = [];
		const endIndex =
			features.firstTextIndex !== -1 ? features.firstTextIndex : tokens.length;

		// 收集文本前面的所有时间戳，按照重复行特性生成多行内容相同的歌词行
		for (let i = 0; i < endIndex; i++) {
			const token = tokens[i];
			if (token.type === "time" && !baseTimes.includes(token.val)) {
				baseTimes.push(token.val);
			}
		}

		if (
			!features.isBG &&
			this.appendTranslation(features.text, baseTimes, state)
		) {
			return [];
		}

		// 逐行歌词只含一个音节，且与歌词同时开始
		return baseTimes.map((baseTime) =>
			createLine({
				startTime: baseTime,
				endTime: -1,
				words: [
					createWord({ word: features.text, startTime: baseTime, endTime: -1 }),
				],
			}),
		);
	}

	private parseWordSyncLine(
		tokens: Token[],
		features: LineFeature,
		state: ParseState,
	): LyricLine[] {
		const firstToken = tokens[0];
		// 延迟逐字标记时间的 token
		const delayToken = tokens[features.firstTextIndex - 1];

		if (firstToken?.type !== "time" || delayToken?.type !== "time") {
			return [];
		}

		// 行起始时间是第一个 Token
		const baseTime = firstToken.val;

		if (
			!features.isBG &&
			this.appendTranslation(features.text, [baseTime], state)
		) {
			return [];
		}

		// 首个音节发音时间：紧挨着文本前面的最后一个时间戳
		// 因为逐字歌词不能很好地处理重复行特性 所以忽略掉之间的、可能为重复行特性的时间戳
		const syllableStartTimeInitial = delayToken.val;
		let explicitEnd: number | undefined;
		const syllables: LyricWord[] = [];

		let currentText = "";
		let syllableStartTime = syllableStartTimeInitial;

		const pushSyllable = (text: string, start: number, end: number) => {
			syllables.push(
				createWord({ word: text, startTime: start, endTime: end }),
			);
		};

		for (let i = features.firstTextIndex; i < tokens.length; i++) {
			const tok = tokens[i];
			if (tok.type === "text") {
				currentText += tok.val;
			} else if (tok.type === "time") {
				const nextTime = tok.val;

				if (currentText !== "") {
					pushSyllable(currentText, syllableStartTime, nextTime);
					currentText = "";
				}
				syllableStartTime = nextTime;

				if (i === tokens.length - 1) {
					explicitEnd = nextTime;
				}
			}
		}

		// 行尾的剩余文本 即隐式结束时间戳
		if (currentText !== "") {
			pushSyllable(
				currentText,
				syllableStartTime,
				-1, // 下面处理隐式时间戳的时候处理
			);
		}

		// 逐字音节只有在值得保留时才留下，否则这一行与逐行歌词无异
		return [
			createLine({
				startTime: baseTime,
				endTime: explicitEnd ?? -1,
				words: isWordSyncLyric(syllables, baseTime)
					? syllables
					: [
							createWord({
								word: features.text,
								startTime: baseTime,
								endTime: -1,
							}),
						],
			}),
		];
	}

	private finalizeLyricLines(allParsedLines: LyricLine[]): LyricLine[] {
		// 因为展开了重复行，因此需要按时间戳重新排序
		allParsedLines.sort((a, b) => a.startTime - b.startTime);

		this.resolveEndTimes(allParsedLines);

		// 不保留逐字信息的模式下删除逐字时间戳
		if (!LRC_MODE_FEATURES[this.mode].wordLevel) {
			this.stripWordTimings(allParsedLines);
		}

		return allParsedLines;
	}

	/**
	 * 决定所有尚未推导的时间，逐行歌词取下一行的开始时间，逐字歌词还会收尾最后一个音节
	 */
	private resolveEndTimes(allParsedLines: LyricLine[]): void {
		for (let i = 0; i < allParsedLines.length; i++) {
			const line = allParsedLines[i];
			const isLastLine = i === allParsedLines.length - 1;

			// 如果是逐行歌词，给最后一行设置 LRC 时间戳可表示的最大结束时间
			if (line.endTime === -1) {
				if (isLastLine && !isWordSyncLyric(line.words, line.startTime)) {
					line.endTime = MAX_LRC_TIMESTAMP;
				} else if (!isLastLine) {
					line.endTime = allParsedLines[i + 1].startTime;
				}
			}

			// 如果是逐字歌词，给最后一个词的结束时间加上1秒
			const words = line.words;
			if (words.length > 0) {
				for (let j = 0; j < words.length; j++) {
					const word = words[j];
					if (word.endTime !== -1) continue;
					if (j + 1 < words.length) {
						word.endTime = words[j + 1].startTime;
					} else if (isLastLine && line.endTime === -1) {
						word.endTime = word.startTime + 1000;
						line.endTime = word.endTime;
					} else {
						word.endTime = line.endTime;
					}
				}
			}
		}
	}

	/**
	 * 普通 LRC 模式丢弃逐字时间戳，只留下覆盖整行的单个音节
	 */
	private stripWordTimings(allParsedLines: LyricLine[]): void {
		for (const line of allParsedLines) {
			if (line.words.length <= 1) continue;
			line.words = [
				createWord({
					word: joinWords(line.words),
					startTime: line.startTime,
					endTime: line.endTime,
				}),
			];
		}
	}

	/**
	 * 将翻译展开成与主歌词行同时开始、同时结束的独立歌词行
	 */
	private expandTranslations(
		lines: LyricLine[],
		translations: Map<LyricLine, string[]>,
	): LyricLine[] {
		if (translations.size === 0) return lines;

		const result: LyricLine[] = [];
		for (const line of lines) {
			result.push(line);
			for (const text of translations.get(line) ?? []) {
				result.push(
					createLine({
						startTime: line.startTime,
						endTime: line.endTime,
						words: [
							createWord({
								word: text,
								startTime: line.startTime,
								endTime: line.endTime,
							}),
						],
					}),
				);
			}
		}
		return result;
	}
}
