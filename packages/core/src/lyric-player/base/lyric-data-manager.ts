import structuredClone from "@ungap/structured-clone";
import type { LyricLine, LyricWord, OptimizeLyricOptions } from "#interfaces";
import { optimizeLyricLines } from "#utils/optimize-lyric.ts";
import { MaskObsceneWordsMode } from "./consts.ts";

/**
 * 所有歌词行数据的配置选项，包括歌词行优化和掩码选项
 */
export interface LyricDataConfig {
	optimizeOptions?: OptimizeLyricOptions;
	maskMode?: MaskObsceneWordsMode;
	maskChar?: string;
}

/**
 * 歌词数据管理器
 *
 * 负责：
 * 1. 存储原始歌词、进行深拷贝、应用歌词优化、应用歌词掩码
 * 2. 计算是否为动态歌词 (逐字歌词) 和是否有对唱歌词
 */
export class LyricDataManager {
	/**
	 * 原始的歌词行数组
	 */
	private rawLines: LyricLine[] = [];
	/**
	 * 经过处理后的歌词行数组
	 */
	private processedLines: LyricLine[] = [];

	/**
	 * 当前处理好的 processedLines 是否已经失效
	 */
	private isDirty = true;

	private optimizeOpts: OptimizeLyricOptions = {};
	private maskMode: MaskObsceneWordsMode = MaskObsceneWordsMode.Disabled;
	private maskChar = "*";

	private isNonDynamic = false;
	private hasDuetLine = false;

	public setOriginalLines(lines: LyricLine[]): void {
		this.rawLines = structuredClone(lines);
		this.isDirty = true;
	}

	public setConfig(config: LyricDataConfig): void {
		if (config.optimizeOptions) {
			this.optimizeOpts = { ...this.optimizeOpts, ...config.optimizeOptions };
		}

		this.maskMode = config.maskMode ?? this.maskMode;
		this.maskChar = config.maskChar?.charAt(0) ?? this.maskChar;

		this.isDirty = true;
	}

	/**
	 * 获取用户设置的原始歌词行数组，未经过优化和掩码
	 * @returns 原始歌词行数组
	 */
	public getRawLines(): ReadonlyArray<LyricLine> {
		return this.rawLines;
	}
	/**
	 * 获取对原始歌词行数组处理过的的歌词行数组
	 * @returns 经过处理的歌词行数组
	 */
	public getProcessedLines(): ReadonlyArray<LyricLine> {
		this.ensurePipeline();
		return this.processedLines;
	}
	/**
	 * 歌词是否为非动态歌词，又称为逐行歌词
	 */
	public getIsNonDynamic(): boolean {
		this.ensurePipeline();
		return this.isNonDynamic;
	}
	/**
	 * 歌词是否包含对唱歌词
	 */
	public getHasDuetLine(): boolean {
		this.ensurePipeline();
		return this.hasDuetLine;
	}

	public getOptimizeOptions(): OptimizeLyricOptions {
		return this.optimizeOpts;
	}
	public getMaskMode(): MaskObsceneWordsMode {
		return this.maskMode;
	}
	public getMaskChar(): string {
		return this.maskChar;
	}

	private ensurePipeline(): void {
		if (!this.isDirty) return;
		this.processPipeline();
		this.isDirty = false;
	}

	private processPipeline(): void {
		this.processedLines = structuredClone(this.rawLines);

		optimizeLyricLines(this.processedLines, this.optimizeOpts);

		let checkNonDynamic = true;
		let checkDuet = false;

		for (const line of this.processedLines) {
			if (line.words.length > 1) checkNonDynamic = false;
			if (line.isDuet) checkDuet = true;

			for (const word of line.words) {
				this.applyMask(word);
			}
		}

		this.isNonDynamic = checkNonDynamic && this.processedLines.length > 0;
		this.hasDuetLine = checkDuet;
	}

	private applyMask(word: LyricWord): void {
		if (!word.obscene || this.maskMode === MaskObsceneWordsMode.Disabled) {
			return;
		}

		const text = word.word;
		const maskChar = this.maskChar;

		// 出于以下考虑，我们未替换对应不雅词的 ruby 和逐字音译为掩码：
		// 1. 注音大部分情况下不会直接包含原不雅词，除非逐字音译和音节相同
		// 2. 逐行音译无法对其中的不雅词进行掩码，我们保持一致的行为，即所有注音都不掩码
		//
		// 同时，我们在渲染之前进行了掩码处理，出于以下考虑：
		// 1. 掩码后的字形会发生变化，如果在渲染时才进行掩码，可能会导致视觉宽度和实际渲染宽度错位
		// 2. 如果这个音节被掩码了，那么它就不应该应用掩码前字形的效果，例如 DOM 实现中的强调效果
		if (this.maskMode === MaskObsceneWordsMode.FullMask) {
			word.word = text.replace(/\S/g, maskChar);
		} else if (this.maskMode === MaskObsceneWordsMode.PartialMask) {
			const trimmed = text.trim();
			if (trimmed.length <= 2) {
				word.word = text.replace(/\S/g, maskChar);
			} else {
				const startPos = text.indexOf(trimmed);
				const endPos = startPos + trimmed.length - 1;
				word.word =
					text.slice(0, startPos + 1) +
					text.slice(startPos + 1, endPos).replace(/\S/g, maskChar) +
					text.slice(endPos);
			}
		}
	}
}
