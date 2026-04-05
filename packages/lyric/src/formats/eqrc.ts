import type { LyricLine } from "../types";
import { parseQRC } from "./qrc";

/**
 * wasm 包导出的 EQRC 解密函数签名
 */
interface EqrcWasmModule {
	decryptQrcHex(hexData: string): string;
}

let wasmModulePromise: Promise<EqrcWasmModule> | undefined;

async function getEqrcWasmModule(): Promise<EqrcWasmModule> {
	wasmModulePromise ??= import("../../pkg/amll_lyric.js") as Promise<EqrcWasmModule>;
	return wasmModulePromise;
}

const QRC_LINE_PATTERN = /^\[\d+,\d+\]/m;
const CDATA_PATTERN = /<!\[CDATA\[([\s\S]*?)\]\]>/i;

function decodeXmlEntities(input: string): string {
	return input
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

/**
 * 从解密后的 EQRC XML 中提取纯 QRC 文本内容
 * @param decrypted 解密得到的原始字符串（可能是 XML，也可能已经是纯 QRC）
 * @returns 纯 QRC 文本，提取失败时返回空字符串
 */
export function extractQrcFromEqrcXml(decrypted: string): string {
	if (QRC_LINE_PATTERN.test(decrypted)) return decrypted;

	const cdata = decrypted.match(CDATA_PATTERN)?.[1];
	if (cdata && QRC_LINE_PATTERN.test(cdata)) return cdata.trim();

	const lyricContent = decrypted.match(/LyricContent="([^"]*)"/i)?.[1];
	if (lyricContent) {
		const decoded = decodeXmlEntities(lyricContent);
		if (QRC_LINE_PATTERN.test(decoded)) return decoded.trim();
	}

	return "";
}

/**
 * 解密十六进制格式的 EQRC 数据，返回解密后的原始字符串（XML/QRC 混合）
 * @param hexData EQRC 十六进制字符串
 * @returns 解密后的原始字符串
 */
export async function decryptEqrcHexToXmlAsync(hexData: string): Promise<string> {
	const wasm = await getEqrcWasmModule();
	return wasm.decryptQrcHex(hexData);
}

/**
 * 解密十六进制格式的 EQRC 数据并提取纯 QRC 文本
 * @param hexData EQRC 十六进制字符串
 * @returns 纯 QRC 文本，提取失败时返回空字符串
 */
export async function decryptEqrcHexToQrcAsync(
	hexData: string,
): Promise<string> {
	const decrypted = await decryptEqrcHexToXmlAsync(hexData);
	return extractQrcFromEqrcXml(decrypted);
}

/**
 * 解析十六进制格式的 EQRC 数据
 * @param hexData EQRC 十六进制字符串
 * @returns 成功解析出来的歌词行数组
 */
export async function parseEqrcAsync(hexData: string): Promise<LyricLine[]> {
	const qrc = await decryptEqrcHexToQrcAsync(hexData);
	return qrc ? parseQRC(qrc) : [];
}
