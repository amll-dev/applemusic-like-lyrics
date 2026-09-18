import bezier from "bezier-easing";
import type { Disposable } from "#interfaces";
import { clamp01 } from "#utils/clamp.ts";
import { Spring } from "#utils/spring.ts";
import { Duration, MediaTime } from "#utils/time.ts";

//#region 类型定义
/**
 * 间奏点在特定时刻的渲染快照
 */
export interface InterludeDotsSnapshot {
	/**
	 * 动画是否仍处于活跃状态
	 */
	readonly isActive: boolean;

	/**
	 * 三颗圆点各自的不透明度
	 */
	readonly dotOpacities: readonly [number, number, number];

	/**
	 * 容器缩放值
	 */
	readonly scale: number;

	/**
	 * 容器整体不透明度
	 */
	readonly opacity: number;
}

/**
 * 内部复用的可变快照
 *
 * 对外暴露的 {@link InterludeDotsSnapshot} 是只读的，但基类需要逐帧改写同一份对象
 */
type MutableSnapshot = {
	isActive: boolean;
	dotOpacities: [number, number, number];
	scale: number;
	opacity: number;
};

/**
 * 间奏点演出时间轴上的一个采样点
 *
 * 采样自 {@link InterludeDotsBase.sampleTimeline}，用于交给 Web Animations API
 * 在合成线程上推进整段演出
 */
export interface InterludeDotsFrame {
	/** 距演出时间锚点的相对时间，单位为毫秒 */
	readonly time: number;
	/** 容器缩放值 */
	readonly scale: number;
	/** 容器整体不透明度 */
	readonly opacity: number;
	/** 三颗圆点各自的不透明度 */
	readonly dotOpacities: readonly [number, number, number];
}

/**
 * 演出的时间编排
 *
 * 由 {@link InterludeDotsBase.setInterlude} 一次性确定，此后的逐帧演算与
 * 时间轴采样都只依赖这份编排
 */
interface InterludeSchedule {
	mode: PerformingMode;
	delayEndMs: number;
	bodyEndMs: number;
	totalEndMs: number;
	breathePeriodMs: number;
	segmentMs: number;
	dot3DurationMs: number;
	dot3Target: number;
}

/**
 * 间奏点演出的生命周期阶段
 * - `idle`: 无演出，不推进时钟也不渲染
 * - `performing`: 演出进行中，媒体时钟随帧间隔推进
 * - `fading`: 淡出收尾，媒体时钟冻结，仅容器不透明度继续衰减
 */
type InterludePhase = "idle" | "performing" | "fading";

/**
 * 演出进行中的编排方式
 *
 * 仅在阶段为 `performing` 期间有意义
 * - `breathe`: 完整呼吸循环与三段式点亮
 * - `fallback-hold`: 主体时长不足 `FALLBACK_HOLD_THRESHOLD_MS`（3s）时降级为进退场与常态高亮
 */
type PerformingMode = "breathe" | "fallback-hold";

const DOT3_TRAILING_MS = 750;
const EXIT_PHASE1_MS = 750;
const EXIT_PHASE2_MS = 250;
const EXIT_TOTAL_MS = EXIT_PHASE1_MS + EXIT_PHASE2_MS;
const EXIT_FADE_MS = 250;
const DISMISS_FADE_MS = 150;

/**
 * 非前奏或 Seek 时的入场延迟
 *
 * 用于给歌词行上移或跳转排版腾出视觉缓冲时间
 */
const ENTER_HOLD_MS = 500;

const ENTER_FADE_MS = 180;
const DOT_ENTER_FADE_MS = 750;
const DOT_ENTER_STAGGER_MS = 80;
/**
 * 三颗圆点错峰完全淡入所需的时长 (80 * 2 + 750 = 910ms)
 */
const DOT_ENTER_TOTAL_MS = (3 - 1) * DOT_ENTER_STAGGER_MS + DOT_ENTER_FADE_MS;

const BREATHE_BASE_PERIOD_MS = 4000;
const FALLBACK_HOLD_THRESHOLD_MS = 3000;
const BREATHE_MAX_SCALE = 1.25;
const BREATHE_MIN_SCALE = 0.4;

