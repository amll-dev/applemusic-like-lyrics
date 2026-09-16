import type { LyricLine, LyricParseResult } from "../../types";
import { clampTimestamp, type DeepRequired, formatTime } from "../../utils";
import { hasText, isWordSyncLyric, joinWords, normalizeLine } from "./helpers";
import { generateLrcMetadataLines } from "./metadata";
import { LRC_MODE_FEATURES, type LrcMode, type LrcModeFeatures } from "./types";

/**
 * 普通 LRC 显式结束时间戳的输出配置
 *
 * 逐字歌词的结束时间戳由最后一个音节携带，不受此配置影响
 */
export interface LrcEndTimestampOptions {
	/**
	 * 输出策略
	 * - `"none"`: 不输出
	 * - `"always"`: 总是输出
	 * - `"interval"`: 与下一行的间隔不小于 `intervalGap` 时输出
	 * @default "none"
	 */
	mode?: "none" | "always" | "interval";
	/**
	 * 触发间隔，单位毫秒，仅在 `mode` 为 `"interval"` 时有效
	 * @default 5000
	 */
	intervalGap?: number;
}

/**
 * 单种辅助行（翻译、音译或背景人声）的输出配置
 */
export interface LrcAuxiliaryLineOptions {
	/**
	 * 是否输出该辅助行
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * 是否内联到主歌词行，仅在普通 LRC 模式下有效
	 *
	 * translation、romanization 与 backgroundVocal 中最多只有一个可以内联
	 *
	 * 内联时辅助文本会以半角圆括号 `(text)` 包裹
	 */
	inline?: boolean;
}

/**
 * 辅助行的输出配置
 */
export interface LrcAuxiliaryLinesOptions {
	/**
	 * 辅助行的输出顺序
	 * @default "translation-first"
	 */
	order?: "translation-first" | "romanization-first";
	/**
	 * 翻译行设置
	 */
	translation?: LrcAuxiliaryLineOptions;
	/**
	 * 音译行设置
	 */
	romanization?: LrcAuxiliaryLineOptions;
	/**
	 * 背景人声设置
	 */
	backgroundVocal?: LrcAuxiliaryLineOptions;
}

/**
 * 生成 LRC 家族歌词的配置
 */
export interface StringifyLrcLikeOptions {
	/**
	 * 生成模式，详见 {@link LrcMode}
	 * @default "plain"
	 */
	mode?: LrcMode;

	/**
	 * 逐字时间戳的括号类型，仅在 `enhanced` 和 `spl` 模式下有效
	 * - `"angle"`: 使用 `<mm:ss.ms>`
	 * - `"square"`: 使用 `[mm:ss.ms]`
	 * @default "angle"
	 */
	inlineBracket?: "angle" | "square";

	/**
	 * 辅助行（翻译、音译、背景人声）的输出配置
	 */
	auxiliaryLines?: LrcAuxiliaryLinesOptions;

	/**
	 * 普通 LRC 的显式结束时间戳输出配置
	 */
	endTimestamp?: LrcEndTimestampOptions;
}

/**
 * 展开单种辅助行的默认配置
 */
function resolveAuxiliaryLineOptions(
	options: LrcAuxiliaryLineOptions | undefined,
): DeepRequired<LrcAuxiliaryLineOptions> {
	return {
		enabled: options?.enabled ?? true,
		inline: options?.inline ?? false,
	};
}

export class LrcGenerator {
	private options: DeepRequired<StringifyLrcLikeOptions>;
	private features: LrcModeFeatures;

	constructor(options?: StringifyLrcLikeOptions) {
		this.options = {
			mode: options?.mode ?? "plain",
			inlineBracket: options?.inlineBracket ?? "angle",
			auxiliaryLines: {
				order: options?.auxiliaryLines?.order ?? "translation-first",
				translation: resolveAuxiliaryLineOptions(
					options?.auxiliaryLines?.translation,
				),
				romanization: resolveAuxiliaryLineOptions(
					options?.auxiliaryLines?.romanization,
				),
				backgroundVocal: resolveAuxiliaryLineOptions(
					options?.auxiliaryLines?.backgroundVocal,
				),
			},
			endTimestamp: {
				mode: options?.endTimestamp?.mode ?? "none",
				intervalGap: options?.endTimestamp?.intervalGap ?? 5000,
			},
		};
		this.features = LRC_MODE_FEATURES[this.options.mode];
	}

