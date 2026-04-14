import { atom, type PrimitiveAtom, type WritableAtom } from "jotai";
import { onCycleRepeatModeAtom, onToggleShuffleAtom } from "./callbacks";

/**
 * 重复播放的模式
 */
export enum RepeatMode {
	Off = "off",
	One = "one",
	All = "all",
}

/**
 * 随机播放是否开启
 */
export const isShuffleActiveAtom: PrimitiveAtom<boolean> = atom<boolean>(false);

/**
 * 当前的重复播放模式
 */
export const repeatModeAtom: PrimitiveAtom<RepeatMode> = atom<RepeatMode>(
	RepeatMode.Off,
);

/**
 * 随机按钮是否可用
 */
export const isShuffleEnabledAtom: PrimitiveAtom<boolean> = atom<boolean>(true);

/**
 * 重复按钮是否可用
 */
export const isRepeatEnabledAtom: PrimitiveAtom<boolean> = atom<boolean>(true);

/**
 * 切换随机播放模式的动作
 */
export const toggleShuffleActionAtom: WritableAtom<null, [], void> = atom(
	null,
	(get) => {
		const callback = get(onToggleShuffleAtom);
		callback.onEmit?.();
	},
);

/**
 * 切换循环播放模式的动作
 */
export const cycleRepeatModeActionAtom: WritableAtom<null, [], void> = atom(
	null,
	(get) => {
		const callback = get(onCycleRepeatModeAtom);
		callback.onEmit?.();
	},
);