const DOT_INACTIVE_OPACITY = 0.2;
const DOT_ACTIVE_OPACITY = 0.9;
const DOT_COUNT = 3;

/**
 * 时间轴采样间隔（毫秒）
 *
 * 演算曲线都很平缓，60Hz 采样后经线性插值还原，肉眼已无法分辨与逐帧演算的差异
 */
const TIMELINE_SAMPLE_INTERVAL_MS = 1000 / 60;

/** 单条时间轴的关键帧上限，防止超长间奏生成过多关键帧 */
const TIMELINE_MAX_FRAMES = 600;

const lightingEasing = bezier(0.56, 0.01, 0.45, 1);
const enterFadeEasing = bezier(0.59, 0.02, 0.07, 1);
const exitPhase1Easing = bezier(0.14, 0.06, 0.25, 1);
const exitPhase2Easing = bezier(0.29, 0.03, 1, 0.38);
const exitFadeEasing = bezier(0.43, 0.08, 0.83, 0.31);

/**
 * 间奏消失时派发的合成快照，用于让子类收起渲染物
 */
const HIDDEN_SNAPSHOT: Readonly<InterludeDotsSnapshot> = {
	isActive: false,
	dotOpacities: [0, 0, 0],
	scale: 1,
	opacity: 0,
};
//#endregion

export abstract class InterludeDotsBase implements Disposable {
	//#region 演出状态
	private left = 0;
	private top = 0;
	public readonly posY: Spring = new Spring(0);
	/**
	 * 下一次设置变换位置时是否直接吸附到目标位置
	 *
	 * 演出重建或位置跳变时新旧坐标可能相距很远，走弹簧会看到间奏点从旧位置滑入的残影
	 */
	private shouldSnapPosY = true;

	private currentTime: MediaTime = MediaTime.ZERO;
	private playing = true;
	private phase: InterludePhase = "idle";
	private fadeElapsedMs = 0;
	private fadeInitialOpacity = 0;
	private startTime: MediaTime = MediaTime.ZERO;
	private endTime: MediaTime = MediaTime.ZERO;
	private anchorTime: MediaTime = MediaTime.ZERO;

	private schedule: InterludeSchedule = {
		mode: "breathe",
		delayEndMs: 0,
		bodyEndMs: 0,
		totalEndMs: 0,
		breathePeriodMs: BREATHE_BASE_PERIOD_MS,
		segmentMs: 0,
		dot3DurationMs: 0,
		dot3Target: 0,
	};

	private readonly snapshot: MutableSnapshot = {
		isActive: true,
		dotOpacities: [0, 0, 0],
		scale: 1,
		opacity: 0,
	};
	//#endregion

