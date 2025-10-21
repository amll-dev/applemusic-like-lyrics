import { FFTPlayer } from "@applemusic-like-lyrics/fft";
import {
	fftDataAtom,
	fftDataRangeAtom,
	isLyricPageOpenedAtom,
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicDurationAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	musicVolumeAtom,
	onChangeVolumeAtom,
	onClickControlThumbAtom,
	onLyricLineClickAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestOpenMenuAtom,
	onRequestPrevSongAtom,
	onSeekPositionAtom,
} from "@applemusic-like-lyrics/react-full";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { type FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useWsLyrics } from "../../../hooks/useWsLyrics.ts";
import {
	enableWsLyricsInSmtcModeAtom,
	MusicContextMode,
	musicContextModeAtom,
} from "../../states/appAtoms.ts";
import {
	MediaType,
	RepeatMode,
	SmtcControls,
	type SmtcControlsType,
	smtcAlbumArtistAtom,
	smtcAlbumTrackCountAtom,
	smtcControlsAtom,
	smtcGenresAtom,
	smtcMediaTypeAtom,
	smtcRepeatModeAtom,
	smtcSessionsAtom,
	smtcShuffleStateAtom,
	smtcTextConversionModeAtom,
	smtcTimeOffsetAtom,
	smtcTrackNumberAtom,
	TextConversionMode,
} from "../../states/smtcAtoms.ts";
import { FFTToLowPassContext } from "../LocalMusicContext/index.tsx";

type SmtcEvent =
	| {
			type: "trackChanged";
			data: {
				title: string | null;
				artist: string | null;
				albumTitle: string | null;
				albumArtist: string | null;
				genres: string[] | null;
				trackNumber: number | null;
				albumTrackCount: number | null;
				mediaType: MediaType | null;
				durationMs: number | null;
				positionMs: number | null;
				isPlaying: boolean | null;
				isShuffleActive: boolean | null;
				repeatMode: RepeatMode | null;
				controls: SmtcControlsType | null;
				coverData: string | null;
				coverDataHash: number | null;
			};
	  }
	| {
			type: "sessionsChanged";
			data: { sessionId: string; displayName: string }[];
	  }
	| { type: "selectedSessionVanished"; data: string }
	| { type: "error"; data: string }
	| { type: "audioData"; data: number[] }
	| { type: "volumeChanged"; data: { volume: number; isMuted: boolean } };

