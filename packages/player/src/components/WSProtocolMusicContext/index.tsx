import { FFTPlayer } from "@applemusic-like-lyrics/fft";
import { parseTTML } from "@applemusic-like-lyrics/lyric";
import {
	fftDataAtom,
	hideLyricViewAtom,
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicDurationAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	onChangeVolumeAtom,
	onLyricLineClickAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestPrevSongAtom,
	onSeekPositionAtom,
} from "@applemusic-like-lyrics/react-full";
import { invoke } from "@tauri-apps/api/core";
import { type Event, listen } from "@tauri-apps/api/event";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { type FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	fftDataRangeAtom,
	musicIdAtom,
	wsProtocolConnectedAddrsAtom,
	wsProtocolListenAddrAtom,
} from "../../states/index.ts";
import { emitAudioThread } from "../../utils/player.ts";
import { FFTToLowPassContext } from "../LocalMusicContext/index.tsx";

export const WSProtocolMusicContext: FC = () => {
	const wsProtocolListenAddr = useAtomValue(wsProtocolListenAddrAtom);
	const setConnectedAddrs = useSetAtom(wsProtocolConnectedAddrsAtom);
	const store = useStore();
	const { t } = useTranslation();
	const fftPlayer = useRef<FFTPlayer>();

	useEffect(() => {
		emitAudioThread("pauseAudio");
	}, []);

	const fftDataRange = useAtomValue(fftDataRangeAtom);

	useEffect(() => {
		let canceled = false;
		const fft = new FFTPlayer();
		fft.setFreqRange(fftDataRange[0], fftDataRange[1]);
		fftPlayer.current = fft;
		const result = new Float32Array(64);

		const onFFTFrame = () => {
			if (canceled) return;
			fft.read(result);
			store.set(fftDataAtom, [...result]);
			requestAnimationFrame(onFFTFrame);
		};

		requestAnimationFrame(onFFTFrame);

		return () => {
			canceled = true;
			fftPlayer.current = undefined;
			fft.free();
		};
	}, [fftDataRange, store]);

	useEffect(() => {
		setConnectedAddrs(new Set());
		store.set(musicNameAtom, "等待连接中");
		store.set(musicAlbumNameAtom, "");
		store.set(musicCoverAtom, "");
		store.set(musicArtistsAtom, []);

		function sendWSMessage<T extends keyof WSBodyMessageMap>(
			type: T,
			value: WSBodyMessageMap[T] extends undefined
				? undefined
				: WSBodyMessageMap[T] | undefined = undefined,
		) {
			invoke("ws_boardcast_message", {
				data: {
					type,
					value,
				},
			});
		}

		const toEmit = <T,>(onEmit: T) => ({
			onEmit,
		});
		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				sendWSMessage("forwardSong");
			}),
		);
		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				sendWSMessage("backwardSong");
			}),
		);
		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				sendWSMessage(store.get(musicPlayingAtom) ? "pause" : "resume");
			}),
		);
		store.set(
			onSeekPositionAtom,
			toEmit((progress) => {
				sendWSMessage("seekPlayProgress", {
					progress: progress | 0,
				});
			}),
		);
		store.set(
			onLyricLineClickAtom,
			toEmit((evt) => {
				sendWSMessage("seekPlayProgress", {
					progress: evt.line.getLine().startTime | 0,
				});
			}),
		);
		store.set(
			onChangeVolumeAtom,
			toEmit((volume) => {
				sendWSMessage("setVolume", {
					volume,
				});
			}),
		);

		const unlistenConnected = listen<string>(
			"on-ws-protocol-client-connected",
			(evt) => {
				sendWSMessage("ping");
				setConnectedAddrs((prev) => new Set([...prev, evt.payload]));
			},
		);

		interface WSArtist {
			id: string;
			name: string;
		}

		interface WSLyricWord {
			startTime: number;
			endTime: number;
			word: string;
		}

		interface WSLyricLine {
			startTime: number;
			endTime: number;
			words: WSLyricWord[];
			isBG: boolean;
			isDuet: boolean;
			translatedLyric: string;
			romanLyric: string;
		}

		type WSBodyMessageMap = {
			ping: undefined;
			pong: undefined;
			setMusicInfo: {
				musicId: string;
				musicName: string;
				albumId: string;
				albumName: string;
				artists: WSArtist[];
				duration: number;
			};
			setMusicAlbumCoverImageURI: {
				imgUrl: string;
			};
			setMusicAlbumCoverImageData: {
				data: number[];
			};
			onPlayProgress: {
				progress: number;
			};
			onVolumeChanged: {
				volume: number;
			};
			onPaused: undefined;
			onResumed: undefined;
			onAudioData: {
				data: number[];
			};
			setLyric: {
				data: WSLyricLine[];
			};
			setLyricFromTTML: {
				data: string;
			};
			pause: undefined;
			resume: undefined;
			forwardSong: undefined;
			backwardSong: undefined;
			setVolume: {
				volume: number;
			};
			seekPlayProgress: {
				progress: number;
			};
		};

		type WSBodyMap = {
			[T in keyof WSBodyMessageMap]: {
				type: T;
				value: WSBodyMessageMap[T];
			};
		};

		function onBody(evt: Event<WSBodyMap[keyof WSBodyMessageMap]>) {
			const payload = evt.payload;

			switch (payload.type) {
				case "ping": {
					sendWSMessage("pong");
					break;
				}
				case "setMusicInfo": {
					store.set(musicIdAtom, payload.value.musicId);
					store.set(musicNameAtom, payload.value.musicName);
					store.set(musicDurationAtom, payload.value.duration);
					store.set(
						musicArtistsAtom,
						payload.value.artists.map((v) => ({
							id: v.id,
							name: v.name,
						})),
					);
					store.set(musicPlayingPositionAtom, 0);
					break;
				}
				case "setMusicAlbumCoverImageURI": {
					store.set(musicCoverAtom, payload.value.imgUrl);
					break;
				}
				case "onPlayProgress": {
					store.set(musicPlayingPositionAtom, payload.value.progress);
					break;
				}
				case "onPaused": {
					store.set(musicPlayingAtom, false);
					break;
				}
				case "onResumed": {
					store.set(musicPlayingAtom, true);
					break;
				}
				case "onAudioData": {
					fftPlayer.current?.pushDataI16(
						48000,
						2,
						new Int16Array(new Uint8Array(payload.value.data).buffer),
					);
					break;
				}
				case "setLyric": {
					const processed = payload.value.data.map((line) => ({
						...line,
						words: line.words.map((word) => ({
							...word,
							obscene: false,
						})),
					}));
					if (processed.length > 0) {
						store.set(hideLyricViewAtom, false);
					}
					store.set(musicLyricLinesAtom, processed);
					break;
				}
				case "setLyricFromTTML": {
					try {
						const data = parseTTML(payload.value.data);
						const processed = data.lines.map((line) => ({
							...line,
							words: line.words.map((word) => ({
								...word,
								obscene: false,
							})),
						}));
						store.set(musicLyricLinesAtom, processed);
					} catch (e) {
						console.error(e);
						toast.error(
							t(
								"ws-protocol.toast.ttmlParseError",
								"解析来自 WS 发送端的 TTML 歌词时出错：{{error}}",
								{ error: String(e) },
							),
						);
					}
					break;
				}
				default:
					console.log("on-ws-protocol-client-body", payload);
			}
		}

		const unlistenBody = listen("on-ws-protocol-client-body", onBody);
		const unlistenDisconnected = listen<string>(
			"on-ws-protocol-client-disconnected",
			(evt) =>
				setConnectedAddrs(
					(prev) => new Set([...prev].filter((v) => v !== evt.payload)),
				),
		);
		invoke<string[]>("ws_get_connections").then((addrs) =>
			setConnectedAddrs(new Set(addrs)),
		);
		invoke("ws_reopen_connection", {
			addr: wsProtocolListenAddr,
		});
		return () => {
			unlistenConnected.then((u) => u());
			unlistenBody.then((u) => u());
			unlistenDisconnected.then((u) => u());
			invoke("ws_reopen_connection", {
				addr: "",
			});
		};
	}, [wsProtocolListenAddr, setConnectedAddrs, store, t]);

	return (
		<>
			<FFTToLowPassContext />
		</>
	);
};