	//#region 外部 API
	/**
	 * 设置间奏区间并锚定演出时间
	 *
	 * @param interlude 间奏起止时间
	 * @param currentTime 当前播放时间，用于把演出重锚到该时刻；未传入时使用间奏起点
	 * @param forceReset 是否强制重建演出，如跳转播放进度或重建歌词视图时
	 * @param anchorLineIndex 间奏锚定的歌词行索引
	 * @returns 本次间奏是否有足够时长显示间奏点
	 */
	public setInterlude(
		interlude: [MediaTime, MediaTime],
		currentTime?: MediaTime,
		forceReset = false,
		anchorLineIndex = 0,
	): boolean {
		const [startTime, endTime] = interlude;
		const isSameInterlude =
			this.startTime === startTime && this.endTime === endTime;

		// 非 Seek、仍处于同一间奏区间且未处于淡出过程中时，直接返回当前展示状态
		if (!forceReset && isSameInterlude && this.phase !== "fading") {
			return this.phase === "performing";
		}

		this.cancelFadeOut();
		this.startTime = startTime;
		this.endTime = endTime;
		this.currentTime = currentTime ?? startTime;

		const schedule = this.schedule;

		// 确定时间锚点与入场延迟
		if (forceReset) {
			this.anchorTime = this.currentTime;
			schedule.delayEndMs = ENTER_HOLD_MS;
		} else {
			this.anchorTime = startTime;
			schedule.delayEndMs = anchorLineIndex === -1 ? 0 : ENTER_HOLD_MS;
		}

		// 计算剩余可用时长
		const remainingMs = Math.max(
			0,
			Duration.asMillis(MediaTime.since(endTime, this.anchorTime)),
		);
		const bodyMs = remainingMs - schedule.delayEndMs - EXIT_TOTAL_MS;

		if (bodyMs < DOT_ENTER_TOTAL_MS) {
			// 连进退场都不足以支撑，直接隐藏
			this.hidePerformance();
			return false;
		}

		schedule.bodyEndMs = schedule.delayEndMs + bodyMs;
		schedule.totalEndMs = schedule.bodyEndMs + EXIT_TOTAL_MS;

		if (bodyMs < FALLBACK_HOLD_THRESHOLD_MS) {
			// 降级为进退场与常态高亮
			schedule.mode = "fallback-hold";
			schedule.dot3Target = 1.0;
		} else {
			// 正常播放，基于 bodyMs 重新编排
			schedule.mode = "breathe";
			const breatheCycles = Math.max(
				1,
				Math.floor(bodyMs / BREATHE_BASE_PERIOD_MS),
			);
			schedule.breathePeriodMs = bodyMs / breatheCycles;
			schedule.segmentMs = Math.round((bodyMs + DOT3_TRAILING_MS) / DOT_COUNT);
			schedule.dot3DurationMs = bodyMs - schedule.segmentMs * 2;
			schedule.dot3Target = schedule.dot3DurationMs / schedule.segmentMs;
		}

		this.enterPerforming();

		return true;
	}

	/**
	 * 清空间奏区间并终止当前演出
	 *
	 * 与 {@link dismiss} 的区别在于本方法会一并抹去区间状态，
	 * 使此后重新进入同一间奏区间时能够重新演出
	 *
	 * @param immediate 是否立即隐藏而非淡出
	 */
	public clearInterlude(immediate = false): void {
		this.startTime = MediaTime.ZERO;
		this.endTime = MediaTime.ZERO;
		this.dismiss(immediate);
	}

	/**
	 * 结束间奏点演出，默认使用 150ms 淡出
	 * @param immediate 是否立即隐藏
	 */
	public dismiss(immediate = false): void {
		if (this.phase === "idle") {
			return;
		}

		if (immediate || !this.playing) {
			this.cancelFadeOut();
			this.hidePerformance();
			return;
		}

		if (this.phase === "fading") {
			return;
		}

		if (this.snapshot.opacity <= 0) {
			this.hidePerformance();
			return;
		}

		this.enterFading();
	}

	/**
	 * 设置间奏点的变换位置并立即刷新一次
	 * @param left 横向位置
	 * @param top 纵向位置
	 * @param immediate 是否绕过弹簧直接跳转到目标位置，用于触摸拖动等需要跟手的场景
	 */
	public setTransform(
		left: number = this.left,
		top: number = this.top,
		immediate = false,
	): void {
		this.left = left;
		this.top = top;

		// 演出进行中或正在淡出时允许弹簧平滑移动
		const shouldAnimate =
			!immediate && this.phase !== "idle" && !this.shouldSnapPosY;

		if (shouldAnimate) {
			this.posY.setTargetPosition(top);
		} else {
			this.shouldSnapPosY = false;
			this.posY.setPosition(top);
		}

		this.update();
	}

	public pause(): void {
		this.playing = false;
		this.onPlaybackStateChange(false);
		if (this.phase === "fading") {
			this.hidePerformance();
		}
	}

	public resume(): void {
		this.playing = true;
		this.onPlaybackStateChange(true);
	}

	/**
	 * 把演出时钟对齐到指定的媒体时间，由宿主每次推送播放进度时调用
	 */
	public syncClock(time: MediaTime): void {
		this.currentTime = time;
	}

