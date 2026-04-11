import {
	parseTTML as parseTTMLPacked,
	exportTTML,
} from "@applemusic-like-lyrics/ttml";
import type { TTMLLyric } from "../types";

/**
 * 解析 TTML 格式（包含 AMLL 特有属性信息）的歌词字符串
 * @param src 歌词字符串
 * @returns 成功解析出来的 TTML 歌词对象
 */
export function parseTTML(ttmlText: string): TTMLLyric {
	const result = parseTTMLPacked(ttmlText);
	return {
		lines: result.lyricLines,
		metadata: result.metadata.map(({ key, value }) => [key, value]),
	};
}

/**
 * 将歌词数组转换为 TTML 格式（包含 AMLL 特有属性信息）的歌词字符串
 * @param lyric TTML 歌词对象
 */
export function stringifyTTML(ttmlLyric: TTMLLyric): string {
	return exportTTML({
		lyricLines: ttmlLyric.lines,
		metadata: ttmlLyric.metadata.map(([key, value]) => ({ key, value })),
	});
}
