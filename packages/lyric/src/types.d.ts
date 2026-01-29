/**
 * 解析 LyRiC 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLrc(src: string): LyricLine[];

/**
 * 将歌词数组转换为 LyRiC 格式的字符串
 * @param lines 歌词数组
 * @returns LyRiC 格式的字符串
 */
export function stringifyLrc(lines: LyricLine[]): string;

/**
 * 解析 YRC 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseYrc(src: string): LyricLine[];

/**
 * 将歌词数组转换为 YRC 格式的字符串
 * @param lines 歌词数组
 * @returns YRC 格式的字符串
 */
export function stringifyYrc(lines: LyricLine[]): string;

/**
 * 解析 QRC 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseQrc(src: string): LyricLine[];

/**
 * 将歌词数组转换为 QRC 格式的字符串
 * @param lines 歌词数组
 * @returns QRC 格式的字符串
 */
export function stringifyQrc(lines: LyricLine[]): string;

/**
 * 解析 Lyricify Syllable 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLys(src: string): LyricLine[];

/**
 * 将歌词数组转换为 Lyricify Syllable 格式的字符串
 * @param lines 歌词数组
 * @returns Lyricify Syllable 格式的字符串
 */
export function stringifyLys(lines: LyricLine[]): string;

/**
 * 解析 ESLyric 格式的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseEslrc(src: string): LyricLine[];

/**
 * 将歌词数组转换为 ESLyric 格式的字符串
 * @param lines 歌词数组
 * @returns ESLyric 格式的字符串
 */
export function stringifyEslrc(lines: LyricLine[]): string;

/**
 * 将歌词数组转换为 ASS 字幕格式的字符串
 *
 * 注意导出会损失 10 毫秒以内的精度
 *
 * 主唱名称会变为 `v1`，对唱会变为 `v2`
 *
 * 如果是背景歌词则会在名称后面加上后缀 `-bg`
 * @param lines 歌词数组
 * @returns ASS 字幕格式的字符串
 */
export function stringifyAss(lines: LyricLine[]): string;

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
	romanWord: string;
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
	 * 该行的角色信息
	 */
	agent: string;
	/**
	 * 该行的 vocal 标识
	 */
	vocal: string;
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
 * 解密十六进制字符串格式的 Qrc 歌词数据
 * 解密后可去头尾 XML 数据后通过调用 `parseQrc` 解析歌词行
 * @param hexData 十六进制格式的字符串，代表被加密的歌词数据
 * @returns 被解密出来的歌词字符串，是前后有 XML 混合的 QRC 歌词
 */
export function decryptQrcHex(hexData: string): string;

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

/**
 * 解析 TTML 格式（包含 AMLL 特有属性信息）的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的 TTML 歌词对象
 */
export function parseTTML(src: string): TTMLLyric;

/**
 * 将歌词数组转换为 TTML 格式（包含 AMLL 特有属性信息）的歌词字符串
 * @param lyric TTML 歌词对象
 */
export function stringifyTTML(lyric: TTMLLyric): string;
