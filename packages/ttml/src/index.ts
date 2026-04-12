export * from "./generator";
export * from "./parser";
export type * from "./types";
export * from "./utils/amll-converter";

import { TTMLGenerator } from "./generator";
import { TTMLParser } from "./parser";
import type { AmllLyricResult, TTMLResult } from "./types";
import { toAmllLyrics, toTTMLResult } from "./utils/amll-converter";

/**
 * 将 TTML 格式的 XML 字符串解析为 {@link AmllLyricResult} 对象的便捷方法
 *
 * 若需要原始的、内容更丰富的 {@link TTMLResult} 结构，建议直接使用 {@link TTMLParser} 类
 *
 * @remarks 默认使用全局的 `DOMParser`，若为 Nodejs 环境，必须使用
 * {@link TTMLParser} 类注入 `DOMParser` 实现，例如 `@xmldom/xmldom`
 * @param ttmlText 符合 TTML 规范的 XML 字符串
 * @returns 解析后的 {@link AmllLyricResult} 对象，包含歌词行列表和元数据
 * @throws 如果没有全局的 `DOMParser`，抛出错误
 */
export function parseTTML(ttmlText: string): AmllLyricResult {
	const result = TTMLParser.parse(ttmlText);
	return toAmllLyrics(result);
}

/**
 * 将 {@link AmllLyricResult} 对象序列化为 TTML 格式的 XML 字符串的便捷方法
 *
 * 若需要自定义生成选项，建议直接使用 {@link TTMLParser} 类
 * @remarks 默认使用全局的 `document.implementation` 和 `XMLSerializer`，若为 Nodejs 环境，
 * 必须使用 {@link TTMLGenerator} 类注入 `domImplementation` 和 `xmlSerializer`，例如 `@xmldom/xmldom`
 * @param ttmlLyric 包含歌词行列表和元数据的 {@link AmllLyricResult} 对象
 * @returns 序列化后的 TTML XML 字符串
 * @throws 如果没有全局的 `DOMImplementation` 和 `XMLSerializer`，抛出错误
 */
export function exportTTML(ttmlLyric: AmllLyricResult): string {
	const result = toTTMLResult(ttmlLyric.lines, ttmlLyric.metadata);
	const generator = new TTMLGenerator();
	return generator.generate(result);
}
