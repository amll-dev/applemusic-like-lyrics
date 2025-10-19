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
import {
	AudioQualityType,
	currentPlaylistAtom,
	currentPlaylistMusicIndexAtom,
	fftDataAtom,
	fftDataRangeAtom,
	hideLyricViewAtom,
	isLyricPageOpenedAtom,
	lowFreqVolumeAtom,
	type MusicQualityState,
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicCoverIsVideoAtom,
	musicDurationAtom,
	musicIdAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	musicQualityAtom,
	musicQualityTagAtom,
	musicVolumeAtom,
	onChangeVolumeAtom,
	onClickControlThumbAtom,
	onClickLeftFunctionButtonAtom,
	onClickRightFunctionButtonAtom,
	onLyricLineClickAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestOpenMenuAtom,
	onRequestPrevSongAtom,
	onSeekPositionAtom,
} from "@applemusic-like-lyrics/react-full";
import chalk from "chalk";
import { useLiveQuery } from "dexie-react-hooks";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import md5 from "md5";
import { type FC, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { db } from "../../dexie.ts";
import {
	advanceLyricDynamicLyricTimeAtom,
	enableMediaControlsAtom,
} from "../../states/appAtoms.ts";
import {
	type AudioQuality,
	emitAudioThread,
	emitAudioThreadRet,
	initAudioThread,
	listenAudioThreadEvent,
	type SongData,
} from "../../utils/player.ts";

export const FFTToLowPassContext: FC = () => {
	const store = useStore();
	const fftDataRange = useAtomValue(fftDataRangeAtom);
	// const isLyricPageOpened = useAtomValue(isLyricPageOpenedAtom);

	useEffect(() => {
		emitAudioThread("setFFTRange", {
			fromFreq: fftDataRange[0],
			toFreq: fftDataRange[1],
		});
	}, [fftDataRange]);

	useEffect(() => {
		// if (!isLyricPageOpened) return;
		let rafId: number;
		let curValue = 1;
		let lt = 0;

		const gradient: number[] = [];

		function amplitudeToLevel(amplitude: number): number {
			const normalizedAmplitude = amplitude / 255;
			const level = 0.5 * Math.log10(normalizedAmplitude + 1);
			return level;
		}

		function calculateGradient(fftData: number[]): number {
			const window = 10;
			const volume =
				(amplitudeToLevel(fftData[0]) + amplitudeToLevel(fftData[1])) * 0.5;
			if (gradient.length < window && !gradient.includes(volume)) {
				gradient.push(volume);
				return 0;
			}
			gradient.shift();
			gradient.push(volume);

			const maxInInterval = Math.max(...gradient) ** 2;
			const minInInterval = Math.min(...gradient);
			const difference = maxInInterval - minInInterval;
			// console.log(volume, maxInInterval, minInInterval, difference);
			return difference > 0.35 ? maxInInterval : minInInterval * 0.5 ** 2;
		}

		const onFrame = (dt: number) => {
			const fftData = store.get(fftDataAtom);

			const delta = dt - lt;
			const gradient = calculateGradient(fftData);

			const value = gradient;

			const increasing = curValue < value;

			if (increasing) {
				curValue = Math.min(
					value,
					curValue + (value - curValue) * 0.003 * delta,
				);
			} else {
				curValue = Math.max(
					value,
					curValue + (value - curValue) * 0.003 * delta,
				);
			}

			if (Number.isNaN(curValue)) curValue = 1;

			store.set(lowFreqVolumeAtom, curValue);

			lt = dt;
			rafId = requestAnimationFrame(onFrame);
		};
		rafId = requestAnimationFrame(onFrame);
		return () => {
			cancelAnimationFrame(rafId);
		};
	}, [store]);
	// }, [store, isLyricPageOpened]);

	return null;
};

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

const MusicQualityTagText: FC = () => {
	const { t } = useTranslation();
	const musicQuality = useAtomValue<MusicQualityState>(musicQualityAtom);
	const setMusicQualityTag = useSetAtom(musicQualityTagAtom);

	useLayoutEffect(() => {
		switch (musicQuality.type) {
			case AudioQualityType.None:
				return setMusicQualityTag(null);

			case AudioQualityType.Lossless:
				return setMusicQualityTag({
					tagIcon: true,
					tagText: t("amll.qualityTag.lossless", "无损"),
					isDolbyAtmos: false,
				});

			case AudioQualityType.HiResLossless:
				return setMusicQualityTag({
					tagIcon: true,
					tagText: t("amll.qualityTag.hires", "高解析度无损"),
					isDolbyAtmos: false,
				});

			case AudioQualityType.DolbyAtmos:
				return setMusicQualityTag({
					tagIcon: false,
					tagText: "",
					isDolbyAtmos: true,
				});

			default:
				return setMusicQualityTag(null);
		}
	}, [t, musicQuality, setMusicQualityTag]);

	return null;
};
const TTML_LOG_TAG = chalk.bgHex("#FF5577").hex("#FFFFFF")(" TTML DB ");
const LYRIC_LOG_TAG = chalk.bgHex("#FF4444").hex("#FFFFFF")(" LYRIC ");

interface GitHubContent {
	name: string;
	path: string;
	type: "file" | "dir";
	sha: string;
}

const LyricContext: FC = () => {
	const musicId = useAtomValue(musicIdAtom);
	const advanceLyricDynamicLyricTime = useAtomValue(
		advanceLyricDynamicLyricTimeAtom,
	);
	const setLyricLines = useSetAtom(musicLyricLinesAtom);
	const setHideLyricView = useSetAtom(hideLyricViewAtom);
	const song = useLiveQuery(() => db.songs.get(musicId), [musicId]);

	useEffect(() => {
		const sig = new AbortController();

		console.log(TTML_LOG_TAG, "同步 TTML DB 歌词库中");

		(async () => {
			const fileListRes = await fetch(
				"https://api.github.com/repos/Steve-xmh/amll-ttml-db/contents",
				{
					signal: sig.signal,
					redirect: "follow",
				},
			);

			if (fileListRes.status < 200 || fileListRes.status > 399) {
				console.warn(
					TTML_LOG_TAG,
					"TTML DB 歌词库同步失败：获取根目录文件列表失败",
					fileListRes.status,
					fileListRes.statusText,
				);
				return;
			}

			const fileList: GitHubContent[] = await fileListRes.json();
			const rawLyricsEntry = fileList.find(
				(v) => v.name === "raw-lyrics" && v.type === "dir",
			);

			if (!rawLyricsEntry) {
				console.warn(TTML_LOG_TAG, "未找到 raw-lyrics 目录");
				return;
			}
			console.log(
				TTML_LOG_TAG,
				"raw-lyric 目录已找到，SHA 为",
				rawLyricsEntry.sha,
			);

			const lyricFileListRes = await fetch(
				`https://api.github.com/repos/Steve-xmh/amll-ttml-db/git/trees/${rawLyricsEntry.sha}`,
				{
					signal: sig.signal,
					redirect: "follow",
				},
			);

			if (lyricFileListRes.status < 200 || lyricFileListRes.status > 399) {
				console.warn(
					TTML_LOG_TAG,
					"TTML DB 歌词库同步失败：获取 raw-lyrics 文件夹下的文件列表失败",
					lyricFileListRes.status,
					lyricFileListRes.statusText,
				);
				return;
			}

			const lyricFileList: { tree: GitHubContent[] } =
				await lyricFileListRes.json();

			const fileMap = Object.fromEntries(
				lyricFileList.tree.map((v) => [v.path, v]),
			);
			console.log(fileMap);

			const localFileList = new Set<string>();
			const remoteFileList = new Set<string>(
				lyricFileList.tree.map((v) => v.path),
			);

			await db.ttmlDB.each((obj) => {
				localFileList.add(obj.name);
			});

			console.log(TTML_LOG_TAG, "本地已同步歌词数量", localFileList.size);
			console.log(TTML_LOG_TAG, "远程仓库歌词数量", remoteFileList.size);

			const shouldFetchList = remoteFileList.difference(localFileList);

			console.log(
				TTML_LOG_TAG,
				"需要下载的歌词数量",
				shouldFetchList.size,
				shouldFetchList,
			);

			let synced = 0;
			let errored = 0;

			const fetchTasks = [];

			// Safari 目前不支持对迭代器对象使用 map 方法
			for (const fileName of shouldFetchList.keys()) {
				if (!(fileName in fileMap)) continue;
				fetchTasks.push(
					(async () => {
						const lyricRes = await fetch(
							`https://raw.githubusercontent.com/Steve-xmh/amll-ttml-db/main/raw-lyrics/${fileMap[fileName].path}`,
							{
								signal: sig.signal,
								redirect: "follow",
							},
						);

						if (fileListRes.status < 200 || fileListRes.status > 399) {
							console.warn(
								"同步歌词文件",
								fileName,
								"失败",
								fileListRes.status,
								fileListRes.statusText,
							);
							errored++;
							return;
						}

						const lyricContent = await lyricRes.text();

						try {
							const ttml = parseTTML(lyricContent);
							db.ttmlDB.add({
								name: fileName,
								content: ttml,
								raw: lyricContent,
							});
							synced++;
						} catch (err) {
							console.warn("下载并解析歌词文件", fileName, "失败", err);
							errored++;
						}
					})(),
				);
			}

			await Promise.all(fetchTasks);

			console.log(
				TTML_LOG_TAG,
				"歌词同步完成，已同步 ",
				synced,
				" 首歌曲，有 ",
				errored,
				" 首歌词导入失败",
			);
		})();

		return () => {
			sig.abort("useEffect Cleared");
		};
	}, []);

	useEffect(() => {
		if (song) {
			try {
				let parsedLyricLines: LyricLine[] = [];
				switch (song.lyricFormat) {
					case "lrc": {
						parsedLyricLines = parseLrc(song.lyric);
						console.log(LYRIC_LOG_TAG, "解析出 LyRiC 歌词", parsedLyricLines);
						break;
					}
					case "eslrc": {
						parsedLyricLines = parseEslrc(song.lyric);
						console.log(LYRIC_LOG_TAG, "解析出 ESLyRiC 歌词", parsedLyricLines);
						break;
					}
					case "yrc": {
						parsedLyricLines = parseYrc(song.lyric);
						console.log(LYRIC_LOG_TAG, "解析出 YRC 歌词", parsedLyricLines);
						break;
					}
					case "qrc": {
						parsedLyricLines = parseQrc(song.lyric);
						console.log(LYRIC_LOG_TAG, "解析出 QRC 歌词", parsedLyricLines);
						break;
					}
					case "lys": {
						parsedLyricLines = parseLys(song.lyric);
						console.log(
							LYRIC_LOG_TAG,
							"解析出 Lyricify Syllable 歌词",
							parsedLyricLines,
						);
						break;
					}
					case "ttml": {
						parsedLyricLines = parseTTML(song.lyric).lines;
						console.log(LYRIC_LOG_TAG, "解析出 TTML 歌词", parsedLyricLines);
						break;
					}
					default: {
						setLyricLines([]);
						setHideLyricView(true);
						return;
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
				if (song.translatedLrc) {
					try {
						const translatedLyricLines = parseLrc(song.translatedLrc);
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
				if (song.romanLrc) {
					try {
						const romanLyricLines = parseLrc(song.romanLrc);
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
				if (advanceLyricDynamicLyricTime) {
					for (const line of processedLines) {
						line.startTime = Math.max(0, line.startTime - 400);
						line.endTime = Math.max(0, line.endTime - 400);
					}
				}
				setLyricLines(processedLines);
				setHideLyricView(processedLines.length === 0);
			} catch (e) {
				console.warn("解析歌词时出现错误", e);
				setLyricLines([]);
				setHideLyricView(true);
			}
		} else {
			setLyricLines([]);
			setHideLyricView(true);
		}
	}, [song, advanceLyricDynamicLyricTime, setLyricLines, setHideLyricView]);

	return null;
};

export const LocalMusicContext: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	const firstPlay = useRef(true);
	const [musicPlaying, setMusicPlaying] = useAtom(musicPlayingAtom);

	const syncMusicInfo = async (data: any) => {
		if (!data || !data.musicInfo) {
			console.error("[syncMusicInfo] Invalid data, aborting.");
			return;
		}

		const musicId = data.musicId.startsWith("local:")
			? data.musicId.substring(6)
			: data.musicId;

		try {
			store.set(musicIdAtom, musicId);

			const songFromDb = await db.songs.get(musicId);

			if (songFromDb) {
				store.set(musicNameAtom, songFromDb.songName);
				store.set(musicAlbumNameAtom, songFromDb.songAlbum);
				store.set(
					musicArtistsAtom,
					songFromDb.songArtists.split("/").map((v) => ({
						id: v.trim(),
						name: v.trim(),
					})),
				);

				const oldUrl = store.get(musicCoverAtom);
				if (oldUrl?.startsWith("blob:")) {
					URL.revokeObjectURL(oldUrl);
				}
				const imgUrl = URL.createObjectURL(songFromDb.cover);
				store.set(musicCoverAtom, imgUrl);
				store.set(
					musicCoverIsVideoAtom,
					songFromDb.cover.type.startsWith("video"),
				);
			} else {
				store.set(musicNameAtom, data.musicInfo.name);
				store.set(musicAlbumNameAtom, data.musicInfo.album);
				store.set(
					musicArtistsAtom,
					data.musicInfo.artist.split("/").map((v: string) => ({
						id: v.trim(),
						name: v.trim(),
					})),
				);

				const oldUrl = store.get(musicCoverAtom);
				if (oldUrl?.startsWith("blob:")) {
					URL.revokeObjectURL(oldUrl);
				}

				if (data.musicInfo.cover && data.musicInfo.cover.length > 0) {
					const blob = new Blob([new Uint8Array(data.musicInfo.cover)], {
						type: data.musicInfo.coverMediaType || "image/jpeg",
					});
					const url = URL.createObjectURL(blob);
					store.set(musicCoverAtom, url);
					store.set(musicCoverIsVideoAtom, false);
				} else {
					store.set(
						musicCoverAtom,
						"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
					);
					store.set(musicCoverIsVideoAtom, false);
				}
			}
			store.set(musicDurationAtom, (data.duration * 1000) | 0);
		} catch (error) {
			console.error(
				"[syncMusicInfo] An error occurred during state update:",
				error,
			);
		}
	};

	useEffect(() => {
		if (musicPlaying && firstPlay.current) {
			firstPlay.current = false;
			const mediaControlsEnabled = store.get(enableMediaControlsAtom);
			if (mediaControlsEnabled) {
				emitAudioThread("setMediaControlsEnabled", { enabled: true });
			}
		}
	}, [musicPlaying, store]);

	const processAndSetPlaylist = async (playlistData: SongData[]) => {
		if (!playlistData || playlistData.length === 0) {
			store.set(currentPlaylistAtom, []);
			return;
		}

		const fullPlaylistPromises = playlistData.map(
			async (songData): Promise<SongData> => {
				if (songData.type === "local") {
					const songId = md5(songData.filePath);
					const songInfoFromDb = await db.songs.get(songId);

					if (songInfoFromDb) {
						return {
							type: "custom",
							id: songInfoFromDb.id,
							songJsonData: JSON.stringify(songInfoFromDb),
							origOrder: songData.origOrder,
						};
					}
				}
				return songData;
			},
		);

		const fullPlaylist: SongData[] = await Promise.all(fullPlaylistPromises);
		store.set(currentPlaylistAtom, fullPlaylist);
	};

	useEffect(() => {
		initAudioThread();

		const toEmitThread = (type: Parameters<typeof emitAudioThread>[0]) => ({
			onEmit() {
				emitAudioThread(type);
			},
		});
		const toEmit = <T,>(onEmit: T) => ({ onEmit });

		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				emitAudioThread("resumeOrPauseAudio");
			}),
		);

		store.set(onRequestNextSongAtom, toEmitThread("nextSong"));
		store.set(onRequestPrevSongAtom, toEmitThread("prevSong"));
		store.set(
			onClickControlThumbAtom,
			toEmit(() => {
				store.set(isLyricPageOpenedAtom, false);
			}),
		);
		store.set(
			onSeekPositionAtom,
			toEmit((time: number) => {
				emitAudioThread("seekAudio", {
					position: time / 1000,
				});
			}),
		);
		store.set(
			onLyricLineClickAtom,
			toEmit((evt) => {
				emitAudioThread("seekAudio", {
					position: evt.line.getLine().startTime / 1000,
				});
			}),
		);
		store.set(
			onChangeVolumeAtom,
			toEmit((volume: number) => {
				emitAudioThread("setVolume", {
					volume,
				});
			}),
		);
		store.set(
			onRequestOpenMenuAtom,
			toEmit(() => {
				toast.info(
					t("amll.openMenuViaRightClick", "请右键歌词页任意位置来打开菜单哦！"),
				);
			}),
		);
		store.set(
			onClickLeftFunctionButtonAtom,
			toEmit(() => {
				toast.info(
					t("amll.buttonForDisplayOnly", "此按钮仅供展示用途，暂无实际功能"),
				);
			}),
		);
		store.set(
			onClickRightFunctionButtonAtom,
			toEmit(() => {
				toast.info(
					t("amll.buttonForDisplayOnly", "此按钮仅供展示用途，暂无实际功能"),
				);
			}),
		);

		const unlistenPromise = listenAudioThreadEvent(async (evt) => {
			const evtData = evt.payload.data;
			switch (evtData?.type) {
				case "playPosition": {
					store.set(
						musicPlayingPositionAtom,
						(evtData.data.position * 1000) | 0,
					);
					break;
				}

				case "syncStatus": {
					const status = evtData.data;
					setMusicPlaying(status.isPlaying);
					store.set(musicVolumeAtom, status.volume);
					store.set(currentPlaylistMusicIndexAtom, status.currentPlayIndex);

					if (status.quality) {
						const newQualityState = processAudioQuality(status.quality);
						store.set(musicQualityAtom, newQualityState);
					}

					await processAndSetPlaylist(status.playlist);

					const currentMusicId = store.get(musicIdAtom);
					const newMusicId = status.musicId.startsWith("local:")
						? status.musicId.substring(6)
						: status.musicId;
					if (newMusicId && newMusicId !== currentMusicId) {
						await syncMusicInfo(status);
					}

					store.set(musicDurationAtom, (status.duration * 1000) | 0);
					store.set(musicPlayingPositionAtom, (status.position * 1000) | 0);
					break;
				}

				case "loadError": {
					toast.error(
						t("amll.loadAudioError", "播放后端加载音频失败\n{error}", {
							error: evtData.data.error,
						}),
						{},
					);
					break;
				}

				case "volumeChanged": {
					store.set(musicVolumeAtom, evtData.data.volume);
					break;
				}

				case "fftData": {
					store.set(fftDataAtom, evtData.data.data);
					break;
				}
			}
		});
		emitAudioThreadRet("syncStatus");

		return () => {
			unlistenPromise.then((unlisten) => unlisten());

			const doNothing = toEmit(() => {});
			store.set(onRequestNextSongAtom, doNothing);
			store.set(onRequestPrevSongAtom, doNothing);
			store.set(onPlayOrResumeAtom, doNothing);
			store.set(onClickControlThumbAtom, doNothing);
			store.set(onSeekPositionAtom, doNothing);
			store.set(onLyricLineClickAtom, doNothing);
			store.set(onChangeVolumeAtom, doNothing);
			store.set(onRequestOpenMenuAtom, doNothing);
			store.set(onClickLeftFunctionButtonAtom, doNothing);
			store.set(onClickRightFunctionButtonAtom, doNothing);
		};
	}, [store, t]);

	return (
		<>
			<LyricContext />
			<FFTToLowPassContext />
			<MusicQualityTagText />
		</>
	);
};

function processAudioQuality(
	quality: AudioQuality | undefined,
): MusicQualityState {
	const definiteQuality = {
		sampleRate: quality?.sampleRate ?? 0,
		bitsPerCodedSample: quality?.bitsPerCodedSample ?? 0,
		bitsPerSample: quality?.bitsPerSample ?? 0,
		channels: quality?.channels ?? 0,
		sampleFormat: quality?.sampleFormat ?? "unknown",
		codec: quality?.codec ?? "unknown",
	};

	if (definiteQuality.codec === "unknown") {
		return {
			...definiteQuality,
			type: AudioQualityType.None,
		};
	}

	const isLosslessCodec = ["flac", "alac", "ape", "wav", "aiff"].includes(
		definiteQuality.codec.toLowerCase(),
	);

	if (isLosslessCodec) {
		const sampleRate = definiteQuality.sampleRate;
		const bitsPerSample = definiteQuality.bitsPerSample;

		if (sampleRate >= 96000 && bitsPerSample >= 24) {
			return {
				...definiteQuality,
				type: AudioQualityType.HiResLossless,
			};
		}
		return {
			...definiteQuality,
			type: AudioQualityType.Lossless,
		};
	}

	return {
		...definiteQuality,
		type: AudioQualityType.None,
	};
}
