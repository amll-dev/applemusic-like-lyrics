/**
 * @fileoverview
 * 基于 Web Animations API 实现的针对 DOM 的弹簧动画实现
 */

import {
	Spring as FrameSpring,
	type SpringParams,
	type SpringStyleTarget,
} from "./spring.ts";
import { Duration } from "./time.ts";

// 采样间隔（毫秒），预设 60Hz 理论配合 linear 过渡足够呈现丝滑的效果了
const SAMPLE_INTERVAL_MS = 1000 / 60;
// 单次动画的关键帧数量上限，防止极端参数下生成过多关键帧
const MAX_KEYFRAMES = 600;
// 单次动画的最长时长（秒），兜底防止参数导致永不收敛
const MAX_DURATION_SECS = 20;
// 收敛阈值
const ARRIVED_EPSILON = 0.01;
// 关键帧简化容差（像素），远小于一个设备像素，精简后肉眼无法分辨
const KEYFRAME_TOLERANCE = 0.25;

/** 弹簧轨迹上的一个采样点 */
interface Sample {
	/** 在整段动画中的时间占比 */
	offset: number;
	/** 该时刻的弹簧位置 */
	position: number;
}

/** 判定两组弹簧参数是否等价 */
function isSameParams(
	a: Partial<SpringParams>,
	b: Partial<SpringParams>,
): boolean {
	return (
		a.mass === b.mass &&
		a.damping === b.damping &&
		a.stiffness === b.stiffness &&
		a.soft === b.soft
	);
}

/**
 * 用 Douglas-Peucker 算法在容差内精简采样点
 *
 * 弹簧轨迹在起始的高速段弯曲明显，尾段则接近平直，均匀采样的点大部分是冗余的。
 * 精简后关键帧数量会大幅减少，而渲染出来的轨迹与解析解的偏差不超过容差。
 * 滚轮滚动时每个事件都会重建一次动画，因此这里的收益很直接。
 *
 * @param samples 按时间升序排列的采样点
 * @param tolerance 允许的最大位置偏差
 * @returns 保留下来的采样点下标，首尾必定保留
 */
function simplifySamples(samples: Sample[], tolerance: number): number[] {
	const count = samples.length;
	if (count <= 2) return samples.map((_, index) => index);

	const kept: boolean[] = new Array<boolean>(count).fill(false);
	kept[0] = true;
	kept[count - 1] = true;

	const pending: Array<[number, number]> = [[0, count - 1]];
	while (pending.length > 0) {
		const range = pending.pop();
		if (!range) continue;
		const [first, last] = range;
		if (last - first < 2) continue;

		const head = samples[first];
		const tail = samples[last];
		const span = tail.offset - head.offset;
		let maxDeviation = 0;
		let maxIndex = -1;
		for (let index = first + 1; index < last; index++) {
			const sample = samples[index];
			const progress = span > 0 ? (sample.offset - head.offset) / span : 0;
			const deviation = Math.abs(
				sample.position -
					(head.position + (tail.position - head.position) * progress),
			);
			if (deviation > maxDeviation) {
				maxDeviation = deviation;
				maxIndex = index;
			}
		}

		if (maxDeviation > tolerance && maxIndex !== -1) {
			kept[maxIndex] = true;
			pending.push([first, maxIndex], [maxIndex, last]);
		}
	}

	const result: number[] = [];
	for (let index = 0; index < count; index++) {
		if (kept[index]) result.push(index);
	}
	return result;
}

/**
 * 基于 Web Animation API 的弹簧实现
 *
 * 按原有算法生成关键帧交给 Web Animation API 播放，理论上可以大幅降低 CPU 占用开销
 *
 * （仅动画初始化时会计算动画效果，后续会由浏览器合成线程进行处理（也许会更流畅？））
 */
export class Spring extends FrameSpring {
	private styleTarget: SpringStyleTarget | undefined;
	private animation: Animation | undefined;
	/**
	 * 上一次写入样式的位置
	 *
	 * 弹簧收敛后 `update()` 每帧都会通过 `setPosition()` 回到同一位置，
	 * 借此跳过重复写入，避免产生逐帧样式变更
	 */
	private lastAppliedPosition: number | undefined;

	override get managesStyle(): boolean {
		const element = this.styleTarget?.element;
		return element !== undefined && typeof element.animate === "function";
	}

	override attach(target: SpringStyleTarget | undefined): void {
		if (this.styleTarget === target) return;
		this.stopAnimation();
		this.styleTarget = target;
		this.lastAppliedPosition = undefined;
		if (target) this.refresh();
	}