export const SystemListenerMusicContext: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	const setSmtcSessions = useSetAtom(smtcSessionsAtom);
	const musicContextMode = useAtomValue(musicContextModeAtom);
	const isWsLyricsEnabled = useAtomValue(enableWsLyricsInSmtcModeAtom);
	const setIsLyricPageOpened = useSetAtom(isLyricPageOpenedAtom);
	const [timeOffset] = useAtom(smtcTimeOffsetAtom);

	const fftPlayer = useRef<FFTPlayer | undefined>(undefined);
	const fftDataRange = useAtomValue(fftDataRangeAtom);

	useEffect(() => {
		const fft = new FFTPlayer();
		fft.setFreqRange(fftDataRange[0], fftDataRange[1]);
		fftPlayer.current = fft;
		const result = new Float32Array(64);
		let animationFrameId: number;

		const onFFTFrame = () => {
			fftPlayer.current?.read(result);
			store.set(fftDataAtom, [...result]);
			animationFrameId = requestAnimationFrame(onFFTFrame);
		};
		animationFrameId = requestAnimationFrame(onFFTFrame);

		return () => {
			cancelAnimationFrame(animationFrameId);
			fftPlayer.current?.free();
			fftPlayer.current = undefined;
		};
	}, [fftDataRange, store]);

	useWsLyrics(isWsLyricsEnabled);

	useEffect(() => {
		const toEmit = <T,>(onEmit: T) => ({ onEmit });

		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				const isPlaying = store.get(musicPlayingAtom);
				const controls = store.get(smtcControlsAtom);

				if (isPlaying) {
					if (!(controls & SmtcControls.CAN_PAUSE)) {
						toast.info(
							t("amll.systemListener.pauseNotAvailable", "当前应用不支持暂停"),
						);
						return;
					}
				} else {
					if (!(controls & SmtcControls.CAN_PLAY)) {
						toast.info(
							t("amll.systemListener.playNotAvailable", "当前应用不支持播放"),
						);
						return;
					}
				}

				invoke("control_external_media", {
					payload: { type: isPlaying ? "pause" : "play" },
				});
			}),
		);
		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				const controls = store.get(smtcControlsAtom);
				if (!(controls & SmtcControls.CAN_SKIP_NEXT)) {
					toast.info(
						t(
							"amll.systemListener.skipNextNotAvailable",
							"当前应用不支持切换到下一首",
						),
					);
					return;
				}
				invoke("control_external_media", { payload: { type: "skipNext" } });
			}),
		);
		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				const controls = store.get(smtcControlsAtom);
				if (!(controls & SmtcControls.CAN_SKIP_PREVIOUS)) {
					toast.info(
						t(
							"amll.systemListener.skipPreviousNotAvailable",
							"当前应用不支持切换到上一首",
						),
					);
					return;
				}
				invoke("control_external_media", {
					payload: { type: "skipPrevious" },
				});
			}),
		);
		store.set(
			onChangeVolumeAtom,
			toEmit((volume: number) => {
				// TODO: 让smtc-suite传一些诊断信息过来
				invoke("control_external_media", {
					payload: { type: "setVolume", volume },
				});
			}),
		);
		store.set(
			onSeekPositionAtom,
			toEmit((time: number) => {
				const controls = store.get(smtcControlsAtom);
				if (!(controls & SmtcControls.CAN_SEEK)) {
					toast.info(
						t("amll.systemListener.seekNotAvailable", "当前应用不支持跳转进度"),
					);
					return;
				}
				invoke("control_external_media", {
					payload: {
						type: "seekTo",
						time_ms: Math.floor(time),
					},
				});
			}),
		);
		store.set(
			onLyricLineClickAtom,
			toEmit((evt) => {
				const controls = store.get(smtcControlsAtom);
				if (!(controls & SmtcControls.CAN_SEEK)) {
					toast.info(
						t("amll.systemListener.seekNotAvailable", "当前应用不支持跳转进度"),
					);
					return;
				}
				invoke("control_external_media", {
					payload: {
						type: "seekTo",
						time_ms: Math.floor(evt.line.getLine().startTime),
					},
				});
			}),
		);
		store.set(
			onClickControlThumbAtom,
			toEmit(() => {
				setIsLyricPageOpened(false);
			}),
		);

		return () => {
			const doNothing = toEmit(() => {});
			store.set(onPlayOrResumeAtom, doNothing);
			store.set(onRequestNextSongAtom, doNothing);
			store.set(onRequestPrevSongAtom, doNothing);
			store.set(onSeekPositionAtom, doNothing);
			store.set(onLyricLineClickAtom, doNothing);
			store.set(onChangeVolumeAtom, doNothing);
			store.set(onClickControlThumbAtom, doNothing);
			store.set(onRequestOpenMenuAtom, doNothing);
		};
	}, [store, t, setIsLyricPageOpened]);

	useEffect(() => {
		if (musicContextMode !== MusicContextMode.SystemListener) {
			return;
		}

		console.log(`设置偏移量: ${timeOffset}ms`);
		invoke("control_external_media", {
			payload: {
				type: "setProgressOffset",
				offset_ms: timeOffset,
			},
		}).catch((err) => {
			console.warn(`设置时间轴偏移量失败:`, err);
		});
	}, [timeOffset, musicContextMode]);

	useEffect(() => {
		if (musicContextMode !== MusicContextMode.SystemListener) {
			return;
		}

		let unlistenFunction: (() => void) | null = null;

		const setupAsync = async () => {
			try {
				const unlisten = await listen<SmtcEvent>("smtc_update", (event) => {
					const { type, data } = event.payload;
					switch (type) {
						case "trackChanged": {
							const newTrackInfo = data;

							store.set(musicNameAtom, newTrackInfo.title ?? "未知曲目");
							store.set(musicArtistsAtom, [
								{ name: newTrackInfo.artist ?? "未知艺术家", id: "unknown" },
							]);
							store.set(musicAlbumNameAtom, newTrackInfo.albumTitle ?? "");
							store.set(smtcAlbumArtistAtom, newTrackInfo.albumArtist ?? "");
							store.set(smtcGenresAtom, newTrackInfo.genres ?? []);
							store.set(
								smtcTrackNumberAtom,
								newTrackInfo.trackNumber ?? undefined,
							);
							store.set(
								smtcAlbumTrackCountAtom,
								newTrackInfo.albumTrackCount ?? undefined,
							);
							store.set(
								smtcMediaTypeAtom,
								newTrackInfo.mediaType ?? MediaType.Unknown,
							);
							store.set(musicDurationAtom, newTrackInfo.durationMs ?? 0);
							store.set(musicPlayingPositionAtom, newTrackInfo.positionMs ?? 0);
							store.set(musicPlayingAtom, newTrackInfo.isPlaying ?? false);
							store.set(
								smtcShuffleStateAtom,
								newTrackInfo.isShuffleActive ?? false,
							);
							store.set(
								smtcRepeatModeAtom,
								newTrackInfo.repeatMode ?? RepeatMode.Off,
							);
							store.set(smtcControlsAtom, newTrackInfo.controls ?? 0);

							if ("coverData" in newTrackInfo) {
								if (newTrackInfo.coverData) {
									store.set(
										musicCoverAtom,
										`data:image/png;base64,${newTrackInfo.coverData}`,
									);
								}
							}
							break;
						}
						case "volumeChanged": {
							store.set(musicVolumeAtom, data.isMuted ? 0 : data.volume);
							break;
						}
						case "sessionsChanged": {
							setSmtcSessions(data);
							break;
						}
						case "selectedSessionVanished":
							toast.warn(t("amll.systemListener.sessionVanished"));
							store.set(musicPlayingAtom, false);
							setSmtcSessions([]);
							break;
						case "error":
							toast.error(t("amll.systemListener.error", { error: data }));
							break;
						case "audioData": {
							if (fftPlayer.current) {
								fftPlayer.current.pushDataF32(
									48000,
									2,
									new Float32Array(new Uint8Array(data).buffer),
								);
							}
							break;
						}
					}
				});

				unlistenFunction = unlisten;

				await invoke("request_smtc_update");

				const savedSessionId = localStorage.getItem("saved_smtc_session_id");
				if (savedSessionId) {
					console.log(`恢复之前选择的会话: ${savedSessionId}`);
					await invoke("control_external_media", {
						payload: { type: "selectSession", session_id: savedSessionId },
					}).catch((err) => {
						console.warn(`恢复之前选择的会话 ${savedSessionId} 失败:`, err);
					});
				}

				const savedConversionMode = localStorage.getItem(
					"saved_smtc_text_conversion_mode",
				) as TextConversionMode | null;

				if (
					savedConversionMode &&
					savedConversionMode !== TextConversionMode.Off
				) {
					console.log(`恢复之前选择的简繁转换模式: ${savedConversionMode}`);

					store.set(smtcTextConversionModeAtom, savedConversionMode);

					await invoke("control_external_media", {
						payload: { type: "setTextConversion", mode: savedConversionMode },
					}).catch((err) => {
						console.warn(`恢复简繁转换模式 ${savedConversionMode} 失败:`, err);
					});
				}

				const initialOffset = store.get(smtcTimeOffsetAtom);
				if (initialOffset !== 0) {
					console.log(`恢复之前设置的时间轴偏移量: ${initialOffset}ms`);
					await invoke("control_external_media", {
						payload: {
							type: "setProgressOffset",
							offset_ms: initialOffset,
						},
					}).catch((err) => {
						console.warn(`恢复时间轴偏移量失败:`, err);
					});
				}

				await invoke("control_external_media", {
					payload: { type: "startAudioVisualization" },
				});
			} catch (error) {
				console.error("设置监听器或请求初始状态时失败:", error);
				toast.error("无法连接到后台服务。");
			}
		};

		setupAsync();

		return () => {
			if (unlistenFunction) {
				unlistenFunction();
			}

			invoke("control_external_media", {
				payload: { type: "stopAudioVisualization" },
			});

			store.set(musicNameAtom, "");
			store.set(musicArtistsAtom, []);
			store.set(musicAlbumNameAtom, "");
			store.set(musicDurationAtom, 0);
			store.set(musicPlayingPositionAtom, 0);
			store.set(musicPlayingAtom, false);
			store.set(musicCoverAtom, "");
			store.set(musicVolumeAtom, 1);

			store.set(smtcShuffleStateAtom, false);
			store.set(smtcRepeatModeAtom, RepeatMode.Off);
			store.set(smtcControlsAtom, 0);
			store.set(smtcAlbumArtistAtom, "");
			store.set(smtcGenresAtom, []);
			store.set(smtcTrackNumberAtom, undefined);
			store.set(smtcAlbumTrackCountAtom, undefined);
			store.set(smtcMediaTypeAtom, MediaType.Unknown);
			setSmtcSessions([]);
		};
	}, [musicContextMode, store, t, setSmtcSessions]);

	return <FFTToLowPassContext />;
};
