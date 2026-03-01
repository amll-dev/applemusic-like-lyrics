import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
	type ArtistStateEntry,
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicCoverIsVideoAtom,
	musicDurationAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
} from "@applemusic-like-lyrics/react-full";
import { emit } from "@tauri-apps/api/event";
import { useAtomValue } from "jotai";
import { type FC, useEffect, useRef } from "react";

export interface TaskbarLyricMetadataPayload {
	musicName: string;
	musicArtists: ArtistStateEntry[];
	musicAlbumName: string;
	musicDuration: number;
	lyricLines: LyricLine[];
	musicCover: string;
	musicCoverIsVideo: boolean;
}

export interface TaskbarLyricPlayStatusPayload {
	musicPlaying: boolean;
}

export interface TaskbarLyricPositionPayload {
	position: number;
}

export interface TaskbarLyricThemePayload {
	theme: "dark" | "light";
}

export interface TaskbarLyricAlignmentPayload {
	align: "left" | "right";
}

export const METADATA_EVENT = "taskbar-lyric:metadata";
export const PLAY_STATUS_EVENT = "taskbar-lyric:play-status";
export const POSITION_EVENT = "taskbar-lyric:position";
export const THEME_EVENT = "taskbar-lyric:theme";
export const ALIGN_EVENT = "taskbar-lyric:alignment";

export const TaskbarLyricBridge: FC = () => {
	const musicName = useAtomValue(musicNameAtom);
	const musicArtists = useAtomValue(musicArtistsAtom);
	const musicAlbumName = useAtomValue(musicAlbumNameAtom);
	const musicDuration = useAtomValue(musicDurationAtom);
	const musicLyricLines = useAtomValue(musicLyricLinesAtom);
	const musicPlaying = useAtomValue(musicPlayingAtom);
	const musicPlayingPosition = useAtomValue(musicPlayingPositionAtom);
	const musicCover = useAtomValue(musicCoverAtom);
	const musicCoverIsVideo = useAtomValue(musicCoverIsVideoAtom);
	const lastEmitTime = useRef(0);

	useEffect(() => {
		const payload: TaskbarLyricMetadataPayload = {
			musicName,
			musicArtists,
			musicAlbumName,
			musicDuration,
			lyricLines: musicLyricLines,
			musicCover,
			musicCoverIsVideo,
		};
		emit(METADATA_EVENT, payload).catch(console.error);
	}, [
		musicName,
		musicArtists,
		musicAlbumName,
		musicDuration,
		musicLyricLines,
		musicCover,
		musicCoverIsVideo,
	]);

	useEffect(() => {
		const payload: TaskbarLyricPlayStatusPayload = { musicPlaying };
		emit(PLAY_STATUS_EVENT, payload).catch(console.error);
	}, [musicPlaying]);

	useEffect(() => {
		const now = performance.now();
		if (now - lastEmitTime.current < 200) return;
		lastEmitTime.current = now;

		const payload: TaskbarLyricPositionPayload = {
			position: musicPlayingPosition,
		};
		emit(POSITION_EVENT, payload).catch(console.error);
	}, [musicPlayingPosition]);

	return null;
};
