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
	onClickAudioQualityTagAtom,
	onClickControlThumbAtom,
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
import { type FC, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { db } from "../../dexie.ts";
import { useLyricParser } from "../../hooks/useLyricParser.ts";
import {
	audioQualityDialogOpenedAtom,
	enableMediaControlsAtom,
} from "../../states/appAtoms.ts";
import {
	SyncStatus,
	syncLyricsDatabase,
} from "../../utils/lyric-sync-manager.ts";
import {
	type AudioQuality,
	type AudioThreadEvent,
	emitAudioThread,
	initAudioThread,
	listenAudioThreadEvent,
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
const LYRIC_LOG_TAG = chalk.bgHex("#FF4444").hex("#FFFFFF")(" LYRIC ");

const LyricContext: FC = () => {
	const musicId = useAtomValue(musicIdAtom);
	const setLyricLines = useSetAtom(musicLyricLinesAtom);
	const setHideLyricView = useSetAtom(hideLyricViewAtom);
	const song = useLiveQuery(
		() => (musicId ? db.songs.get(musicId) : undefined),
		[musicId],
	);
	const store = useStore();

	useEffect(() => {
		syncLyricsDatabase(store).then((result) => {
			switch (result.status) {
				case SyncStatus.Updated:
					console.log(
						LYRIC_LOG_TAG,
						`歌词库更新完成，新增 ${result.count} 个歌词`,
					);
					break;
				// case SyncStatus.Skipped:
				// 	console.log(LYRIC_LOG_TAG, "歌词库已是最新");
				// 	break;
				// case SyncStatus.Failed:
				// 	console.warn(LYRIC_LOG_TAG, "歌词库同步失败", result.error);
				// 	break;
				// case SyncStatus.Empty:
				// 	console.log(LYRIC_LOG_TAG, "远程歌词库为空");
				// 	break;
			}
		});
	}, []);

	const { lyricLines, hasLyrics } = useLyricParser(
		song?.lyric,
		song?.lyricFormat,
		song?.translatedLrc,
		song?.romanLrc,
	);

	useEffect(() => {
		setLyricLines(lyricLines);
		setHideLyricView(!hasLyrics);
	}, [lyricLines, hasLyrics, setLyricLines, setHideLyricView]);

	return null;
};

export const LocalMusicContext: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	const firstPlay = useRef(true);
	const [musicPlaying, setMusicPlaying] = useAtom(musicPlayingAtom);
	const lastSyncRef = useRef({
		position: 0,
		timestamp: performance.now(),
	});

	const syncMusicInfo = async (
		data: Extract<AudioThreadEvent, { type: "loadAudio" }>["data"],
	) => {
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

				store.set(
					musicCoverAtom,
					"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
				);
				store.set(musicCoverIsVideoAtom, false);
			}
			if (data.musicInfo?.duration) {
				store.set(musicDurationAtom, (data.musicInfo.duration * 1000) | 0);
			} else if (songFromDb?.duration) {
				store.set(musicDurationAtom, (songFromDb.duration * 1000) | 0);
			}
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

	useEffect(() => {
		let rafId: number;

		const updateLoop = () => {
			const isPlaying = store.get(musicPlayingAtom);
			if (isPlaying) {
				const now = performance.now();
				const dt = (now - lastSyncRef.current.timestamp) / 1000;
				const newPos = lastSyncRef.current.position + dt;

				const duration = store.get(musicDurationAtom) / 1000;
				const clampedPos = Math.min(newPos, duration || 0);

				store.set(musicPlayingPositionAtom, (clampedPos * 1000) | 0);
			} else {
				lastSyncRef.current.timestamp = performance.now();
			}
			rafId = requestAnimationFrame(updateLoop);
		};

		rafId = requestAnimationFrame(updateLoop);
		return () => cancelAnimationFrame(rafId);
	}, [store]);

	useEffect(() => {
		initAudioThread();
		const toEmit = <T,>(onEmit: T) => ({ onEmit });

		const playSongAtIndex = (newIndex: number) => {
			const playlist = store.get(currentPlaylistAtom);
			if (!playlist || playlist.length === 0) return;

			let safeIndex = newIndex;
			if (safeIndex >= playlist.length) safeIndex = 0;
			if (safeIndex < 0) safeIndex = playlist.length - 1;

			const targetSong = playlist[safeIndex];

			lastSyncRef.current = {
				position: 0,
				timestamp: performance.now(),
			};
			store.set(musicPlayingPositionAtom, 0);
			store.set(currentPlaylistMusicIndexAtom, safeIndex);

			emitAudioThread("playAudio", { song: targetSong });
		};

		store.set(
			onClickAudioQualityTagAtom,
			toEmit(() => {
				store.set(audioQualityDialogOpenedAtom, true);
			}),
		);

		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				emitAudioThread("resumeOrPauseAudio");
			}),
		);

		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				const currentIndex = store.get(currentPlaylistMusicIndexAtom);
				playSongAtIndex(currentIndex + 1);
			}),
		);

		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				const currentIndex = store.get(currentPlaylistMusicIndexAtom);
				playSongAtIndex(currentIndex - 1);
			}),
		);
		store.set(
			onClickControlThumbAtom,
			toEmit(() => {
				store.set(isLyricPageOpenedAtom, false);
			}),
		);
		store.set(
			onSeekPositionAtom,
			toEmit((time: number) => {
				const targetPos = time / 1000;
				lastSyncRef.current = {
					position: targetPos,
					timestamp: performance.now(),
				};
				store.set(musicPlayingPositionAtom, time);

				emitAudioThread("seekAudio", {
					position: targetPos,
				});
			}),
		);
		store.set(
			onLyricLineClickAtom,
			toEmit((evt) => {
				const targetTimeMs = evt.line.getLine().startTime;
				const targetPos = targetTimeMs / 1000;

				lastSyncRef.current = {
					position: targetPos,
					timestamp: performance.now(),
				};
				store.set(musicPlayingPositionAtom, targetTimeMs);

				emitAudioThread("seekAudio", {
					position: targetPos,
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

		const unlistenPromise = listenAudioThreadEvent(async (evt) => {
			const evtData = evt.payload.data;
			switch (evtData?.type) {
				case "playPosition": {
					const now = performance.now();
					const dt = (now - lastSyncRef.current.timestamp) / 1000;
					const currentExtrapolated = lastSyncRef.current.position + dt;

					if (Math.abs(currentExtrapolated - evtData.data.position) > 0.05) {
						lastSyncRef.current = {
							position: evtData.data.position,
							timestamp: now,
						};
						store.set(
							musicPlayingPositionAtom,
							(evtData.data.position * 1000) | 0,
						);
					}
					break;
				}

				case "loadAudio": {
					const data = evtData.data;

					if (data.quality) {
						store.set(musicQualityAtom, processAudioQuality(data.quality));
					}
					if (data.musicInfo) {
						store.set(musicDurationAtom, (data.musicInfo.duration * 1000) | 0);
					}

					const currentMusicId = store.get(musicIdAtom);
					const newMusicId = data.musicId?.startsWith("local:")
						? data.musicId.substring(6)
						: data.musicId || "";

					if (newMusicId && newMusicId !== currentMusicId) {
						await syncMusicInfo(data);
					}
					break;
				}

				case "playStatus": {
					setMusicPlaying(evtData.data.isPlaying);
					break;
				}

				case "trackEnded": {
					const currentIndex = store.get(currentPlaylistMusicIndexAtom);
					playSongAtIndex(currentIndex + 1);
					break;
				}

				case "hardwareMediaCommand": {
					const currentIndex = store.get(currentPlaylistMusicIndexAtom);
					if (evtData.data.command === "next") {
						playSongAtIndex(currentIndex + 1);
					} else if (evtData.data.command === "prev") {
						playSongAtIndex(currentIndex - 1);
					}
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

		return () => {
			unlistenPromise.then((unlisten) => unlisten());

			const doNothing = toEmit(() => {});
			store.set(onClickAudioQualityTagAtom, doNothing);
			store.set(onRequestNextSongAtom, doNothing);
			store.set(onRequestPrevSongAtom, doNothing);
			store.set(onPlayOrResumeAtom, doNothing);
			store.set(onClickControlThumbAtom, doNothing);
			store.set(onSeekPositionAtom, doNothing);
			store.set(onLyricLineClickAtom, doNothing);
			store.set(onChangeVolumeAtom, doNothing);
			store.set(onRequestOpenMenuAtom, doNothing);
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
