import type { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import type { LyricPlayerRef } from "@applemusic-like-lyrics/react";
import { atom } from "jotai";

/**
 * 定义一个通用的回调函数结构。
 * 这是一个辅助类型，用于创建回调 Atom。
 */
export interface Callback<Args extends unknown[], Result = void> {
	onEmit?: (...args: Args) => Result;
}

/**
 * 一个辅助函数，用于创建具有正确类型的空回调对象。
 * 主要用于类型推断和初始化。
 */
const c = <Args extends unknown[], Result = void>(
	_onEmit: (...args: Args) => Result,
): Callback<Args, Result> => ({});

// ==================================================================
//                        回调函数原子状态
// ==================================================================

/**
 * 当点击歌曲专辑图上方的控制横条（thumb）时触发。
 * 通常用于关闭歌词页面。
 */
export const onClickControlThumbAtom = atom(c(() => {}));

/**
 * 当点击音质标签时触发。
 * 通常用于打开音质详情对话框。
 */
export const onClickAudioQualityTagAtom = atom(c(() => {}));

/**
 * 当用户试图打开菜单时触发。
 */
export const onRequestOpenMenuAtom = atom(c(() => {}));

/**
 * 当用户请求播放或从暂停中恢复时触发。
 */
export const onPlayOrResumeAtom = atom(c(() => {}));

/**
 * 当用户请求暂停播放时触发。
 */
export const onPauseAtom = atom(c(() => {}));

/**
 * 当用户请求播放上一首歌曲时触发。
 */
export const onRequestPrevSongAtom = atom(c(() => {}));

/**
 * 当用户请求播放下一首歌曲时触发。
 */
export const onRequestNextSongAtom = atom(c(() => {}));

/**
 * 当用户通过拖动进度条等方式请求跳转到指定播放位置时触发。
 * @param {number} position - 目标播放位置，单位为毫秒。
 */
export const onSeekPositionAtom = atom(c((_position: number) => {}));

/**
 * 当用户点击某一行歌词时触发。
 * 通常用于跳转到该行歌词的起始时间。
 * @param {LyricLineMouseEvent} _evt - 歌词行事件对象。
 * @param {LyricPlayerRef | null} _playerRef - 播放器引用。
 */
export const onLyricLineClickAtom = atom(
	c((_evt: LyricLineMouseEvent, _playerRef: LyricPlayerRef | null) => {}),
);

/**
 * 当用户试图对歌词行打开上下文菜单（例如右键点击）时触发。
 * @param {LyricLineMouseEvent} _evt - 歌词行事件对象。
 * @param {LyricPlayerRef | null} _playerRef - 播放器引用。
 */
export const onLyricLineContextMenuAtom = atom(
	c((_evt: LyricLineMouseEvent, _playerRef: LyricPlayerRef | null) => {}),
);

/**
 * 当用户通过音量滑块请求改变音量时触发。
 * @param {number} volume - 目标音量，取值范围为 [0-100]。
 */
export const onChangeVolumeAtom = atom(c((_volume: number) => {}));

/**
 * 当点击位于主控制按钮左侧的功能按钮时触发。
 */
export const onClickLeftFunctionButtonAtom = atom(c(() => {}));

/**
 * 当点击位于主控制按钮右侧的功能按钮时触发。
 */
export const onClickRightFunctionButtonAtom = atom(c(() => {}));

/**
 * 当用户请求切换随机播放模式时触发。
 */
export const onToggleShuffleAtom = atom(c(() => {}));

/**
 * 当用户请求切换重复播放模式时触发。
 */
export const onCycleRepeatModeAtom = atom(c(() => {}));
