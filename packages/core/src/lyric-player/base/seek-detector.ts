import { Duration, MediaTime } from "#utils/time.ts";

/**
 * 读取单调递增的物理时钟的函数，单位为毫秒
 *
 * 默认使用 `performance.now`
 */
export type WallClock = () => number;

/**
 * 媒体时钟偏离期望推进量时的固定底限容差
 */
const JITTER_TOLERANCE = Duration.fromMillis(150);

/**
 * 媒体时钟相对于物理时钟允许的动态漂移比例
 */
const DRIFT_SLACK = 0.5;

/**
 * 单次判定所信任的最大物理时钟跨度
 */
const MAX_TRUSTED_GAP = Duration.fromMillis(800);

/**
 * 跳转状态自动推导器
 *
 * 让下游使用者只推送播放进度、无需自己判断某次进度变化是否为跳转
 *
 * 判定的思路是把本次媒体时钟的推进量与当前播放状态下它应有的推进量比较，
 * 超出容差的偏离即视为跳转。判定规则为：
 * - 进度倒退或保持不变视为跳转
 * - 播放时应有的推进量是物理时钟的推进量，容差随之按比例放宽
 * - 暂停时应有的推进量是零，容差只留固定底限
 */
export class SeekDetector {
	private readonly now: WallClock;

	private lastMediaTime: MediaTime = MediaTime.ZERO;
	private lastWallTime = 0;
	private hasBaseline = false;

	/**
	 * @param now 物理时钟读取函数，默认为 `performance.now`
	 */
	public constructor(now: WallClock = () => performance.now()) {
		this.now = now;
	}

	/**
	 * 推导本次进度变化是否为跳转
	 *
	 * @param time 下游推送的当前播放进度
	 * @param isPlaying 当前是否在播放，决定本次推送应有的推进量与容差
	 * @returns 是否应当按跳转处理
	 */
	public detect(time: MediaTime, isPlaying: boolean): boolean {
		const wall = this.now();

		// 没有基线可比，无从推导，此时不视为跳转
		//
		// 需要强制对齐的场合（重新构建歌词、页面恢复等）由调用方显式传入跳转状态，
		// 无需在这里代为判断；在这里报告跳转会让恢复播放这类本质连续的场景被当作跳转
		if (!this.hasBaseline) {
			this.rebase(time, wall);
			this.hasBaseline = true;
			return false;
		}

		// 进度不再前进，正常播放不会产生这种位置，因此按跳转处理
		if (time <= this.lastMediaTime) {
			this.rebase(time, wall);
			return true;
		}

		const mediaDelta = MediaTime.since(time, this.lastMediaTime);
		const elapsed = Duration.clampPositive(
			Duration.fromMillis(wall - this.lastWallTime),
		);
		const wallDelta = Duration.min(elapsed, MAX_TRUSTED_GAP);

		this.rebase(time, wall);

		// 暂停时进度本不该前进，因此应有的推进量是零，容差也只留固定底限，
		// 任何超过抖动幅度的前进都是跳转
		//
		// 播放时才以物理时钟应有的推进量为基准，并按其比例放宽容差，
		// 以容纳倍速播放与推送节奏的不均匀
		const expected = isPlaying ? wallDelta : Duration.ZERO;
		const tolerance = isPlaying
			? Duration.max(JITTER_TOLERANCE, Duration.mulF64(wallDelta, DRIFT_SLACK))
			: JITTER_TOLERANCE;

		const drift = Duration.sub(mediaDelta, expected);

		return drift > tolerance;
	}

	public reset(): void {
		this.hasBaseline = false;
		this.lastMediaTime = MediaTime.ZERO;
		this.lastWallTime = 0;
	}

	private rebase(time: MediaTime, wall: number): void {
		this.lastMediaTime = time;
		this.lastWallTime = wall;
	}
}