	/**
	 * 逐帧推进演出并把当前帧交给子类渲染
	 * @param delta 距离上一次调用的物理时长
	 */
	public update(delta: Duration = Duration.ZERO): void {
		if (this.phase === "idle") return;

		if (this.phase === "fading") {
			this.updateFadeOut(delta);
			return;
		}

		if (this.playing) {
			this.currentTime = MediaTime.add(this.currentTime, delta);
		}

		const elapsed = Duration.max(
			Duration.ZERO,
			MediaTime.since(this.currentTime, this.anchorTime),
		);

		const snapshot = this.resolveSnapshot(elapsed);
		this.posY.update(delta);
		this.render(
			snapshot,
			this.left,
			this.posY.getCurrentPosition(),
			Duration.asMillis(elapsed),
		);

		if (!snapshot.isActive) {
			this.enterIdle();
			this.onPerformanceEnd();
		}
	}

	/**
	 * 把整段演出采样成一条时间轴
	 *
	 * 采样直接复用 {@link resolveFrame}，因此时间轴上的每一帧与逐帧演算完全一致，
	 * 子类可以把它整条交给 Web Animations API，让演出改由合成线程推进
	 *
	 * @returns 从演出锚点到结束的关键帧，时间戳升序且首帧恒为 0
	 */
	public sampleTimeline(): readonly InterludeDotsFrame[] {
		const schedule = this.schedule;
		const totalMs = schedule.totalEndMs;
		if (totalMs <= 0) return [];

		// 快速过场的转折点单独补点，避免线性插值把短促的渐变拉平
		const boundaries = [
			schedule.delayEndMs,
			schedule.delayEndMs + ENTER_FADE_MS,
			schedule.bodyEndMs,
			schedule.bodyEndMs + EXIT_PHASE1_MS,
			schedule.bodyEndMs + EXIT_TOTAL_MS - EXIT_FADE_MS,
		];

		const step = Math.max(
			TIMELINE_SAMPLE_INTERVAL_MS,
			totalMs / TIMELINE_MAX_FRAMES,
		);
		const times = [0];
		for (let time = step; time < totalMs; time += step) times.push(time);
		for (const boundary of boundaries) {
			if (boundary > 0 && boundary < totalMs) times.push(boundary);
		}
		times.push(totalMs);
		times.sort((a, b) => a - b);

		const scratch: MutableSnapshot = {
			isActive: true,
			dotOpacities: [0, 0, 0],
			scale: 1,
			opacity: 0,
		};
		const frames: InterludeDotsFrame[] = [];
		let previous = Number.NEGATIVE_INFINITY;
		for (const time of times) {
			if (time - previous < 0.01) continue;
			previous = time;
			resolveFrame(schedule, time, scratch);
			frames.push({
				time,
				scale: scratch.scale,
				opacity: scratch.opacity,
				dotOpacities: [
					scratch.dotOpacities[0],
					scratch.dotOpacities[1],
					scratch.dotOpacities[2],
				],
			});
		}
		return frames;
	}

	/**
	 * 释放演出状态
	 */
	public dispose(): void {
		this.dismiss(true);
	}
	//#endregion

	//#region 子类契约
	/**
	 * 由子类实现的渲染逻辑
	 *
	 * 快照对象会被基类逐帧复用，必须在当前帧内消费完毕，不得保留其引用
	 *
	 * `isActive` 为 `false` 时表示演出已经结束或取消，应当隐藏渲染物
	 *
	 * @param snapshot 当前帧的视觉状态
	 * @param left 由 {@link setTransform} 设置的横向位置
	 * @param top 由 {@link setTransform} 设置的纵向位置经 {@link posY} 平滑后的坐标
	 * @param elapsedMs 当前帧距演出锚点的相对时间，子类可据此把外部动画对齐到演出时钟
	 */
	protected abstract render(
		snapshot: Readonly<InterludeDotsSnapshot>,
		left: number,
		top: number,
		elapsedMs: number,
	): void;

	/**
	 * 演出开始（含 Seek 后重建）时调用
	 *
	 * 子类可据此把 {@link sampleTimeline} 采出的关键帧交给 Web Animations API，
	 * 让整段演出改由合成线程推进，从而免去逐帧样式写入
	 *
	 * @param timeline 整段演出的关键帧
	 * @param elapsedMs 演出应当从此相对时间开始播放
	 * @param playing 当前是否处于播放状态
	 */
	protected onPerformanceStart(
		_timeline: readonly InterludeDotsFrame[],
		_elapsedMs: number,
		_playing: boolean,
	): void {}

