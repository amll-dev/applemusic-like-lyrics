import { invoke } from "@tauri-apps/api/core";
import type { Update } from "@tauri-apps/plugin-updater";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ==================================================================
//                            类型定义
// ==================================================================

/**
 * 定义了应用的主题模式枚举。
 */
export enum DarkMode {
	Auto = "auto",
	Light = "light",
	Dark = "dark",
}

/**
 * 定义了应用的音乐数据来源模式枚举。
 * - `local`: 本地文件播放模式。
 * - `ws-protocol`: WebSocket 协议模式。
 * - `system-listener`: SMTC 监听模式。
 */
export enum MusicContextMode {
	Local = "local",
	WSProtocol = "ws-protocol",
	SystemListener = "system-listener",
}

// ==================================================================
//                        应用核心配置
// ==================================================================

/**
 * 应用的显示语言。
 * @default "zh-CN"
 */
export const displayLanguageAtom = atomWithStorage(
	"amll-player.displayLanguage",
	"zh-CN",
);

/**
 * 应用的主题（暗黑/明亮）模式设置。
 * @default DarkMode.Auto
 */
export const darkModeAtom = atomWithStorage(
	"amll-player.darkMode",
	DarkMode.Auto,
);

/**
 * 应用的音乐上下文（数据源）模式。
 * @default MusicContextMode.Local
 */
export const musicContextModeAtom = atomWithStorage(
	"amll-player.musicContextMode",
	MusicContextMode.Local,
);

/**
 * 是否启用提前歌词行时序的功能。
 * 即将原歌词行的初始时间时序提前，以便在歌词滚动结束后刚好开始播放（逐词）歌词效果。这个行为更加接近 Apple Music 的效果，
 * 但是大部分情况下会导致歌词行末尾的歌词尚未播放完成便被切换到下一行。
 */
export const advanceLyricDynamicLyricTimeAtom = atomWithStorage(
	"amll-player.advanceLyricDynamicLyricTimeAtom",
	false,
);

/**
 * 是否启用系统的媒体控件功能，例如 Windows 的 SMTC
 * @default true
 */
const enableMediaControlsInternalAtom = atomWithStorage(
	"amll-player.enableMediaControls",
	true,
);

export const enableMediaControlsAtom = atom(
	(get) => get(enableMediaControlsInternalAtom),
	(_get, set, enabled: boolean) => {
		set(enableMediaControlsInternalAtom, enabled);
		invoke("set_media_controls_enabled", { enabled }).catch((err) => {
			console.error("设置媒体控件的启用状态失败", err);
		});
	},
);

/**
 * 是否在 SMTC 监听模式下启用 WebSocket 接收歌词。
 */
export const enableWsLyricsInSmtcModeAtom = atomWithStorage(
	"amll-player.enableWsLyricsInSmtcMode",
	true,
);

/**
 * WebSocket 协议的监听地址和端口。
 */
export const wsProtocolListenAddrAtom = atomWithStorage(
	"amll-player.wsProtocolListenAddr",
	"localhost:11444",
);

/**
 * 是否在应用中显示性能统计（Stat.js）面板。
 */
export const showStatJSFrameAtom = atomWithStorage(
	"amll-player.showStatJSFrame",
	false,
);

// ==================================================================
//                        应用 UI 状态
// ==================================================================

/**
 * 一个派生状态，用于自动检测系统是否处于深色模式。
 */
export const autoDarkModeAtom = atom(true);

/**
 * 一个派生状态，用于最终决定应用应该显示的主题。
 * 它会根据 `darkModeAtom` 的设置（自动/手动）来返回最终的主题状态。
 * 同时，它也允许通过 set 操作来直接设置手动模式下的主题。
 */
export const isDarkThemeAtom = atom(
	(get) =>
		get(darkModeAtom) === DarkMode.Auto
			? get(autoDarkModeAtom)
			: get(darkModeAtom) === DarkMode.Dark,
	(_get, set, newIsDark: boolean) =>
		set(darkModeAtom, newIsDark ? DarkMode.Dark : DarkMode.Light),
);

/**
 * 控制播放列表卡片是否打开。
 */
export const playlistCardOpenedAtom = atom(false);

/**
 * 控制录制面板是否打开。
 */
export const recordPanelOpenedAtom = atom(false);

/**
 * 控制应用的主菜单（通常在歌词页面）是否打开。
 */
export const amllMenuOpenedAtom = atom(false);

/**
 * 控制主界面底部的“正在播放”栏是否隐藏。
 */
export const hideNowPlayingBarAtom = atom(false);

/**
 * 存储当前已连接到本应用的 WebSocket 客户端地址列表。
 */
export const wsProtocolConnectedAddrsAtom = atom(new Set<string>());

// ==================================================================
//                        应用更新状态
// ==================================================================

/**
 * 标记当前是否正在检查应用更新。
 */
export const isCheckingUpdateAtom = atom(false);

/**
 * 存储获取到的更新信息。
 * 如果没有更新，则为 `false`。
 */
export const updateInfoAtom = atom<Update | false>(false);

/**
 * 控制是否启用自动检查更新。
 */
export const autoUpdateAtom = atomWithStorage("amll-player.autoUpdate", true);