	/**
	 * 行首时间戳是否改用首个音节的开始时间
	 *
	 * 生成方括号时间戳时，按常见实现省略行首时间戳，只在行首写入首个音节的开始时间，
	 * 生成尖括号时则写入行时间戳
	 */
	private get usesFirstWordStartTime(): boolean {
		return this.options.inlineBracket === "square";
	}

	/**
	 * 生成 LRC 家族歌词
	 * @param input 歌词行，或带元数据的解析结果
	 * @returns 歌词文本
	 */
	public generate(input: LyricParseResult | LyricLine[]): string {
		const metadata = Array.isArray(input) ? [] : input.metadata;
		const sourceLines = Array.isArray(input) ? input : input.lines;

		const outputLines: string[] = [];

		const metaLines = generateLrcMetadataLines(metadata);
		if (metaLines.length > 0) {
			outputLines.push(...metaLines);
		}

		// 归一化时间，并略去没有文本的歌词行
		const lines = sourceLines.map(normalizeLine).filter(hasText);
		// 有宿主的背景人声行随主歌词行一起渲染，剩下的仍以括号包裹的独立歌词行写出，
		// 否则解析出来的背景人声行写回去就丢了标记
		const backgroundVocals = new Set<LyricLine>();
		for (const [index, line] of lines.entries()) {
			if (line.isBG) continue;
			const nextLine = lines[index + 1];
			const backgroundVocal = nextLine?.isBG ? nextLine : undefined;
			if (backgroundVocal) backgroundVocals.add(backgroundVocal);
		}

		for (const [index, line] of lines.entries()) {
			if (backgroundVocals.has(line)) continue;
			const nextLine = lines[index + 1];
			const backgroundVocal =
				!line.isBG && nextLine?.isBG ? nextLine : undefined;
			let nextMainLine: LyricLine | undefined;
			for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
				if (!lines[nextIndex].isBG) {
					nextMainLine = lines[nextIndex];
					break;
				}
			}

			this.processSingleLine(line, backgroundVocal, nextMainLine, outputLines);
		}

