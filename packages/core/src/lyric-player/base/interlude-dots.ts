import type { Disposable, HasElement } from "#interfaces";
import type { Duration, MediaTime } from "#utils/time.ts";

/**
 * 间奏点组件的抽象接口
 */
export interface InterludeDots extends HasElement, Disposable {
	/**
	 * 设置间奏点元素的变换位置
	 */
	setTransform(left?: number, top?: number): void;

	/**
	 * 设置间奏点动画区间并重新锚定时间
	 * @param interlude 间奏起止时间
	 * @param currentTime 当前播放时间
	 * @param forceReset 是否强制重置动画起点，如 Seek、重新布局或切换间奏时
	 */
	setInterlude(
		interlude?: [MediaTime, MediaTime],
		currentTime?: MediaTime,
		forceReset?: boolean,
	): void;

	/**
	 * 暂停间奏点动画
	 */
	pause(): void;

	/**
	 * 恢复间奏点动画
	 */
	resume(): void;

	/**
	 * 逐帧推进间奏点动画并写入样式
	 * @param delta 距离上一次调用的时长
	 */
	update(delta?: Duration): void;
}
