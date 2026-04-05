/**
 * 一个歌词单词
 */
export interface LyricWord {
	/** 单词的起始时间 */
	startTime: number;
	/** 单词的结束时间 */
	endTime: number;
	/** 单词 */
	word: string;
	/** 单词的音译 */
	romanWord?: string;
}

/**
 * 一行歌词，存储多个单词
 * 如果是 LyRiC 等只能表达一行歌词的格式，则会将整行当做一个单词存储起来
 */
export interface LyricLine {
	/**
	 * 该行的所有单词
	 * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词
	 */
	words: LyricWord[];
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
	 * 此选项只有作为 Lyricify Syllable 文件格式导入导出时才有意义
	 */
	isBG: boolean;
	/**
	 * 该行是否为对唱歌词行（即歌词行靠右对齐）
	 * 此选项只有作为 Lyricify Syllable 文件格式导入导出时才有意义
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
 * 一个 TTML 歌词行对象，存储了歌词行信息和 AMLL 元数据信息
 */
export interface TTMLLyric {
	/**
	 * TTML 中存储的歌词行信息
	 */
	lines: LyricLine[];
	/**
	 * 一个元数据表，以 `[键, 值数组]` 的形式存储
	 */
	metadata: [string, string[]][];
}
