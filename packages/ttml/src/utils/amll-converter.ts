/**
 * 包含解析器内部的复杂数据结构和 AMLL 简单的数据结构的互转功能的模块
 * @module amll-converter
 */

import { Elements, Values } from "../constants";
import type {
	AmllLyricLine,
	AmllLyricResult,
	AmllLyricWord,
	AmllMetadata,
	AmllToTTMLOptions,
	LyricBase,
	LyricLine,
	Syllable,
	TTMLMetadata,
	TTMLResult,
	TTMLToAmllOptions,
} from "../types";

/**
 * 将本解析器复杂的数据结构降级为 AMLL 所使用的较简单的数据结构
 */
export function toAmllLyrics(
	result: TTMLResult,
	options?: TTMLToAmllOptions,
): AmllLyricResult {
	const amllLines: AmllLyricLine[] = [];

	const convertToAmllLine = (
		source: LyricBase,
		isBG: boolean,
		isDuet: boolean,
	): AmllLyricLine => {
		let amllWords: AmllLyricWord[] = [];

		if (source.words && source.words.length > 0) {
			amllWords = source.words.map((w) => {
				const amllWord: AmllLyricWord = {
					startTime: w.startTime,
					endTime: w.endTime,
					word: w.text + (w.endsWithSpace ? " " : ""),
					romanWord: "",
					obscene: w.obscene,
					emptyBeat: w.emptyBeat,
				};

				if (w.ruby && w.ruby.length > 0) {
					amllWord.ruby = w.ruby.map((r) => ({
						startTime: r.startTime,
						endTime: r.endTime,
						word: r.text,
					}));
				}

				return amllWord;
			});
		} else {
			amllWords = [
				{
					startTime: source.startTime,
					endTime: source.endTime,
					word: source.text,
					romanWord: "",
				},
			];
		}

		let transText = "";
		if (source.translations && source.translations.length > 0) {
			const targetTrans =
				(options?.translationLanguage &&
					source.translations.find(
						(t) => t.language === options.translationLanguage,
					)) ||
				source.translations[0];
			transText = targetTrans.text;
		}

		let romanText = "";
		let romanWords: Syllable[] | undefined;
		if (source.romanizations && source.romanizations.length > 0) {
			const targetRoman =
				(options?.romanizationLanguage &&
					source.romanizations.find(
						(r) => r.language === options.romanizationLanguage,
					)) ||
				source.romanizations[0];

			romanWords = targetRoman.words;

			if (!romanWords || romanWords.length === 0) {
				romanText = targetRoman.text;
			}
		}

		if (romanWords && amllWords.length > 0) {
			alignRomanization(amllWords, romanWords);
		}

		return {
			words: amllWords,
			translatedLyric: transText,
			romanLyric: romanText,
			isBG: isBG,
			isDuet: isDuet,
			startTime: source.startTime,
			endTime: source.endTime,
		};
	};

	let lastPersonAgentId: string | null = null;
	let lastPersonIsDuet: boolean = false;

	for (const line of result.lines) {
		const agentId = line.agentId || Values.AgentDefault;
		const agent = result.metadata.agents?.[agentId];
		const isGroup = agent?.type === Values.Group;
		const isOther = agent?.type === Values.Other;

		let currentIsDuet = false;

		// Apple Music 风格的对唱识别逻辑
		if (isGroup) {
			// 合唱始终非对唱，且不影响其他 agent type 的交替计算
			currentIsDuet = false;
		} else {
			if (lastPersonAgentId === null) {
				// 如果第一次遇到的演唱者类型是 Other，强制为对唱，否则非对唱
				currentIsDuet = !!isOther;
				lastPersonAgentId = agentId;
				lastPersonIsDuet = currentIsDuet;
			} else if (lastPersonAgentId === agentId) {
				// 与上一个非 Group 演唱者相同，保持对唱状态
				currentIsDuet = lastPersonIsDuet;
			} else {
				// 与上一个非 Group 演唱者不同，翻转对唱侧
				currentIsDuet = !lastPersonIsDuet;
				lastPersonAgentId = agentId;
				lastPersonIsDuet = currentIsDuet;
			}
		}

		const amllMain = convertToAmllLine(line, false, currentIsDuet);
		amllLines.push(amllMain);

		if (line.backgroundVocal) {
			const simpleBg = convertToAmllLine(
				line.backgroundVocal,
				true,
				currentIsDuet,
			);
			amllLines.push(simpleBg);
		}
	}

	const amllMetadata: [string, string[]][] = [];
	const meta = result.metadata;

	if (meta.title) amllMetadata.push([Values.MusicName, meta.title]);
	if (meta.artist) amllMetadata.push([Values.Artists, meta.artist]);
	if (meta.album) amllMetadata.push([Values.Album, meta.album]);
	if (meta.isrc) amllMetadata.push([Values.ISRC, meta.isrc]);
	if (meta.authorIds)
		amllMetadata.push([Values.TTMLAuthorGithub, meta.authorIds]);
	if (meta.authorNames)
		amllMetadata.push([Values.TTMLAuthorGithubLogin, meta.authorNames]);

	if (meta.language) amllMetadata.push([Values.Language, [meta.language]]);
	if (meta.timingMode)
		amllMetadata.push([Values.TimingMode, [meta.timingMode]]);
	if (meta.songwriters)
		amllMetadata.push([Elements.Songwriters, meta.songwriters]);

	if (meta.platformIds) {
		if (meta.platformIds.ncmMusicId)
			amllMetadata.push([Values.NCMMusicId, meta.platformIds.ncmMusicId]);
		if (meta.platformIds.qqMusicId)
			amllMetadata.push([Values.QQMusicId, meta.platformIds.qqMusicId]);
		if (meta.platformIds.spotifyId)
			amllMetadata.push([Values.SpotifyId, meta.platformIds.spotifyId]);
		if (meta.platformIds.appleMusicId)
			amllMetadata.push([Values.AppleMusicId, meta.platformIds.appleMusicId]);
	}

	if (meta.rawProperties) {
		for (const [key, value] of Object.entries(meta.rawProperties)) {
			amllMetadata.push([key, value]);
		}
	}

	return {
		lines: amllLines,
		metadata: amllMetadata,
	};
}

