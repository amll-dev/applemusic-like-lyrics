/**
 * @fileoverview LRC 家族用到的内部类型，以及各歌词模式的行为表
 */

/**
 * 元数据表，以 `[键, 值数组]` 的形式存储，键为 LRC 的原始标签名
 */
export type LrcMetadata = [string, string[]][];

/**
 * 歌词模式
 * - `"plain"`: 普通 LRC，不含逐字信息
 * - `"enhanced"`: 增强型 LRC
 * - `"spl"`: Salt Player Lyrics，为前两者的超集
 */
export type LrcMode = "plain" | "enhanced" | "spl";

/**
 * 一种歌词模式在解析与生成时的行为
 */
export interface LrcModeFeatures {
	/**
	 * 是否保留并输出逐字时间戳
	 *
	 * 关闭时解析会把逐字信息并成覆盖整行的单个音节，生成也不写出行内时间戳。
	 * 输出逐字时间戳的模式自带行末时间戳，因此也不需要另起一行输出结束时间
	 */
	wordLevel: boolean;
	/**
	 * 是否允许把辅助行内联进主歌词行
	 *
	 * 只有不写出行内时间戳的模式才有空间容纳圆括号包裹的辅助文本
	 */
	inlineAuxiliary: boolean;
}

/**
 * 各歌词模式的行为，由解析器与生成器共用
 */
export const LRC_MODE_FEATURES: Record<LrcMode, LrcModeFeatures> = {
	plain: { wordLevel: false, inlineAuxiliary: true },
	enhanced: { wordLevel: true, inlineAuxiliary: false },
	spl: { wordLevel: true, inlineAuxiliary: false },
};
