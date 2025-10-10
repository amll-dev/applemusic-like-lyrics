import { parseTTML } from "@applemusic-like-lyrics/lyric";
import {
	hideLyricViewAtom,
	musicLyricLinesAtom,
} from "@applemusic-like-lyrics/react-full";
import { Channel, invoke } from "@tauri-apps/api/core";
import { useAtomValue, useStore } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { wsProtocolListenAddrAtom } from "../src/states/appAtoms";

interface WSLyricWord {
	startTime: number;
	endTime: number;
	word: string;
	romanWord: string;
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

type WSLyricContent =
	| { format: "structured"; lines: WSLyricLine[] }
	| { format: "ttml"; data: string };

type WSStateUpdate = { update: "setLyric" } & WSLyricContent;

type WSPayload =
	| { type: "ping" }
	| { type: "pong" }
	| { type: "state"; value: WSStateUpdate };

export const useWsLyrics = (isEnabled: boolean) => {
	const wsProtocolListenAddr = useAtomValue(wsProtocolListenAddrAtom);
	const store = useStore();
	const { t } = useTranslation();

	useEffect(() => {
		if (!isEnabled) {
			return;
		}

		const onBodyChannel = new Channel<WSPayload>();

		function onBody(payload: WSPayload) {
			if (payload.type === "ping") {
				invoke("ws_broadcast_payload", { payload: { type: "pong" } });
				return;
			}

			if (payload.type !== "state" || payload.value.update !== "setLyric") {
				return;
			}

			const state = payload.value;
			let lines: WSLyricLine[];

			if (state.format === "structured") {
				lines = state.lines;
			} else {
				try {
					lines = parseTTML(state.data).lines;
				} catch (e) {
					console.error(e);
					toast.error(
						t(
							"ws-protocol.toast.ttmlParseError",
							"解析 TTML 歌词时出错：{{error}}",
							{ error: String(e) },
						),
					);
					return;
				}
			}

			const processed = lines.map((line) => ({
				...line,
				words: line.words.map((word) => ({ ...word, obscene: false })),
			}));

			store.set(hideLyricViewAtom, processed.length === 0);
			store.set(musicLyricLinesAtom, processed);
		}

		onBodyChannel.onmessage = onBody;

		invoke("ws_close_connection").then(() => {
			const addr = wsProtocolListenAddr || "127.0.0.1:11444";
			invoke("ws_reopen_connection", { addr, channel: onBodyChannel });
		});

		return () => {
			invoke("ws_close_connection");
		};
	}, [isEnabled, wsProtocolListenAddr, store, t]);
};