function alignRomanization(amllWords: AmllLyricWord[], romanWords: Syllable[]) {
	let romanSearchStartIndex = 0;

	/** 交并比阈值，至少有 10% 的面积重合 */
	const MIN_IOU_THRESHOLD = 0.1;

	/** 快速通道，优先匹配时间戳完全相同的主歌词和音译音节，同时避免浮点数误差 */
	const FAST_TRACK_TOLERANCE_MS = 2;

	for (let i = 0; i < amllWords.length; i++) {
		const main = amllWords[i];
		const mainEndTime = main.endTime;

		let maxIou = 0;
		let bestMatchIndex = -1;
		let isFastTrackMatched = false;

		let j = romanSearchStartIndex;
		while (j < romanWords.length) {
			const sub = romanWords[j];

			if (Math.abs(main.startTime - sub.startTime) <= FAST_TRACK_TOLERANCE_MS) {
				main.romanWord = sub.text;
				romanSearchStartIndex = j + 1;
				isFastTrackMatched = true;
				break;
			}

			const subEndTime = sub.endTime;

			// 交集
			const overlapStart = Math.max(main.startTime, sub.startTime);
			const overlapEnd = Math.min(mainEndTime, subEndTime);
			const intersection = Math.max(0, overlapEnd - overlapStart);

			if (intersection > 0) {
				// 并集
				const unionStart = Math.min(main.startTime, sub.startTime);
				const unionEnd = Math.max(mainEndTime, subEndTime);
				const unionDuration = Math.max(1, unionEnd - unionStart);

				const iou = intersection / unionDuration;

				if (iou > maxIou) {
					maxIou = iou;
					bestMatchIndex = j;
				}
			}

			if (sub.startTime >= mainEndTime) {
				break;
			}
			j++;
		}

		if (
			!isFastTrackMatched &&
			bestMatchIndex !== -1 &&
			maxIou >= MIN_IOU_THRESHOLD
		) {
			main.romanWord = romanWords[bestMatchIndex].text;
			romanSearchStartIndex = bestMatchIndex + 1;
		}
	}
}

/**
 * 将 AMLL 格式的歌词和元数据转换为 TTMLResult 结构
 */
