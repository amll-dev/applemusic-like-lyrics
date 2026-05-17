export { stringifyAss } from "./formats/ass";
export { decryptQrcHex, encryptQrcHex } from "./formats/eqrc";
export { parseEslrc, stringifyEslrc } from "./formats/eslrc";
export { parseLqe, stringifyLqe } from "./formats/lqe";
export { parseLrc, stringifyLrc } from "./formats/lrc";
export { parseLrcA2, stringifyLrcA2 } from "./formats/lrca2";
export { parseLyl, stringifyLyl } from "./formats/lyl";
export { parseLys, stringifyLys } from "./formats/lys";
export { parseQrc, stringifyQrc } from "./formats/qrc";
export { parseTTML, stringifyTTML } from "./formats/ttml";
export { parseYrc, stringifyYrc } from "./formats/yrc";

import { stringifyLrcA2 } from "./formats/lrca2";

/**
 * {@link stringifyLrcA2} 的别名。
 *
 * @deprecated 此为兼容旧版本拼写错误的接口，请改用 `stringifyLrcA2`。此接口将在未来版本中移除。
 */
export function stringifylrcA2(
	...args: Parameters<typeof stringifyLrcA2>
): ReturnType<typeof stringifyLrcA2> {
	return stringifyLrcA2(...args);
}

export type { LyricLine, LyricWord, TTMLLyric } from "./types";