	/**
	 * 演出结束或被取消时调用，子类应停止并释放时间轴
	 */
	protected onPerformanceEnd(): void {}

	/**
	 * 播放或暂停状态变化时调用，子类应同步时间轴的播放状态
	 */
	protected onPlaybackStateChange(_playing: boolean): void {}

	/**
	 * 演出淡出开始时调用
	 *
	 * 子类应停止时间轴，并把传入快照固化为静态样式——淡出由基类逐帧推进，
	 * 期间不再有合成线程动画参与
	 */
	protected onFadeOut(_snapshot: Readonly<InterludeDotsSnapshot>): void {}
	//#endregion

	//#region 状态转移
	/**
	 * 进入演出阶段
	 *
	 * 演出重建后的第一帧位置由外部重新给出，不参与弹簧过渡，
	 * 因此一并重置 {@link shouldSnapPosY}
	 */
	private enterPerforming(): void {
		this.phase = "performing";
		// 演出重建后的第一帧位置由外部重新给出，不参与弹簧过渡，因此一并重置 shouldSnapPosY
		this.shouldSnapPosY = true;
		this.onPerformanceStart(
			this.sampleTimeline(),
			this.getElapsedMs(),
			this.playing,
		);
	}

	/**
	 * 进入淡出阶段，冻结当前帧的不透明度作为衰减起点
	 */
	private enterFading(): void {
		this.fadeElapsedMs = 0;
		this.fadeInitialOpacity = this.snapshot.opacity;
		this.phase = "fading";
		this.onFadeOut(this.snapshot);
	}

	/**
	 * 结束演出，回到既不推进时钟也不渲染的静止状态
	 */
	private enterIdle(): void {
		this.phase = "idle";
	}

	/**
	 * 取消正在进行的淡出
	 *
	 * 只清掉淡出阶段，演出阶段保持原样，随后的收尾仍需据此判断
	 * 是否有可见内容要派发隐藏快照
	 */
	private cancelFadeOut(): void {
		if (this.phase === "fading") {
			this.enterIdle();
		}
	}

	/**
	 * 当前帧距演出锚点的相对时间（毫秒）
	 */
	private getElapsedMs(): number {
		return Duration.asMillis(
			Duration.max(
				Duration.ZERO,
				MediaTime.since(this.currentTime, this.anchorTime),
			),
		);
	}

	/**
	 * 演出被取消时立即隐藏渲染物并清空演出状态
	 */
	private hidePerformance(): void {
		const wasActive = this.phase !== "idle";
		this.enterIdle();

		if (wasActive) {
			this.onPerformanceEnd();
			this.render(
				HIDDEN_SNAPSHOT,
				this.left,
				this.posY.getCurrentPosition(),
				this.getElapsedMs(),
			);
		}
	}
	//#endregion

	//#region 时间线推导

	/**
	 * 物理淡出步进器
	 */
	private updateFadeOut(delta: Duration): void {
		this.fadeElapsedMs += Duration.asMillis(delta);
		const progress = clamp01(this.fadeElapsedMs / DISMISS_FADE_MS);

		if (progress >= 1) {
			this.hidePerformance();
			return;
		}

		// 保持进入淡出瞬间已冻结的 scale 与 dotOpacities，仅对 opacity 执行缓出衰减
		this.snapshot.opacity =
			this.fadeInitialOpacity * (1 - exitFadeEasing(progress));
		this.snapshot.isActive = true;

		this.posY.update(delta);
		this.render(
			this.snapshot,
			this.left,
			this.posY.getCurrentPosition(),
			this.getElapsedMs(),
		);
	}

	/**
	 * 按经过时间求出该时刻的视觉状态
	 *
	 * @remarks 返回的快照对象是内部复用的同一引用，必须在当前帧内消费完毕
	 * @param elapsed 距离本次演出时间锚点的经过时间
	 */
	private resolveSnapshot(elapsed: Duration): Readonly<InterludeDotsSnapshot> {
		resolveFrame(this.schedule, Duration.asMillis(elapsed), this.snapshot);
		return this.snapshot;
	}
	//#endregion
}

