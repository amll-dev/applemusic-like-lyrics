import type { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import type { LyricPlayerRef } from "@applemusic-like-lyrics/react";
import { atom, type PrimitiveAtom } from "jotai";

export interface Callback<Args extends unknown[], Result = void> {
	onEmit?: (...args: Args) => Result;
}

const c = <Args extends unknown[], Result = void>(
	_onEmit: (...args: Args) => Result,
): Callback<Args, Result> => ({});

/**
 * 点击歌曲专辑图上方的控制横条时触发
 *
 * 通常用于关闭歌词页面
 */
export const onClickControlThumbAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);

/**
 * 点击音质标签时触发
 *
 * 通常用于打开音质详情对话框
 */
export const onClickAudioQualityTagAtom: PrimitiveAtom<Callback<[], void>> =
	atom(c(() => {}));

/**
 * 点击菜单按钮时触发
 */
export const onRequestOpenMenuAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);

/**
 * 点击暂停或播放按钮时触发
 */
export const onPlayOrResumeAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);

/**
 * 点击上一首按钮时触发
 */
export const onRequestPrevSongAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);

/**
 * 点击下一首按钮时触发
 */
export const onRequestNextSongAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);

/**
 * 拖动进度条触发跳转时触发
 * @param position - 目标播放位置，单位为毫秒
 */
export const onSeekPositionAtom: PrimitiveAtom<
	Callback<[_position: number], void>
> = atom(c((_position: number) => {}));

/**
 * 当某个歌词行被左键点击时触发
 * @param _evt 歌词行的事件对象，可以访问到对应的歌词行信息和歌词行索引
 * @param _playerRef 歌词播放组件的引用
 */
export const onLyricLineClickAtom: PrimitiveAtom<
	Callback<[_evt: LyricLineMouseEvent, _playerRef: LyricPlayerRef | null], void>
> = atom(
	c((_evt: LyricLineMouseEvent, _playerRef: LyricPlayerRef | null) => {}),
);

/**
 * 当某个歌词行被右键点击时触发
 * @param _evt 歌词行的事件对象，可以访问到对应的歌词行信息和歌词行索引
 * @param _playerRef 歌词播放组件的引用
 */
export const onLyricLineContextMenuAtom: PrimitiveAtom<
	Callback<[_evt: LyricLineMouseEvent, _playerRef: LyricPlayerRef | null], void>
> = atom(
	c((_evt: LyricLineMouseEvent, _playerRef: LyricPlayerRef | null) => {}),
);

/**
 * 通过音量滑块改变音量时触发
 * @param volume - 目标音量，取值范围为 [0-1]
 */
export const onChangeVolumeAtom: PrimitiveAtom<
	Callback<[_volume: number], void>
> = atom(c((_volume: number) => {}));

/**
 * 点击随机按钮时触发
 */
export const onToggleShuffleAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);

/**
 * 点击循环按钮时触发
 */
export const onCycleRepeatModeAtom: PrimitiveAtom<Callback<[], void>> = atom(
	c(() => {}),
);
