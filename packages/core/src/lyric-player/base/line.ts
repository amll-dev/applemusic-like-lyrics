import type { Disposable, LyricLine, LyricWord } from "#interfaces";
import { isCJK } from "#utils/is-cjk.ts";
import { Spring } from "#utils/spring.ts";
import { LyricLineRenderMode } from "./consts.ts";

interface LineTransforms {
	scale: Spring;
}

/**
 * 所有标准歌词行的基类
 * @internal
 */
export abstract class LyricLineBase extends EventTarget implements Disposable {
	protected top = 0;
	protected scale = 1;
	protected blur = 0;
	protected opacity = 1;
	protected delay = 0;
	readonly lineTransforms: LineTransforms = {
		scale: new Spring(100),
	};

	/**
	 * 用于 CJK 词语边界检测的分词器
	 */
	static readonly wordSegmenter: Intl.Segmenter | null =
		typeof Intl !== "undefined" && Intl.Segmenter
			? new Intl.Segmenter(undefined, { granularity: "word" })
			: null;

	/**
	 * Unicode 标准的全局 Grapheme Cluster 分词器
	 * 用于正确处理 emoji、复合字符等
	 */
	static readonly graphemeSegmenter: Intl.Segmenter | null =
		typeof Intl !== "undefined" && Intl.Segmenter
			? new Intl.Segmenter(undefined, { granularity: "grapheme" })
			: null;

	abstract getLine(): LyricLine;
	abstract enable(time?: number, shouldPlay?: boolean): void;
	abstract disable(): void;
	abstract resume(): void;
	abstract pause(): void;
	abstract onLineSizeChange(size: [number, number]): void;

	setTransform(
		scale: number = this.scale,
		opacity: number = this.opacity,
		blur: number = this.blur,
		_force = false,
		delay = 0,
		_mode: LyricLineRenderMode = LyricLineRenderMode.SOLID,
	): void {
		this.scale = scale;
		this.opacity = opacity;
		this.blur = blur;
		this.delay = delay;
	}

	rebuildElement(): void {}

	/**
	 * 判定歌词是否可以应用强调辉光效果
	 *
	 * 果子在对辉光效果的解释是一种强调（emphasized）效果
	 *
	 * 条件是一个单词时长大于等于 1s 且长度小于等于 7
	 *
	 * @param word 单词
	 * @returns 是否可以应用强调辉光效果
	 */
	static shouldEmphasize(word: LyricWord): boolean {
		if (isCJK(word.word)) return word.endTime - word.startTime >= 1000;

		return (
			word.endTime - word.startTime >= 1000 &&
			word.word.trim().length <= 7 &&
			word.word.trim().length > 1
		);
	}
	abstract update(delta?: number): void;
	dispose(): void {}
}
