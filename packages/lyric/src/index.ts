export { stringifyAss } from "./formats/ass";
export { decryptQrcHex, encryptQrcHex } from "./formats/eqrc";
export { parseLqe, stringifyLqe } from "./formats/lqe";
export type {
	LrcAuxiliaryLineOptions,
	LrcAuxiliaryLinesOptions,
	LrcEndTimestampOptions,
	ParseLrcLikeOptions,
	StringifyLrcLikeOptions,
} from "./formats/lrc";
export {
	parseEslrc,
	parseLrc,
	parseLrcA2,
	parseLrcLike,
	parseSPL,
	stringifyEslrc,
	stringifyLrc,
	stringifyLrcA2,
	stringifyLrcLike,
	stringifySPL,
} from "./formats/lrc";
export { parseLyl, stringifyLyl } from "./formats/lyl";
export { parseLys, stringifyLys } from "./formats/lys";
export { parseQrc, stringifyQrc } from "./formats/qrc";
export { parseTTML, stringifyTTML } from "./formats/ttml";
export { parseYrc, stringifyYrc } from "./formats/yrc";

import { stringifyLrcA2 } from "./formats/lrc";

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

export type {
	LyricLine,
	LyricParseResult,
	LyricWord,
	TTMLLyric,
} from "./types";
