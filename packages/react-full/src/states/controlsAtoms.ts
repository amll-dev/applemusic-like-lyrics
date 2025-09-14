import { atom } from "jotai";
import { onCycleRepeatModeAtom, onToggleShuffleAtom } from "./callbacks";

/**
 * 定义了通用的重复播放模式枚举。
 */
export enum RepeatMode {
	Off = "off",
	One = "one",
	All = "all",
}

// ==================================================================
//                        抽象的媒体控制状态
// ==================================================================

export const isShuffleActiveAtom = atom<boolean>(false);
export const repeatModeAtom = atom<RepeatMode>(RepeatMode.Off);
export const isShuffleEnabledAtom = atom<boolean>(false);
export const isRepeatEnabledAtom = atom<boolean>(false);

// ==================================================================
//                        依赖注入模式实现
// ==================================================================

/**
 * 切换随机播放的动作。
 */
export const toggleShuffleActionAtom = atom(null, (get) => {
	const callback = get(onToggleShuffleAtom);
	callback.onEmit?.();
});

/**
 * 切换重复模式的动作。
 */
export const cycleRepeatModeActionAtom = atom(null, (get) => {
	const callback = get(onCycleRepeatModeAtom);
	callback.onEmit?.();
});
