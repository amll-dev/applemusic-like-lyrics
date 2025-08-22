import { FFTPlayer } from "@applemusic-like-lyrics/fft";
import { parseTTML } from "@applemusic-like-lyrics/lyric";
import {
	fftDataAtom,
	fftDataRangeAtom,
	hideLyricViewAtom,
	isLyricPageOpenedAtom,
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicDurationAtom,
	musicIdAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	musicVolumeAtom,
	onChangeVolumeAtom,
	onClickControlThumbAtom,
	onLyricLineClickAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestPrevSongAtom,
	onSeekPositionAtom,
} from "@applemusic-like-lyrics/react-full";
import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { type FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	wsProtocolConnectedAddrsAtom,
	wsProtocolListenAddrAtom,
} from "../../states/appAtoms.ts";
import { emitAudioThread } from "../../utils/player.ts";
import { FFTToLowPassContext } from "../LocalMusicContext/index.tsx";

interface WSProtocolMusicContextProps {
	isLyricOnly?: boolean;
}

export const WSProtocolMusicContext: FC<WSProtocolMusicContextProps> = ({
	isLyricOnly = false,
}) => {
	const wsProtocolListenAddr = useAtomValue(wsProtocolListenAddrAtom);
	const setConnectedAddrs = useSetAtom(wsProtocolConnectedAddrsAtom);
	const setIsLyricPageOpened = useSetAtom(isLyricPageOpenedAtom);
	const store = useStore();
	const { t } = useTranslation();
	const fftPlayer = useRef<FFTPlayer | undefined>(undefined);

	useEffect(() => {
		if (!isLyricOnly) {
			emitAudioThread("pauseAudio");
		}
	}, [isLyricOnly]);

	const fftDataRange = useAtomValue(fftDataRangeAtom);

	useEffect(() => {
		let canceled = false;
		const fft = new FFTPlayer();
		fft.setFreqRange(fftDataRange[0], fftDataRange[1]);
		fftPlayer.current = fft;
		const result = new Float32Array(64);

		const onFFTFrame = () => {
			if (canceled) return;
			fftPlayer.current?.read(result);
			store.set(fftDataAtom, [...result]);
			requestAnimationFrame(onFFTFrame);
		};

		requestAnimationFrame(onFFTFrame);

		return () => {
			canceled = true;
			fftPlayer.current?.free();
			fftPlayer.current = undefined;
		};
	}, [fftDataRange, store]);

	useEffect(() => {
		if (!wsProtocolListenAddr && !isLyricOnly) {
			return;
		}

		setConnectedAddrs(new Set());

		if (!isLyricOnly) {
			store.set(musicNameAtom, "等待连接中");
			store.set(musicAlbumNameAtom, "");
			store.set(musicCoverAtom, "");
			store.set(musicArtistsAtom, []);
		}

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

		if (!isLyricOnly) {
			const toEmit = <T,>(onEmit: T) => ({ onEmit });
			store.set(
				onRequestNextSongAtom,
				toEmit(() => sendWSMessage("forwardSong")),
			);
			store.set(
				onRequestPrevSongAtom,
				toEmit(() => sendWSMessage("backwardSong")),
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
					sendWSMessage("seekPlayProgress", { progress: progress | 0 });
				}),
			);
			store.set(
				onLyricLineClickAtom,
				toEmit((evt, playerRef) => {
					sendWSMessage("seekPlayProgress", {
						progress: evt.line.getLine().startTime | 0,
					});
					playerRef?.lyricPlayer?.resetScroll();
				}),
			);
			store.set(
				onChangeVolumeAtom,
				toEmit((volume) => {
					sendWSMessage("setVolume", { volume });
				}),
			);
			store.set(
				onClickControlThumbAtom,
				toEmit(() => {
					setIsLyricPageOpened(false);
				}),
			);
		}

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
			setMusicAlbumCoverImageURI: { imgUrl: string };
			setMusicAlbumCoverImageData: { data: number[] };
			onPlayProgress: { progress: number };
			onVolumeChanged: { volume: number };
			onPaused: undefined;
			onResumed: undefined;
			onAudioData: { data: number[] };
			setLyric: { data: WSLyricLine[] };
			setLyricFromTTML: { data: string };
			pause: undefined;
			resume: undefined;
			forwardSong: undefined;
			backwardSong: undefined;
			setVolume: { volume: number };
			seekPlayProgress: { progress: number };
		};
		type WSBodyMap = {
			[T in keyof WSBodyMessageMap]: { type: T; value: WSBodyMessageMap[T] };
		};

		let curCoverBlobUrl = "";
		const onBodyChannel = new Channel<WSBodyMap[keyof WSBodyMessageMap]>();

		function onBody(payload: WSBodyMap[keyof WSBodyMessageMap]) {
			if (payload.type === "ping") {
				sendWSMessage("pong");
				return;
			}

			if (isLyricOnly) {
				switch (payload.type) {
					case "setLyric":
					case "setLyricFromTTML":
						break;
					default:
						return;
				}
			}

			switch (payload.type) {
				case "setMusicInfo": {
					store.set(musicIdAtom, payload.value.musicId);
					store.set(musicNameAtom, payload.value.musicName);
					store.set(musicDurationAtom, payload.value.duration);
					store.set(
						musicArtistsAtom,
						payload.value.artists.map((v) => ({ id: v.id, name: v.name })),
					);
					store.set(musicPlayingPositionAtom, 0);
					break;
				}
				case "setMusicAlbumCoverImageURI": {
					if (curCoverBlobUrl) {
						URL.revokeObjectURL(curCoverBlobUrl);
						curCoverBlobUrl = "";
					}
					store.set(musicCoverAtom, payload.value.imgUrl);
					break;
				}
				case "setMusicAlbumCoverImageData": {
					const data = new Uint8Array(payload.value.data);
					const blob = new Blob([data], { type: "image" });
					const url = URL.createObjectURL(blob);
					if (curCoverBlobUrl) {
						URL.revokeObjectURL(curCoverBlobUrl);
					}
					curCoverBlobUrl = url;
					store.set(musicCoverAtom, url);
					break;
				}
				case "onVolumeChanged": {
					store.set(musicVolumeAtom, payload.value.volume);
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
						words: line.words.map((word) => ({ ...word, obscene: false })),
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
							words: line.words.map((word) => ({ ...word, obscene: false })),
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
					console.log(
						"on-ws-protocol-client-body",
						"未处理的报文（暂不支持）",
						payload,
					);
			}
		}

		onBodyChannel.onmessage = onBody;

		// const unlistenBody = listen("on-ws-protocol-client-body", onBody);
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
		invoke("ws_close_connection").then(() => {
			const addr = wsProtocolListenAddr || "127.0.0.1:11444";
			invoke("ws_reopen_connection", { addr, channel: onBodyChannel });
		});
		return () => {
			unlistenConnected.then((u) => u());
			unlistenDisconnected.then((u) => u());

			invoke("ws_close_connection");

			const doNothing = { onEmit: () => {} };
			store.set(onRequestNextSongAtom, doNothing);
			store.set(onRequestPrevSongAtom, doNothing);
			store.set(onPlayOrResumeAtom, doNothing);
			store.set(onSeekPositionAtom, doNothing);
			store.set(onLyricLineClickAtom, doNothing);
			store.set(onChangeVolumeAtom, doNothing);
			store.set(onClickControlThumbAtom, doNothing);

			if (curCoverBlobUrl) {
				URL.revokeObjectURL(curCoverBlobUrl);
				curCoverBlobUrl = "";
			}

			if (!isLyricOnly) {
				store.set(musicNameAtom, "");
				store.set(musicAlbumNameAtom, "");
				store.set(musicCoverAtom, "");
				store.set(musicArtistsAtom, []);
				store.set(musicIdAtom, "");
				store.set(musicDurationAtom, 0);
				store.set(musicPlayingPositionAtom, 0);
				store.set(musicPlayingAtom, false);
				store.set(musicLyricLinesAtom, []);
				store.set(musicVolumeAtom, 1);
			}
		};
	}, [
		wsProtocolListenAddr,
		setConnectedAddrs,
		store,
		t,
		isLyricOnly,
		setIsLyricPageOpened,
	]);

	if (isLyricOnly) {
		return null;
	}

	return <FFTToLowPassContext />;
};
