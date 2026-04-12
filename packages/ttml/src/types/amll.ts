/**
 * AMLL 所使用的较简单的数据结构
 * @module amll-types
 */

/**
 * 一个歌词单词
 */
export interface AmllLyricWord extends LyricWordBase {
	/** 单词的音译内容 */
	romanWord?: string;
	/** 单词内容是否包含冒犯性的不雅用语 */
	obscene?: boolean;
	/** 单词的空拍数量，一般只用于方便歌词打轴 */
	emptyBeat?: number;
	/** 单词的注音内容 */
	ruby?: LyricWordBase[];
}

/** 一个歌词单词 */
export interface LyricWordBase {
	/** 单词的起始时间，单位为毫秒 */
	startTime: number;
	/** 单词的结束时间，单位为毫秒 */
	endTime: number;
	/** 单词内容 */
	word: string;
}

/**
 * 一行歌词，存储多个单词
 */
export interface AmllLyricLine {
	/**
	 * 该行的所有单词
	 */
	words: AmllLyricWord[];
	/**
	 * 该行的翻译
	 */
	translatedLyric: string;
	/**
	 * 该行的音译
	 */
	romanLyric: string;
	/**
	 * 该行是否为背景歌词行
	 */
	isBG: boolean;
	/**
	 * 该行是否为对唱歌词行（即歌词行靠右对齐）
	 */
	isDuet: boolean;
	/**
	 * 该行的开始时间
	 *
	 * **并不总是等于第一个单词的开始时间**
	 */
	startTime: number;
	/**
	 * 该行的结束时间
	 *
	 * **并不总是等于最后一个单词的开始时间**
	 */
	endTime: number;
}

/**
 * 一个元数据，以 `[键, 值数组]` 的形式存储
 */
export type AmllMetadata = [string, string[]];

/**
 * 一个 TTML 歌词对象，存储了歌词行信息和 AMLL 元数据信息
 */
export interface AmllLyricResult {
	/**
	 * TTML 中存储的歌词行信息
	 */
	lines: AmllLyricLine[];
	/**
	 * 一个元数据表，以 `[键, 值数组]` 的形式存储
	 */
	metadata: AmllMetadata[];
}

/**
 * 解析器生成的原始 TTML 数据结构转换为 AMLL 的数据结构时的配置选项
 */
export interface TTMLToAmllOptions {
	/**
	 * 提取翻译时的首选目标语言 (如 `"zh-Hans"`)
	 *
	 * 未提供或找不到指定的目标语言代码时提取第一个翻译
	 */
	translationLanguage?: string;
	/**
	 * 提取音译时的首选目标语言 (如 `"ja-Latn"`)
	 *
	 * 未提供或找不到指定的目标语言代码时提取第一个音译
	 */
	romanizationLanguage?: string;
}

/**
 * AMLL 简单的数据结构转换为解析器内部复杂的 TTML 数据结构时的配置选项
 */
export interface AmllToTTMLOptions {
	/**
	 * 翻译的目标语言代码
	 * @default "zh-Hans"
	 */
	translationLanguage?: string;
	/**
	 * 音译的目标语言代码
	 * @default undefined
	 */
	romanizationLanguage?: string;
}
