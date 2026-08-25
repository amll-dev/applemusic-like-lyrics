import type { SpringParams } from "#utils/spring.ts";

// 缓慢模式参数，适用于 Seek 状态、间奏状态、首尾边界等场景
const SLOW_STIFFNESS = 90;
const SLOW_DAMPING = 15;

// 中速模式参数，目前用于歌曲结束的场景，一般会在之后使用此参数切换到底栏
const MEDIUM_STIFFNESS = 140;
const MEDIUM_DAMPING = 22;

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
 * @param isEndOfSong 歌曲是否播放完毕
 * @returns 弹簧参数配置 {@link SpringParams}
 */
export function getPosYSpringPolicy(
	isSeeking: boolean,
	isInterludeActive: boolean,
	intervalMs?: number,
	isEndOfSong = false,
): Partial<SpringParams> {
	// Seek 和间奏使用较为缓慢的弹簧参数
	if (isSeeking || isInterludeActive) {
		return {
			stiffness: SLOW_STIFFNESS,
			damping: SLOW_DAMPING,
		};
	}

	// 歌曲播放完毕时，使用中速参数
	if (isEndOfSong) {
		return {
			stiffness: MEDIUM_STIFFNESS,
			damping: MEDIUM_DAMPING,
		};
	}

	// 没有间隔，即处于第一句或最后一句，用慢速模式兜底
	if (intervalMs == null) {
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
