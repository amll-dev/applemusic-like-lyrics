/**
 * 动画的活动区间（相对于其所属歌词行起始时间，单位毫秒）
 */
export interface AnimationInterval {
	readonly start: number;
	readonly end: number;
}

const intervalCache = new WeakMap<Animation, AnimationInterval>();

/**
 * 读取动画自身的活动区间
 *
 * 动画只在活动区间内真正改变数值，区间外数值停滞不变，
 * 因此只需在区间内让它保持播放就能得到完全相同的渲染结果
 *
 * @param animation 目标动画
 * @returns 该动画的活动区间，无限循环的动画结束时间为 `Infinity`
 */
export function getAnimationInterval(animation: Animation): AnimationInterval {
	const cached = intervalCache.get(animation);
	if (cached) return cached;

	const timing = animation.effect?.getComputedTiming();
	const endTime = Number(timing?.endTime ?? 0);
	const interval: AnimationInterval = {
		start: Number(timing?.delay ?? 0),
		end: Number.isFinite(endTime) ? endTime : Number.POSITIVE_INFINITY,
	};

	intervalCache.set(animation, interval);
	return interval;
}

/**
 * 按播放进度同步单个动画的播放状态
 *
 * 只有当播放进度落在动画的活动区间内、且播放器正在播放时才让它跑起来；
 * 其余情况保持暂停，并只在其静止位置发生变化时写一次 `currentTime`，
 * 这样停滞的动画就不会每帧触发样式重算了
 *
 * @param animation 需要同步的动画
 * @param timeRelative 相对于所属歌词行起始时间的播放进度（毫秒）
 * @param isPlaying 播放器当前是否在播放
 * @param interval 活动区间，缺省时从动画自身读取
 */
export function syncAnimationPlayback(
	animation: Animation,
	timeRelative: number,
	isPlaying: boolean,
	interval: AnimationInterval = getAnimationInterval(animation),
): void {
	const before = timeRelative < interval.start;
	const inInterval = !before && timeRelative < interval.end;

	if (isPlaying && inInterval) {
		if (animation.playState !== "running") {
			animation.currentTime = timeRelative;
			animation.playbackRate = 1;
			animation.play();
		}
		return;
	}

	if (animation.playState === "running") animation.pause();

	// 区间外停在区间端点上（此时数值恒定），区间内暂停则冻结在当前进度；
	// 只在位置真的变化时才写入，避免逐帧触发样式重算
	const resting = before
		? interval.start
		: inInterval
			? timeRelative
			: interval.end;
	if (Number(animation.currentTime ?? 0) !== resting) {
		animation.currentTime = resting;
	}
}
