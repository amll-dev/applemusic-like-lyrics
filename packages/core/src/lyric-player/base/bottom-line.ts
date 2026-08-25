import type { Disposable, HasElement } from "#interfaces";
import type { Spring } from "#utils/spring.ts";
import type { Duration } from "#utils/time.ts";

/** 底栏的位移动画弹簧 */
export interface BottomLineTransforms {
	posY: Spring;
}

/**
 * 底栏组件的抽象接口
 */
export interface BottomLine extends HasElement, Disposable {
	/**
	 * 将底栏放回重建歌词视图时的初始位置
	 */
	resetPosition(): void;

	/**
	 * 获取供外部插入内容的元素
	 */
	getContentElement?(): HTMLElement;

	/**
	 * 底栏当前测量得到的尺寸
	 *
	 * 由播放器的 ResizeObserver 回调写入
	 */
	lineSize: [number, number];

	/**
	 * 底栏的位移弹簧，目标位置与参数由播放器驱动
	 */
	readonly lineTransforms: BottomLineTransforms;

	/**
	 * 设置底栏是否处于聚焦状态
	 *
	 * 一般在歌曲播放完毕且底栏有内容时聚焦到底栏并设为 true
	 */
	setFocused(focused: boolean): void;

	/**
	 * 设置底栏的目标位置与模糊值
	 * @param top 底栏的 Y 坐标
	 * @param blur 底栏的模糊度
	 * @param immediate 为 true 时绕过弹簧立刻跳转至目标位置
	 * @param delay 弹簧过渡的延迟
	 */
	setTransform(
		top?: number,
		blur?: number,
		immediate?: boolean,
		delay?: Duration,
	): void;

	/**
	 * 逐帧推进弹簧动画并应用样式
	 * @param delta 距离上一次调用的时长
	 */
	update(delta?: Duration): void;
}