export function toTTMLResult(
	amllLines: AmllLyricLine[],
	amllMetadata: AmllMetadata[],
	options: AmllToTTMLOptions = {},
): TTMLResult {
	const opts = {
		translationLanguage: "zh-Hans",
		...options,
	};

	const metadata: TTMLMetadata = {
		agents: {
			[Values.AgentDefault]: { id: Values.AgentDefault },
			[Values.AgentDefaultDuet]: { id: Values.AgentDefaultDuet },
		},
	};

	for (const entry of amllMetadata) {
		const [key, value] = entry;
		if (!value || value.length === 0) continue;

		switch (key) {
			case Values.MusicName:
				metadata.title = value;
				break;
			case Values.Artists:
				metadata.artist = value;
				break;
			case Values.Album:
				metadata.album = value;
				break;
			case Values.ISRC:
				metadata.isrc = value;
				break;
			case Values.TTMLAuthorGithub:
				metadata.authorIds = value;
				break;
			case Values.TTMLAuthorGithubLogin:
				metadata.authorNames = value;
				break;
			case Values.NCMMusicId:
			case Values.QQMusicId:
			case Values.SpotifyId:
			case Values.AppleMusicId:
				if (!metadata.platformIds) {
					metadata.platformIds = {};
				}
				metadata.platformIds[key] = value;
				break;
			default:
				if (!metadata.rawProperties) {
					metadata.rawProperties = {};
				}
				metadata.rawProperties[key] = value;
				break;
		}
	}

	const resultLines: LyricLine[] = [];
	let currentMainLine: LyricLine | null = null;

	for (const amllLine of amllLines) {
		const { mainSyllables, romanSyllables, fullText, romanText } =
			convertWords(amllLine);

		const lyricBase: LyricBase = {
			startTime: amllLine.startTime,
			endTime: amllLine.endTime,
			text: fullText,
			words: mainSyllables,
		};

		if (amllLine.translatedLyric) {
			lyricBase.translations = [
				{
					language: opts.translationLanguage,
					text: amllLine.translatedLyric,
				},
			];
		}

		if (amllLine.romanLyric || romanSyllables.length > 0) {
			lyricBase.romanizations = [
				{
					language: opts.romanizationLanguage,
					text: amllLine.romanLyric || romanText,
					words: romanSyllables.length > 0 ? romanSyllables : undefined,
				},
			];
		}

		if (amllLine.isBG) {
			if (currentMainLine && !currentMainLine.backgroundVocal) {
				currentMainLine.backgroundVocal = lyricBase;
			} else {
				const inheritedAgentId = currentMainLine
					? currentMainLine.agentId
					: Values.AgentDefault;

				const promotedLine: LyricLine = {
					agentId: inheritedAgentId,
					...lyricBase,
				};
				resultLines.push(promotedLine);
			}
		} else {
			const agentId = amllLine.isDuet
				? Values.AgentDefaultDuet
				: Values.AgentDefault;

			const lyricLine: LyricLine = {
				agentId,
				...lyricBase,
			};

			resultLines.push(lyricLine);
			currentMainLine = lyricLine;
		}
	}

	return {
		metadata: metadata,
		lines: resultLines,
	};
}

function convertWords(amllLine: AmllLyricLine) {
	const mainSyllables: Syllable[] = [];
	const romanSyllables: Syllable[] = [];

	for (const word of amllLine.words) {
		const rawText = word.word;
		const trimmedText = rawText.trimEnd();
		const hasSpace = rawText !== trimmedText;

		const syllable: Syllable = {
			text: trimmedText,
			startTime: word.startTime,
			endTime: word.endTime,
			endsWithSpace: hasSpace,
			obscene: word.obscene,
			emptyBeat: word.emptyBeat,
		};

		if (word.ruby && word.ruby.length > 0) {
			syllable.ruby = word.ruby.map((r) => ({
				startTime: r.startTime,
				endTime: r.endTime,
				text: r.word,
			}));
		}

		mainSyllables.push(syllable);

		if (word.romanWord) {
			romanSyllables.push({
				text: word.romanWord.trim(), // AMLL 那边的实现已经总是 trim 各个逐字音译音节了
				startTime: word.startTime,
				endTime: word.endTime,
			});
		}
	}

	const fullText = amllLine.words.map((w) => w.word).join("");

	const romanText =
		romanSyllables.length > 0
			? romanSyllables
					.map((s) => s.text + (s.endsWithSpace ? " " : ""))
					.join("")
			: "";

	return { mainSyllables, romanSyllables, fullText, romanText };
}
