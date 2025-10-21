import { invoke } from "@tauri-apps/api/core";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ==================================================================
//                            类型定义
// ==================================================================

/**
 * 定义了 SMTC 会话的结构。
 */
export interface SmtcSession {
	sessionId: string;
	displayName: string;
}

/**
 * 定义了文本转换模式的枚举，用于处理不同地区的字符集。
 */
export enum TextConversionMode {
	Off = "off",
	TraditionalToSimplified = "traditionalToSimplified",
	SimplifiedToTraditional = "simplifiedToTraditional",
	SimplifiedToTaiwan = "simplifiedToTaiwan",
	TaiwanToSimplified = "taiwanToSimplified",
	SimplifiedToHongKong = "simplifiedToHongKong",
	HongKongToSimplified = "hongKongToSimplified",
}

/**
 * 定义了播放器的重复模式枚举。
 */
export enum RepeatMode {
	Off = "off",
	One = "one",
	All = "all",
}

// ==================================================================
//                        SMTC 状态与配置
// ==================================================================

/**
 * 存储当前可用的所有 SMTC 会话列表。
 */
export const smtcSessionsAtom = atom<SmtcSession[]>([]);

/**
 * 用户选择的 SMTC 会话 ID。
 * `null` 代表自动选择。
 */
export const smtcSelectedSessionIdAtom = atomWithStorage<string | null>(
	"amll-player.smtcSelectedSessionId",
	null,
);

/**
 * 控制音质详情对话框是否打开。
 */
export const audioQualityDialogOpenedAtom = atom(false);

/**
 * 当前 SMTC 会话中曲目的唯一标识符。
 */
export const smtcTrackIdAtom = atom<string>("");

/**
 * SMTC 歌词文本的转换模式设置。
 */
export const smtcTextConversionModeAtom = atomWithStorage(
	"amll-player.smtcTextConversionMode",
	TextConversionMode.Off,
);

/**
 * SMTC 会话中的随机播放状态。
 */
export const smtcShuffleStateAtom = atom<boolean>(false);

/**
 * SMTC 会话中的重复播放模式。
 */
export const smtcRepeatModeAtom = atom<RepeatMode>(RepeatMode.Off);

/**
 * 用于手动校准 SMTC 播放时间的偏移量，单位毫秒。
 */
export const smtcTimeOffsetAtom = atomWithStorage(
	"amll-player.smtcTimeOffset",
	0,
);

export enum MediaType {
	Unknown = "unknown",
	Music = "music",
	Video = "video",
	Image = "image",
}

export const smtcMediaTypeAtom = atom<MediaType>(MediaType.Unknown);

export const smtcAlbumArtistAtom = atom<string>("");

/**
 * SMTC 会话中的流派
 *
 * 部分应用可能会使用这个字段传递歌曲 ID
 */
export const smtcGenresAtom = atom<string[]>([]);

export const smtcTrackNumberAtom = atom<number | undefined>(undefined);

export const smtcAlbumTrackCountAtom = atom<number | undefined>(undefined);

// ==================================================================
//                        SMTC 控制能力
// ==================================================================

/**
 * 各个 SMTC 控制能力。
 */
export const SmtcControls = {
	CAN_PLAY: 1 << 0,
	CAN_PAUSE: 1 << 1,
	CAN_SKIP_NEXT: 1 << 2,
	CAN_SKIP_PREVIOUS: 1 << 3,
	CAN_SEEK: 1 << 4,
	CAN_CHANGE_SHUFFLE: 1 << 5,
	CAN_CHANGE_REPEAT: 1 << 6,
} as const;

export type SmtcControlsType = number;

/**
 * 当前会话可用的的控制能力。
 */
export const smtcControlsAtom = atom<SmtcControlsType>(0);

// ==================================================================
//                        SMTC 派生/写入状态
// ==================================================================

/**
 * 一个只写 Atom，用于触发切换随机播放状态的命令。
 */
export const onClickSmtcShuffleAtom = atom(null, (get) => {
	const currentShuffle = get(smtcShuffleStateAtom);
	invoke("control_external_media", {
		payload: { type: "setShuffle", is_active: !currentShuffle },
	}).catch(console.error);
});

/**
 * 一个只写 Atom，用于触发切换重复播放模式的命令。
 */
export const onClickSmtcRepeatAtom = atom(null, (get) => {
	const currentMode = get(smtcRepeatModeAtom);
	const nextMode =
		currentMode === RepeatMode.Off
			? RepeatMode.All
			: currentMode === RepeatMode.All
				? RepeatMode.One
				: RepeatMode.Off;
	invoke("control_external_media", {
		payload: { type: "setRepeatMode", mode: nextMode },
	}).catch(console.error);
});