//#region 辅助函数
/**
 * 写入三颗圆点的不透明度
 *
 * 最终不透明度由点亮分数映射的透明度与各圆点的错峰入场系数相乘得到
 *
 * @param out 待写入的快照
 * @param internalMs 距演出开始的经过时间
 * @param fractions 三颗圆点各自的点亮分数（0~1）
 */
function writeDotOpacities(
	out: MutableSnapshot,
	internalMs: number,
	fractions: readonly [number, number, number],
): void {
	out.dotOpacities[0] = dotOpacity(fractions[0]) * dotEnterAlpha(0, internalMs);
	out.dotOpacities[1] = dotOpacity(fractions[1]) * dotEnterAlpha(1, internalMs);
	out.dotOpacities[2] = dotOpacity(fractions[2]) * dotEnterAlpha(2, internalMs);
}

/**
 * 按经过时间求出该时刻的视觉状态并写入 `out`
 *
 * 演出编排一旦确定，任一时刻的数值就是纯粹的推导结果，因此逐帧演算与
 * 时间轴采样共用本函数，保证两条路径渲染出的画面完全一致
 *
 * @param schedule 演出的时间编排
 * @param elapsedMs 距演出时间锚点的相对时间
 * @param out 待写入的快照
 */
function resolveFrame(
	schedule: InterludeSchedule,
	elapsedMs: number,
	out: MutableSnapshot,
): void {
	if (elapsedMs >= schedule.totalEndMs) {
		out.isActive = false;
		out.scale = 1;
		out.opacity = 0;
		out.dotOpacities[0] = 0;
		out.dotOpacities[1] = 0;
		out.dotOpacities[2] = 0;
		return;
	}

	out.isActive = true;

	// 入场延迟等待阶段：处于占位但完全透明
	if (elapsedMs < schedule.delayEndMs) {
		out.opacity = 0;
		out.scale = 1;
		out.dotOpacities[0] = 0;
		out.dotOpacities[1] = 0;
		out.dotOpacities[2] = 0;
		return;
	}

	const internalMs = elapsedMs - schedule.delayEndMs;
	const fractionAt = (startDelay: number, duration: number, target: number) =>
		computeDotFraction(startDelay, duration, internalMs, target);

	/*
	 * 退场阶段 [bodyEndMs, totalEndMs)
	 *
	 * 退场分为两个阶段：
	 * 1. 快速放大以蓄力
	 * 2. 快速缩小并渐隐
	 *
	 * 第三颗圆点也在此补亮剩余的亮度
	 */
	if (elapsedMs >= schedule.bodyEndMs) {
		const exitElapsedMs = elapsedMs - schedule.bodyEndMs;

		// 在最后 EXIT_FADE_MS 执行退场渐隐，蓄力阶段保持不透明
		const fadeT = clamp01(
			(exitElapsedMs - (EXIT_TOTAL_MS - EXIT_FADE_MS)) / EXIT_FADE_MS,
		);
		out.opacity = enterOpacity(internalMs) * (1 - exitFadeEasing(fadeT));

		// 放大蓄力（1.0 -> BREATHE_MAX_SCALE）
		if (exitElapsedMs < EXIT_PHASE1_MS) {
			out.scale =
				1 +
				exitPhase1Easing(exitElapsedMs / EXIT_PHASE1_MS) *
					(BREATHE_MAX_SCALE - 1);
		} else {
			// 快速缩小（BREATHE_MAX_SCALE -> BREATHE_MIN_SCALE）
			const phase2T = clamp01(
				(exitElapsedMs - EXIT_PHASE1_MS) / EXIT_PHASE2_MS,
			);
			out.scale =
				BREATHE_MAX_SCALE -
				exitPhase2Easing(phase2T) * (BREATHE_MAX_SCALE - BREATHE_MIN_SCALE);
		}

		// breath 下前两颗圆点在 body 结束时已点满，第三颗以 750ms 补齐剩余亮度；
		// fallback-hold 下 dot3Target 为 1.0，计算自然退化为恒定全亮
		const trailing = clamp01(exitElapsedMs / DOT3_TRAILING_MS);

		writeDotOpacities(out, internalMs, [
			1,
			1,
			schedule.dot3Target + (1 - schedule.dot3Target) * trailing,
		]);

		return;
	}

	/*
	 * 主演出阶段 [delayEndMs, bodyEndMs)
	 *
	 * 入场分为两个部分，同时与容器周期呼吸缩放并行推进：
	 * 1. 整个容器以 180ms 渐入
	 * 2. 三个圆点错峰 750ms 依次点亮
	 */
	out.opacity = enterOpacity(internalMs);

	if (schedule.mode === "fallback-hold") {
		// 缩放恒为 1.0，三颗圆点各自保留 80ms 错峰淡入至全亮，随后维持全亮
		out.scale = 1;
		writeDotOpacities(out, internalMs, [1, 1, 1]);
		return;
	}

	const cycleT =
		(internalMs % schedule.breathePeriodMs) / schedule.breathePeriodMs;
	const progress = breathingProgress(cycleT);
	out.scale =
		progress <= 0.5
			? 1 + (progress / 0.5) * (BREATHE_MAX_SCALE - 1)
			: BREATHE_MAX_SCALE - ((progress - 0.5) / 0.5) * (BREATHE_MAX_SCALE - 1);

	// 三颗圆点依次开始点亮，前两颗全亮，第三颗只点亮部分，剩余由退场动画进行补充
	writeDotOpacities(out, internalMs, [
		fractionAt(0, schedule.segmentMs, 1),
		fractionAt(schedule.segmentMs, schedule.segmentMs, 1),
		fractionAt(
			schedule.segmentMs * 2,
			schedule.dot3DurationMs,
			schedule.dot3Target,
		),
	]);
}

