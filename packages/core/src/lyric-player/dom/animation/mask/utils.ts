import type { AnimationInterval } from "../sync.ts";

const bright = "rgb(0 0 0 / var(--bright-mask-alpha, 1))";
const dark = "rgb(0 0 0 / var(--dark-mask-alpha, 1))";

export function generateFadeGradient(
	width: number,
): readonly [gradient: string, totalAspect: number] {
	const totalAspect = 2 + width;
	const halfFadePercent = (width / totalAspect) * 50;
	const leftPercent = 50 - halfFadePercent;
	const rightPercent = 50 + halfFadePercent;

	return [
		`linear-gradient(to right, ${bright} ${leftPercent}%, ${dark} ${rightPercent}%)`,
		totalAspect,
	] as const;
}

/**
 * 求一组遮罩关键帧里真正发生变化的区间
 *
 * 单词的遮罩在整行的大部分时间里都被钳在两端不动，只有属于自己那一段才真正在移动。
 * 找出这段区间后，就只需要在此期间让动画保持播放，其余时间暂停即可得到完全相同的渲染结果，
 * 从而避免停滞的动画每帧触发样式重算
 *
 * @param frames 按时间升序排列的关键帧
 * @param totalDuration 整段动画的时长（毫秒）
 * @returns 变化区间 `[start, end]`（行内相对毫秒）；若整段都没有变化则返回 `undefined`
 */
export function getFrameChangeWindow(
	frames: readonly Keyframe[],
	totalDuration: number,
): AnimationInterval | undefined {
	let start = -1;
	let end = -1;

	for (let i = 1; i < frames.length; i++) {
		if (frames[i].maskPosition !== frames[i - 1].maskPosition) {
			// 区间起点取变化帧之前的那一刻，确保静止值也被覆盖在区间之外
			if (start < 0) start = Number(frames[i - 1].offset ?? 0);
			end = Number(frames[i].offset ?? 0);
		}
	}

	if (start < 0 || end < start) return undefined;
	return { start: start * totalDuration, end: end * totalDuration };
}
