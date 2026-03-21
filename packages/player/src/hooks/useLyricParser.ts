import type { LyricLine as CoreLyricLine } from "@applemusic-like-lyrics/core";
import {
	type LyricLine,
	parseEslrc,
	parseLrc,
	parseLys,
	parseQrc,
	parseTTML,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";
import chalk from "chalk";
import { useMemo } from "react";

const LYRIC_LOG_TAG = chalk.bgHex("#FF4444").hex("#FFFFFF")(" LYRIC ");

type TransLine = {
	[K in keyof CoreLyricLine]: CoreLyricLine[K] extends string ? K : never;
}[keyof CoreLyricLine];

function pairLyric(line: LyricLine, lines: CoreLyricLine[], key: TransLine) {
	if (
		line.words
			.map((v) => v.word)
			.join("")
			.trim().length === 0
	)
		return;
	interface PairedLine {
		startTime: number;
		lineText: string;
		origIndex: number;
		original: CoreLyricLine;
	}
	const processed: PairedLine[] = lines.map((v, i) => ({
		startTime: Math.min(v.startTime, ...v.words.map((v) => v.startTime)),
		origIndex: i,
		lineText: v.words
			.map((v) => v.word)
			.join("")
			.trim(),
		original: v,
	}));
	let nearestLine: PairedLine | undefined;
	for (const coreLine of processed) {
		if (coreLine.lineText.length > 0) {
			if (coreLine.startTime === line.words[0].startTime) {
				nearestLine = coreLine;
				break;
			}
			if (
				nearestLine &&
				Math.abs(nearestLine.startTime - line.words[0].startTime) >
					Math.abs(coreLine.startTime - line.words[0].startTime)
			) {
				nearestLine = coreLine;
			} else if (nearestLine === undefined) {
				nearestLine = coreLine;
			}
		}
	}
	if (nearestLine) {
		const joined = line.words.map((w) => w.word).join("");
		if (nearestLine.original[key].length > 0)
			nearestLine.original[key] += joined;
		else nearestLine.original[key] = joined;
	}
}

interface LyricParserResult {
	lyricLines: LyricLine[];
	hasLyrics: boolean;
}

export const useLyricParser = (
	lyricStr?: string,
	format?: string,
	translatedLrc?: string,
	romanLrc?: string,
): LyricParserResult => {
	return useMemo(() => {
		if (!lyricStr || !format) {
			return { lyricLines: [], hasLyrics: false };
		}

		try {
			let parsedLyricLines: LyricLine[] = [];
			switch (format) {
				case "lrc": {
					parsedLyricLines = parseLrc(lyricStr);
					console.log(LYRIC_LOG_TAG, "解析出 LyRiC 歌词", parsedLyricLines);
					break;
				}
				case "eslrc": {
					parsedLyricLines = parseEslrc(lyricStr);
					console.log(LYRIC_LOG_TAG, "解析出 ESLyRiC 歌词", parsedLyricLines);
					break;
				}
				case "yrc": {
					parsedLyricLines = parseYrc(lyricStr);
					console.log(LYRIC_LOG_TAG, "解析出 YRC 歌词", parsedLyricLines);
					break;
				}
				case "qrc": {
					parsedLyricLines = parseQrc(lyricStr);
					console.log(LYRIC_LOG_TAG, "解析出 QRC 歌词", parsedLyricLines);
					break;
				}
				case "lys": {
					parsedLyricLines = parseLys(lyricStr);
					console.log(
						LYRIC_LOG_TAG,
						"解析出 Lyricify Syllable 歌词",
						parsedLyricLines,
					);
					break;
				}
				case "ttml": {
					parsedLyricLines = parseTTML(lyricStr).lines;
					console.log(LYRIC_LOG_TAG, "解析出 TTML 歌词", parsedLyricLines);
					break;
				}
				default: {
					return { lyricLines: [], hasLyrics: false };
				}
			}

			const compatibleLyricLines: CoreLyricLine[] = parsedLyricLines.map(
				(line) => ({
					...line,
					words: line.words.map((word) => ({
						...word,
						obscene: false,
					})),
				}),
			);

			if (translatedLrc) {
				try {
					const translatedLyricLines = parseLrc(translatedLrc);
					for (const line of translatedLyricLines) {
						pairLyric(
							{
								...line,
								words: line.words.map((word) => ({
									...word,
									obscene: false,
								})),
							},
							compatibleLyricLines,
							"translatedLyric",
						);
					}
					console.log(LYRIC_LOG_TAG, "已匹配翻译歌词");
				} catch (err) {
					console.warn(LYRIC_LOG_TAG, "解析翻译歌词时出现错误", err);
				}
			}

			if (romanLrc) {
				try {
					const romanLyricLines = parseLrc(romanLrc);
					for (const line of romanLyricLines) {
						pairLyric(
							{
								...line,
								words: line.words.map((word) => ({
									...word,
									obscene: false,
								})),
							},
							compatibleLyricLines,
							"romanLyric",
						);
					}
					console.log(LYRIC_LOG_TAG, "已匹配音译歌词");
				} catch (err) {
					console.warn(LYRIC_LOG_TAG, "解析音译歌词时出现错误", err);
				}
			}

			const processedLines: CoreLyricLine[] = compatibleLyricLines;
			return {
				lyricLines: processedLines,
				hasLyrics: processedLines.length > 0,
			};
		} catch (e) {
			console.warn("解析歌词时出现错误", e);
			return { lyricLines: [], hasLyrics: false };
		}
	}, [lyricStr, format, translatedLrc, romanLrc]);
};