		return outputLines.join("\n");
	}

	private processSingleLine(
		line: LyricLine,
		backgroundVocal: LyricLine | undefined,
		nextLine: LyricLine | undefined,
		outputLines: string[],
	): void {
		const { auxiliaryLines: auxConfig } = this.options;
		const { inlineAuxiliary } = this.features;

		// 内联仅在能容纳圆括号的模式下有效；三者中最多只有一个可以内联
		const transInline = inlineAuxiliary && auxConfig.translation.inline;
		const romaInline =
			inlineAuxiliary && !transInline && auxConfig.romanization.inline;
		const bgvInline =
			inlineAuxiliary &&
			!transInline &&
			!romaInline &&
			auxConfig.backgroundVocal.inline;

		const lineTimeTag = this.formatTimeTag(line.startTime, "square");

		let transText = auxConfig.translation.enabled ? line.translatedLyric : "";
		let romaText = auxConfig.romanization.enabled ? line.romanLyric : "";
		let bgLine = auxConfig.backgroundVocal.enabled
			? backgroundVocal
			: undefined;

		let mainLineText = joinWords(line.words);

		// 能容纳圆括号的模式可以内联翻译、音译和背景人声
		if (inlineAuxiliary) {
			const applyInline = (text: string) => {
				mainLineText += `${mainLineText ? " " : ""}(${text})`;
			};

			if (transInline && transText) {
				applyInline(transText);
				transText = "";
			} else if (romaInline && romaText) {
				applyInline(romaText);
				romaText = "";
			} else if (bgvInline && bgLine) {
				// 内联背景人声到主歌词里
				mainLineText += `${mainLineText ? " " : ""}(${joinWords(bgLine.words)})`;

				// 背景人声自带的翻译与音译同样使用括号内联到主歌词的翻译与音译里
				if (auxConfig.translation.enabled && bgLine.translatedLyric) {
					transText = transText
						? `${transText} (${bgLine.translatedLyric})`
						: `(${bgLine.translatedLyric})`;
				}
				if (auxConfig.romanization.enabled && bgLine.romanLyric) {
					romaText = romaText
						? `${romaText} (${bgLine.romanLyric})`
						: `(${bgLine.romanLyric})`;
				}

				bgLine = undefined;
			}
		}

		outputLines.push(this.renderBaseItem(line, mainLineText, line.isBG));

		if (bgLine) {
			outputLines.push(
				this.renderBaseItem(bgLine, joinWords(bgLine.words), true),
			);
		}

		const auxTexts =
			auxConfig.order === "translation-first"
				? [transText, romaText]
				: [romaText, transText];

		for (const auxText of auxTexts) {
			if (auxText) outputLines.push(`${lineTimeTag}${auxText}`);
		}

		this.processEndTimestamp(line, nextLine, outputLines);
	}

	/**
	 * 渲染一行歌词，`lineText` 是已经处理过内联的整行文本
	 */
	private renderBaseItem(
		item: LyricLine,
		lineText: string,
		isBgv: boolean,
	): string {
		const { inlineBracket } = this.options;
		const { wordLevel } = this.features;

		if (wordLevel && isWordSyncLyric(item.words, item.startTime)) {
			// 逐字歌词
			const words = item.words;
			// 方括号写法不写行时间戳，行首时间戳直接取首个音节的开始时间
			const leadingTimestamp = this.usesFirstWordStartTime
				? words[0].startTime
				: item.startTime;
			let output = this.formatTimeTag(leadingTimestamp, "square");

			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				// 方括号写法的行首时间戳已经就是首个音节的开始时间，不重复写出
				if (i > 0 || !this.usesFirstWordStartTime) {
					output += this.formatTimeTag(word.startTime, inlineBracket);
				}

				let wordText = word.word;
				if (isBgv) {
					if (i === 0) wordText = `(${wordText}`;
					if (i === words.length - 1) wordText = `${wordText})`;
				}
				output += wordText;

				// 始终给最后一个词添加结束时间戳
				if (i === words.length - 1) {
					output += this.formatTimeTag(word.endTime, inlineBracket);
				}
			}

			return output;
		}

		// 逐行歌词
		// 包含普通 LRC 模式，或增强型 LRC 与 SPL 下没有逐字信息时
		const timeTag = this.formatTimeTag(item.startTime, "square");
		const textToUse = isBgv ? `(${lineText})` : lineText;
		let output = `${timeTag}${textToUse}`;

		// 增强型 LRC 与 SPL 在没有逐字信息时，也要追加显式行结束时间
		if (wordLevel) {
			output += this.formatTimeTag(item.endTime, "square");
		}

		return output;
	}

	private processEndTimestamp(
		line: LyricLine,
		nextLine: LyricLine | undefined,
		outputLines: string[],
	): void {
		const { mode: endTsMode, intervalGap: endTsGap } =
			this.options.endTimestamp;

		// 写出逐字时间戳的模式自带行末时间戳，无需另起一行
		if (this.features.wordLevel || endTsMode === "none") return;

		const gap = nextLine ? nextLine.startTime - line.endTime : Infinity;

		if (
			endTsMode === "always" ||
			(endTsMode === "interval" && gap >= endTsGap)
		) {
			outputLines.push(this.formatTimeTag(line.endTime, "square"));
		}
	}

	/**
	 * 将毫秒渲染为时间戳
	 *
	 * 传入的时间都已由 {@link normalizeLine} 归一化过，这里再钳制到时间戳可表示的最大值，
	 * 保证写出来的时间戳都能被解析回来
	 */
	private formatTimeTag(
		ms: number,
		bracket: "angle" | "square" = "square",
	): string {
		const content = formatTime(clampTimestamp(ms));
		return bracket === "angle" ? `<${content}>` : `[${content}]`;
	}
}