/**
 * 容器呼吸式缩放的曲线
 */
function breathingProgress(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	const angle = 4.0 * Math.PI * t;
	const s = Math.sin(angle);
	const c = Math.cos(angle);
	return t - 0.084 * s + 0.008 * (1 - c) + 0.0046 * s * (c - s);
}

/**
 * 将点亮分数（0~1）映射为圆点透明度，在未点亮与全亮之间线性插值
 */
function dotOpacity(fraction: number): number {
	return (
		DOT_INACTIVE_OPACITY +
		(DOT_ACTIVE_OPACITY - DOT_INACTIVE_OPACITY) * clamp01(fraction)
	);
}

/**
 * 容器行的入场淡入系数
 *
 * 演出开始后的前 `ENTER_FADE_MS` 内从 0 升到 1，之后恒为 1
 */
function enterOpacity(internalMs: number): number {
	return enterFadeEasing(clamp01(internalMs / ENTER_FADE_MS));
}

/**
 * 某颗圆点的入场淡入系数
 *
 * 每颗圆点使用 `DOT_ENTER_STAGGER_MS` 错峰淡入，各自在 `DOT_ENTER_FADE_MS`
 * 内从 0 升到 1
 *
 * @param index 圆点序号（0 起），决定错峰延迟
 * @param internalMs 距演出开始的经过时间
 */
function dotEnterAlpha(index: number, internalMs: number): number {
	const t = clamp01(
		(internalMs - index * DOT_ENTER_STAGGER_MS) / DOT_ENTER_FADE_MS,
	);
	return t * t;
}

/**
 * 计算单颗圆点在给定时刻的点亮分数
 *
 * @param startDelay 该圆点的开始延迟（依次为 0、segment、2 * segment）
 * @param duration 该圆点的点亮时长（圆点 3 应短于前两颗）
 * @param internalMs 距演出开始的经过时间
 * @param target 点亮完成目标
 */
function computeDotFraction(
	startDelay: number,
	duration: number,
	internalMs: number,
	target: number,
): number {
	if (internalMs <= startDelay) return 0;
	const localT = (internalMs - startDelay) / duration;
	return lightingEasing(clamp01(localT)) * target;
}
//#endregion
