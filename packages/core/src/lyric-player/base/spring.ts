import type { SpringParams } from "#utils/spring.ts";

// 缓慢模式参数，适用于 Seek 状态、间奏状态、首尾边界等场景
const SLOW_STIFFNESS = 90;
const SLOW_DAMPING = 15;

// 正常播放时候的参数，会根据歌词行之间的间隔动态调整弹簧效果
const MIN_INTERVAL = 100;
const MAX_INTERVAL = 800;
const MIN_STIFFNESS = 170;
const MAX_STIFFNESS = 220;
const DAMPING_MULTIPLIER = 2.2;
const INTERVAL_EXPONENT = 0.2;

/**
 * 获取歌词行纵向滚动的弹簧物理参数
 * @param isSeeking 当前是否是跳转状态
 * @param isInterludeActive 当前是否处于间奏动画状态
 * @param intervalMs 当前歌词行与上一行的时间差，若无法提供（如首尾行），传入 undefined
 * @returns 弹簧参数配置 {@link SpringParams}
 */
export function getPosYSpringPolicy(
	isSeeking: boolean,
	isInterludeActive: boolean,
	intervalMs?: number,
): Partial<SpringParams> {
	// 处于下列情况之一时，始终使用较为缓慢的弹簧参数：
	// 1. 当前处于 Seek 状态
	// 2. 当前处于间奏状态 (间奏时的间隔是 *间奏前结束的歌词* 和 *间奏结束后开始的歌词* 的时间差，非常巨大)
	// 3. 没有间隔，即处于第一句或最后一句，一般是兜底用
	if (isSeeking || isInterludeActive || intervalMs == null) {
		return {
			stiffness: SLOW_STIFFNESS,
			damping: SLOW_DAMPING,
		};
	}

	// 将间隔限制在一个合理的范围内
	const clampedInterval = Math.min(
		Math.max(intervalMs, MIN_INTERVAL),
		MAX_INTERVAL,
	);

	// 反转时间差的位置以便计算映射比例
	let ratio =
		1 - (clampedInterval - MIN_INTERVAL) / (MAX_INTERVAL - MIN_INTERVAL);

	// 开五次方根以便尽量保持较大的 ratio，偏向更快的速度
	ratio = ratio ** INTERVAL_EXPONENT;

	const targetStiffness =
		MIN_STIFFNESS + ratio * (MAX_STIFFNESS - MIN_STIFFNESS);
	const targetDamping = Math.sqrt(targetStiffness) * DAMPING_MULTIPLIER;

	return {
		stiffness: targetStiffness,
		damping: targetDamping,
	};
}
