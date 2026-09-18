import type { HasElement } from "#interfaces";
import {
	InterludeDotsBase,
	type InterludeDotsFrame,
	type InterludeDotsSnapshot,
} from "#lyric/base/interlude-dots.ts";
import styles from "#styles/lyric-player.module.css";

/**
 * 演出时间轴与演出时钟之间允许的最大偏差（毫秒）
 *
 * 时间轴由合成线程按墙钟推进，演出时钟则跟随媒体时间，正常情况两者一致；
 * 只有在页面挂起、缓冲停顿等场合才会拉开足够大的偏差，此时才需要重新对齐
 */
const TIMELINE_SYNC_TOLERANCE_MS = 50;

/** 一场演出对应的四条合成线程动画 */
interface InterludeTimeline {
	readonly container: Animation;
	readonly dots: readonly [Animation, Animation, Animation];
}

export class InterludeDotsEl extends InterludeDotsBase implements HasElement {
	private element = document.createElement("div");
	private dot0 = document.createElement("span");
	private dot1 = document.createElement("span");
	private dot2 = document.createElement("span");
	private readonly dots = [this.dot0, this.dot1, this.dot2] as const;

	private timeline?: InterludeTimeline;

	private lastTranslate = "";
	private lastTransform = "";
	private lastOpacity = "";
	private readonly lastDotOpacities = ["", "", ""];

	constructor() {
		super();

		this.element.className = styles.interludeDots;
		this.element.appendChild(this.dot0);
		this.element.appendChild(this.dot1);
		this.element.appendChild(this.dot2);

		this.element.style.opacity = "0";
	}

	public getElement(): HTMLElement {
		return this.element;
	}

	protected override render(
		snapshot: Readonly<InterludeDotsSnapshot>,
		left: number,
		top: number,
		elapsedMs: number,
	): void {
		this.setTranslate(left, top);

		const timeline = this.timeline;
		if (timeline) {
			// 演出由时间轴在合成线程上推进，这里只负责把跑偏的时钟拽回来
			const current = Number(timeline.container.currentTime ?? 0);
			if (Math.abs(current - elapsedMs) > TIMELINE_SYNC_TOLERANCE_MS) {
				this.seekTimeline(elapsedMs);
			}
			return;
		}

		this.writeSnapshot(snapshot);
	}

	protected override onPerformanceStart(
		timeline: readonly InterludeDotsFrame[],
		elapsedMs: number,
		playing: boolean,
	): void {
		this.stopTimeline();
		if (timeline.length < 2) return;

		const last = timeline[timeline.length - 1];
		const duration = Math.max(1, last.time);

		let container: Animation;
		let dots: [Animation, Animation, Animation];
		try {
			container = this.element.animate(
				timeline.map((frame) => ({
					offset: frame.time / duration,
					transform: `scale(${frame.scale})`,
					opacity: frame.opacity,
				})),
				{ duration, easing: "linear", fill: "both" },
			);
			dots = [
				this.animateDot(this.dot0, 0, timeline, duration),
				this.animateDot(this.dot1, 1, timeline, duration),
				this.animateDot(this.dot2, 2, timeline, duration),
			];
		} catch (err) {
			// 无法使用 Web Animations API 时退回逐帧写入样式
			console.warn("应用间奏点演出时间轴发生错误", err);
			return;
		}

		// 建立后先停在当前进度，避免在演出被暂停时白白跑掉进度
		container.currentTime = elapsedMs;
		container.pause();
		for (const dot of dots) {
			dot.currentTime = elapsedMs;
			dot.pause();
		}

		this.timeline = { container, dots };
		this.onPlaybackStateChange(playing);
	}

	protected override onPerformanceEnd(): void {
		this.stopTimeline();
	}

	protected override onPlaybackStateChange(playing: boolean): void {
		const timeline = this.timeline;
		if (!timeline) return;

		for (const animation of [timeline.container, ...timeline.dots]) {
			if (playing) {
				// 已经播完的动画再调用 play() 会从头重播，需要先排除
				const duration = Number(
					animation.effect?.getComputedTiming().endTime ?? 0,
				);
				if (Number(animation.currentTime ?? 0) < duration) animation.play();
			} else {
				animation.pause();
			}
		}
	}

	protected override onFadeOut(
		snapshot: Readonly<InterludeDotsSnapshot>,
	): void {
		// 先写入静态样式再取消时间轴，取消后静态样式即刻接管，不会闪出一帧旧值
		this.writeSnapshot(snapshot);
		this.stopTimeline();
	}

	private animateDot(
		dot: HTMLElement,
		index: number,
		timeline: readonly InterludeDotsFrame[],
		duration: number,
	): Animation {
		return dot.animate(
			timeline.map((frame) => ({
				offset: frame.time / duration,
				opacity: frame.dotOpacities[index],
			})),
			{ duration, easing: "linear", fill: "both" },
		);
	}

	private seekTimeline(elapsedMs: number): void {
		const timeline = this.timeline;
		if (!timeline) return;
		timeline.container.currentTime = elapsedMs;
		for (const dot of timeline.dots) dot.currentTime = elapsedMs;
	}

	private stopTimeline(): void {
		const timeline = this.timeline;
		if (!timeline) return;
		this.timeline = undefined;
		timeline.container.cancel();
		for (const dot of timeline.dots) dot.cancel();
	}

	private setTranslate(left: number, top: number): void {
		const translate = `${left.toFixed(2)}px ${top.toFixed(2)}px`;
		if (this.lastTranslate === translate) return;
		this.lastTranslate = translate;
		this.element.style.translate = translate;
	}

	private writeSnapshot(snapshot: Readonly<InterludeDotsSnapshot>): void {
		const transform = `scale(${snapshot.scale.toFixed(4)})`;
		if (this.lastTransform !== transform) {
			this.lastTransform = transform;
			this.element.style.transform = transform;
		}

		const opacity = snapshot.opacity.toFixed(3);
		if (this.lastOpacity !== opacity) {
			this.lastOpacity = opacity;
			this.element.style.opacity = opacity;
		}

		for (const [index, dot] of this.dots.entries()) {
			const value = snapshot.dotOpacities[index].toFixed(3);
			if (this.lastDotOpacities[index] === value) continue;
			this.lastDotOpacities[index] = value;
			dot.style.opacity = value;
		}
	}

	public override dispose(): void {
		this.stopTimeline();
		super.dispose();
		this.element.remove();
	}
}
