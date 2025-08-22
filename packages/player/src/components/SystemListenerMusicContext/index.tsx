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
import { useAtomValue, useSetAtom, useStore } from "jotai";
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
	RepeatMode,
	smtcCanPauseAtom,
	smtcCanPlayAtom,
	smtcCanSkipNextAtom,
	smtcCanSkipPreviousAtom,
	smtcRepeatModeAtom,
	smtcSessionsAtom,
	smtcShuffleStateAtom,
	smtcTextConversionModeAtom,
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
				durationMs: number | null;
				positionMs: number | null;
				isPlaying: boolean | null;
				isShuffleActive: boolean | null;
				repeatMode: RepeatMode | null;
				canPlay: boolean | null;
				canPause: boolean | null;
				canSkipNext: boolean | null;
				canSkipPrevious: boolean | null;
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
				invoke("control_external_media", {
					payload: { type: isPlaying ? "pause" : "play" },
				});
			}),
		);
		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				invoke("control_external_media", { payload: { type: "skipNext" } });
			}),
		);
		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				invoke("control_external_media", {
					payload: { type: "skipPrevious" },
				});
			}),
		);
		store.set(
			onChangeVolumeAtom,
			toEmit((volume: number) => {
				invoke("control_external_media", {
					payload: { type: "setVolume", volume },
				});
			}),
		);
		store.set(
			onSeekPositionAtom,
			toEmit((time: number) => {
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
	}, [store, setIsLyricPageOpened]);

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
							store.set(smtcCanPlayAtom, newTrackInfo.canPlay ?? false);
							store.set(smtcCanPauseAtom, newTrackInfo.canPause ?? false);
							store.set(smtcCanSkipNextAtom, newTrackInfo.canSkipNext ?? false);
							store.set(
								smtcCanSkipPreviousAtom,
								newTrackInfo.canSkipPrevious ?? false,
							);

							if (newTrackInfo.coverDataHash != null) {
								if ("coverData" in newTrackInfo) {
									if (newTrackInfo.coverData) {
										store.set(
											musicCoverAtom,
											`data:image/png;base64,${newTrackInfo.coverData}`,
										);
									} else {
										store.set(musicCoverAtom, "");
									}
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
			store.set(smtcCanPlayAtom, false);
			store.set(smtcCanPauseAtom, false);
			store.set(smtcCanSkipNextAtom, false);
			store.set(smtcCanSkipPreviousAtom, false);
			setSmtcSessions([]);
		};
	}, [musicContextMode, store, t, setSmtcSessions]);

	return <FFTToLowPassContext />;
};