	override refresh(): void {
		if (!this.styleTarget) return;
		// 映射结果可能随外部量变化，必须先作废缓存再重新写入
		this.lastAppliedPosition = undefined;
		if (this.isSettledAt(this.currentTime)) {
			this.stopAnimation();
			this.applyFrame(this.currentPosition);
			return;
		}
		this.rebuildAnimation();
	}

	override setPosition(targetPosition: number): void {
		super.setPosition(targetPosition);
		this.stopAnimation();
		this.applyFrame(targetPosition);
	}

	override updateParams(
		params: Partial<SpringParams>,
		delay: Duration = Duration.ZERO,
	): void {
		// 带延迟的参数只是入队，此时弹簧状态还没有变化
		if (Duration.asSecsF64(delay) > 0) {
			super.updateParams(params, delay);
			return;
		}

		// 参数若没有真正变化，解析解也就没有变化，已有动画依然有效，
		// 不必重建关键帧（歌词行/参数变更会像流水一样频繁调用本方法）
		const changed = !isSameParams(this.params, { ...this.params, ...params });
		super.updateParams(params, delay);
		if (changed) this.refresh();
	}

	override setTargetPosition(
		targetPosition: number,
		delay: Duration = Duration.ZERO,
	): void {
		// 与基类的提前返回条件保持一致，避免目标没变时白白重建关键帧
		const willChange =
			Duration.asSecsF64(delay) > 0 ||
			Math.abs(this.targetPosition - targetPosition) >= 0.001;
		super.setTargetPosition(targetPosition, delay);
		if (willChange) this.refresh();
	}

	/**
	 * 按解析解重建整条关键帧轨迹并交给浏览器播放
	 */
	private rebuildAnimation(): void {
		const target = this.styleTarget;
		if (!target) return;

		this.stopAnimation();

		// 环境不支持 Web Animation API 时不再接管样式，交由调用方逐帧写入
		if (typeof target.element.animate !== "function") return;

		// 从当前时钟位置开始采样，保证中途重建时动画不会跳回起点
		const start = this.currentTime;
		const end = this.findSettleTime(start);
		const settled = this.isSettledAt(end);
		const durationSecs = end - start;
		const frameCount = Math.min(
			MAX_KEYFRAMES,
			Math.max(1, Math.ceil((durationSecs * 1000) / SAMPLE_INTERVAL_MS)),
		);

		// 按解析解均匀采样
		const samples: Sample[] = [];
		for (let i = 0; i <= frameCount; i++) {
			const offset = i / frameCount;
			// 末帧与逐帧实现收敛时的贴合行为保持一致
			const position =
				settled && i === frameCount
					? this.targetPosition
					: this.currentSolver(start + offset * durationSecs);
			samples.push({ offset, position });
		}

		// 精简掉在容差内属于冗余的采样点，只保留真正需要的关键帧
		const keyframes: Keyframe[] = simplifySamples(
			samples,
			KEYFRAME_TOLERANCE,
		).map((index) => {
			const sample = samples[index];
			return { offset: sample.offset, ...target.frame(sample.position) };
		});

		this.animation = target.element.animate(keyframes, {
			duration: Math.max(1, durationSecs * 1000),
			easing: "linear",
			fill: "both",
		});
	}

	/**
	 * 找到解析解收敛到目标位置的时间点
	 *
	 * 判定条件与 `arrived()` 相同，因此动画的结束时刻与逐帧实现的收敛时刻一致
	 */
	private findSettleTime(fromTime: number): number {
		const step = SAMPLE_INTERVAL_MS / 1000;
		const limit = fromTime + MAX_DURATION_SECS;
		for (let t = fromTime; t < limit; t += step) {
			if (this.isSettledAt(t)) return t;
		}
		return limit;
	}

	private isSettledAt(t: number): boolean {
		return (
			Math.abs(this.targetPosition - this.currentSolver(t)) < ARRIVED_EPSILON &&
			Math.abs(this.getV(t)) < ARRIVED_EPSILON &&
			Math.abs(this.getV2(t)) < ARRIVED_EPSILON
		);
	}

	private applyFrame(position: number): void {
		const target = this.styleTarget;
		if (!target) return;
		// 位置没变就不必重复写入，否则收敛后会退化成逐帧样式变更
		if (this.lastAppliedPosition === position) return;
		this.lastAppliedPosition = position;
		Object.assign(target.element.style, target.frame(position));
	}

	private stopAnimation(): void {
		this.animation?.cancel();
		this.animation = undefined;
	}
}
