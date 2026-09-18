import { Spring } from "./spring.ts";
import { Spring as WASpring } from "./wa-spring.ts";

export { Spring } from "./spring.ts";

/**
 * 弹簧动画的实现方式
 *
 * - `frame`：逐帧计算位置并由调用方写入样式，过往版本的默认实现
 * - `wa`：按原有算法生成关键帧交给 Web Animation API 播放，理论上可以大幅降低 CPU 占用开销
 * 				（仅动画初始化时会计算动画效果，后续会由浏览器合成线程进行处理（也许会更流畅？））
 */
export type SpringImplementation = "frame" | "wa";

let currentImplementation: SpringImplementation = "frame";

/**
 * 设置全局弹簧实现
 *
 * 只影响此后创建的弹簧实例，一般需要在重建歌词视图之后才会完全生效
 * @param impl 弹簧实现方式
 */
export function setSpringImplementation(impl: SpringImplementation): void {
	currentImplementation = impl;
}

/**
 * 获取当前全局弹簧实现
 * @returns 当前实现方式
 */
export function getSpringImplementation(): SpringImplementation {
	return currentImplementation;
}

/**
 * 按照当前全局弹簧实现创建一个弹簧
 * @param currentPosition 弹簧初始位置
 * @returns 一个新的弹簧实例
 */
export function createSpring(currentPosition = 0): Spring {
	return currentImplementation === "wa"
		? new WASpring(currentPosition)
		: new Spring(currentPosition);
}
