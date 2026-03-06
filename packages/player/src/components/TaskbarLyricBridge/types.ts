import type { LyricLine } from "@applemusic-like-lyrics/core";
import type { ArtistStateEntry } from "@applemusic-like-lyrics/react-full";

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

export interface TaskbarLayoutExtraPayload {
	isCentered: boolean;
	systemType: string;
}

export interface SystemThemeChangedPayload {
	isLightTheme: boolean;
}

export const METADATA_EVENT = "taskbar-lyric:metadata";
export const PLAY_STATUS_EVENT = "taskbar-lyric:play-status";
export const POSITION_EVENT = "taskbar-lyric:position";
export const THEME_EVENT = "taskbar-lyric:theme";
export const ALIGN_EVENT = "taskbar-lyric:alignment";

export const CTRL_PREV_EVENT = "taskbar-lyric:ctrl-prev";
export const CTRL_PLAY_OR_RESUME_EVENT = "taskbar-lyric:ctrl-play-or-resume";
export const CTRL_NEXT_EVENT = "taskbar-lyric:ctrl-next";

export const REQUEST_UPDATE_EVENT = "taskbar-lyric:request-update";

export const FADE_OUT_EVENT = "taskbar-lyric:fade-out";
export const FADE_IN_EVENT = "taskbar-lyric:fade-in";

export const TASKBAR_LAYOUT_EXTRA_EVENT = "taskbar-layout-extra";
export const SYSTEM_THEME_CHANGED_EVENT = "system-theme-changed";

export const CMD_GET_SYSTEM_THEME = "get_system_theme";
export const CMD_SET_CLICK_INTERCEPTION = "set_click_interception";
