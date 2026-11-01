import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
	parseEslrc,
	parseLqe,
	parseLrc,
	parseLrcA2,
	parseLyl,
	parseLys,
	parseQrc,
	parseTTML,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";

export interface ParsedLyricResult {
	lines: LyricLine[];
	metadata: [string, string[]][];
}

export function getSourceName(source: string, fallbackName = ""): string {
	const rawName = fallbackName || source;
	const withoutHash = rawName.split("#", 1)[0] ?? rawName;
	return (withoutHash.split("?", 1)[0] ?? withoutHash).toLowerCase();
}

export function hasLrcA2Timestamps(content: string): boolean {
	return /<(?:(?:\d+:)*\d+(?:\.\d+)?)>/.test(content);
}

export function buildDemoLyricLine(
	lyric: string,
	startTime = 1000,
	otherParams: Partial<LyricLine> = {},
): LyricLine {
	let currentTime = startTime;
	const words: LyricLine["words"] = [];
	for (const word of lyric.split("|")) {
		const [text = "", duration = "0"] = word.split(",");
		const endTime = currentTime + Number.parseInt(duration, 10);
		words.push({
			word: text,
			romanWord: "",
			startTime: currentTime,
			endTime,
			obscene: false,
		});
		currentTime = endTime;
	}

	return {
		words,
		startTime,
		endTime: currentTime + 3000,
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
		...otherParams,
	};
}

export function extractSongwriters(metadata?: [string, string[]][]): string[] {
	if (!metadata) return [];
	const songwriters: string[] = [];
	for (const [key, values] of metadata) {
		if (key === "songwriters") {
			songwriters.push(...values);
		}
	}
	return songwriters;
}

export function parseLyricContent(
	content: string,
	name = "",
): ParsedLyricResult {
	const sourceName = getSourceName(name, "");

	if (sourceName.endsWith(".ttml")) {
		const result = parseTTML(content);
		return {
			lines: result.lines,
			metadata: result.metadata ?? [],
		};
	}
	if (sourceName.endsWith(".alrc")) {
		return {
			lines: parseLrcA2(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".lrc")) {
		return {
			lines: hasLrcA2Timestamps(content)
				? parseLrcA2(content)
				: parseLrc(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".yrc")) {
		return {
			lines: parseYrc(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".lys")) {
		return {
			lines: parseLys(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".lyl")) {
		return {
			lines: parseLyl(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".lqe")) {
		return {
			lines: parseLqe(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".qrc")) {
		return {
			lines: parseQrc(content),
			metadata: [],
		};
	}
	if (sourceName.endsWith(".eslrc")) {
		return {
			lines: parseEslrc(content),
			metadata: [],
		};
	}

	throw new Error("不支持的歌词格式");
}

export async function parseLyricSource(
	source: string,
	fallbackName = "",
): Promise<ParsedLyricResult> {
	const trimmedSource = source.trim();
	if (!trimmedSource) {
		return {
			lines: [],
			metadata: [],
		};
	}
	if (trimmedSource === "bug") {
		return {
			lines: [
				buildDemoLyricLine(
					"Apple ,750|Music ,500|Like ,500|Ly,400|ri,500|cs ,250",
					1000,
				),
				buildDemoLyricLine("BG ,750|Lyrics ,1000", 2000, { isBG: true }),
				buildDemoLyricLine("Next ,1000|Lyrics,1000", 2500),
			],
			metadata: [["songwriters", ["Apple Music", "AMLL"]]],
		};
	}

	const response = await fetch(trimmedSource);
	if (!response.ok) {
		throw new Error(`歌词加载失败：${response.status} ${response.statusText}`);
	}

	const content = await response.text();
	return parseLyricContent(content, fallbackName || trimmedSource);
}
