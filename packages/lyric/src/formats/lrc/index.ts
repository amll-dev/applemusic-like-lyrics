/**
 * @fileoverview LRC 家族歌词的解析与生成模块
 *
 * 普通 LRC、增强型 LRC（LRC A2）、ESLyric 逐词歌词与 Salt Player Lyrics 语出同源，
 * 因此共用一套解析和生成逻辑，仅针对每种格式进行小的针对性适配
 *
 * @see https://moriafly.com/standards/spl.html
 */
import type { LyricLine, LyricParseResult } from "../../types";
import { LrcGenerator, type StringifyLrcLikeOptions } from "./generator";
import { LrcParser, type ParseLrcLikeOptions } from "./parser";

export type {
	LrcAuxiliaryLineOptions,
	LrcAuxiliaryLinesOptions,
	LrcEndTimestampOptions,
	StringifyLrcLikeOptions,
} from "./generator";
export type { ParseLrcLikeOptions } from "./parser";

/**
 * 解析任意 LRC 家族歌词，包括普通 LRC、增强型 LRC、ESLyric 逐词歌词与 Salt Player Lyrics
 *
 * 因为 Salt Player Lyrics 是其余格式的超集，所以一个接口即可解析全部种类
 *
 * 同一时间可能出现多条歌词行（例如翻译与音译），
 * 本接口不做多语言适配，由使用者自行决定如何使用这些时间相同的歌词行
 *
 * @param text 歌词文本
 * @param options 解析选项
 * @returns 解析出来的歌词与元数据
 */
export function parseLrcLike(
	text: string,
	options?: ParseLrcLikeOptions,
): LyricParseResult {
	return new LrcParser(options).parse(text);
}

/**
 * 生成 LRC 家族歌词
 * @param input 歌词行，或带元数据的解析结果
 * @param options 生成选项
 * @returns 歌词文本
 */
export function stringifyLrcLike(
	input: LyricParseResult | LyricLine[],
	options?: StringifyLrcLikeOptions,
): string {
	return new LrcGenerator(options).generate(input);
}

/**
 * 解析 LyRiC 格式的歌词字符串
 * @param lrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLrc(lrc: string): LyricLine[] {
	return parseLrcLike(lrc).lines;
}

/**
 * 解析 ESLyric 逐词歌词格式的歌词字符串
 * @param eslrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseEslrc(eslrc: string): LyricLine[] {
	return parseLrcLike(eslrc).lines;
}

/**
 * 解析 LRC A2（增强 LRC）格式的歌词字符串
 * @param lrc 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseLrcA2(lrc: string): LyricLine[] {
	return parseLrcLike(lrc).lines;
}

/**
 * 解析 SPL（Salt Player Lyrics）格式的歌词字符串
 *
 * 上述几种格式都语出同源，本接口只是以 SPL 之名调用同一套解析算法
 * @param spl 歌词字符串
 * @returns 成功解析出来的歌词
 */
export function parseSPL(spl: string): LyricLine[] {
	return parseLrcLike(spl).lines;
}

/**
 * 将歌词数组转换为 LyRiC 格式的字符串
 * @param lines 歌词数组
 * @returns LyRiC 格式的字符串
 */
export function stringifyLrc(lines: LyricLine[]): string {
	return stringifyLrcLike(lines, { mode: "plain" });
}

/**
 * 将歌词数组转换为 ESLyric 逐词歌词格式的字符串
 *
 * ESLyric 的逐词语法为「文本后跟该词的结束时间」，行首时间戳即首个词的开始时间，
 * 因此不写行自身的时间戳，行首时间戳直接取首个词的开始时间
 * @param lines 歌词数组
 * @returns ESLyric 逐词歌词格式的字符串
 */
export function stringifyEslrc(lines: LyricLine[]): string {
	return stringifyLrcLike(lines, { mode: "spl", inlineBracket: "square" });
}

/**
 * 将歌词数组转换为 LRC A2（增强 LRC）格式的字符串
 * @param lines 歌词数组
 * @returns LRC A2 格式的字符串
 */
export function stringifyLrcA2(lines: LyricLine[]): string {
	return stringifyLrcLike(lines, { mode: "spl", inlineBracket: "angle" });
}

/**
 * 生成 SPL（Salt Player Lyrics）格式的歌词字符串
 *
 * SPL 与增强型 LRC 的生成行为一致，逐字时间戳同样使用尖括号，
 * 因此本接口与 {@link stringifyLrcA2} 的输出完全相同
 * @param input 歌词行，或带元数据的解析结果
 * @returns SPL 格式的字符串
 */
export function stringifySPL(input: LyricParseResult | LyricLine[]): string {
	return stringifyLrcLike(input, { mode: "spl", inlineBracket: "angle" });
}
