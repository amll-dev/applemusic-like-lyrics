import type { InterludeDots } from "#lyric/base/interlude-dots.ts";
import styles from "#styles/lyric-player.module.css";
import { clamp, clamp01, clampPositive } from "#utils/clamp.ts";

/**
 * 带过冲回弹的缓动，用于结束阶段的收缩演出
 */
function easeInOutBack(x: number): number {
	const c1 = 1.70158;
	const c2 = c1 * 1.525;

	return x < 0.5
		? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
		: ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

/**
 * 起步急促并按指数收敛的缓动，用于入场阶段的放大演出
 */
function easeOutExpo(x: number): number {
	return x === 1 ? 1 : 1 - 2 ** (-10 * x);
}

const TARGET_BREATHE_DURATION = 1500;

/**
 * 间奏点的 DOM 渲染实现
 *
 * 负责在间奏区间内渲染三个圆点，并根据播放进度演出入场放大、
 * 正弦呼吸缩放、逐点点亮与结束回弹收缩等动画
 */
export class InterludeDotsEl implements InterludeDots {
	private element: HTMLElement = document.createElement("div");
	private dot0: HTMLElement = document.createElement("span");
	private dot1: HTMLElement = document.createElement("span");
	private dot2: HTMLElement = document.createElement("span");
	private left = 0;
	private top = 0;
	private lastStyle = "";

	private currentTime = 0;
	private playing = true;

	/**
	 * 当前的动画时间区间 `[动画起点, 结束时间]`
	 * @remarks 起点是重新锚定后的动画起点，与间奏的真实开始时间可能不同
	 */
	private currentInterlude?: [number, number];

	constructor() {
		this.element.className = styles.interludeDots;
		this.element.appendChild(this.dot0);
		this.element.appendChild(this.dot1);
		this.element.appendChild(this.dot2);
	}

	public getElement(): HTMLElement {
		return this.element;
	}

	public setTransform(left: number = this.left, top: number = this.top): void {
		this.left = left;
		this.top = top;
		this.update();
	}

	/**
	 * 设置间奏点动画区间并重新锚定时间
	 * @param interlude 间奏起止时间
	 * @param currentTime 当前播放时间
	 * @param forceReset 是否强制重置动画起点，如 Seek、重新布局或切换间奏时
	 */
	public setInterlude(
		interlude?: [number, number],
		currentTime?: number,
		forceReset = false,
	): void {
		if (!interlude) {
			this.currentInterlude = undefined;
			this.element.classList.remove(styles.enabled);
			return;
		}

		const endTime = interlude[1];
		const now = currentTime ?? interlude[0];

		// 需要重新锚定动画起点的情况：
		// 1. 显式指定 forceReset (Seek 或重新排版)
		// 2. 切换到了新的间奏区间
		// 3. 当前组件未在启用状态
		const isNewInterlude =
			!this.currentInterlude || this.currentInterlude[1] !== endTime;
		const shouldReset = forceReset || isNewInterlude;

		if (shouldReset) {
			// 将动画起点设为 now，结束时间设为 endTime
			// currentDuration 将从 0 开始重新计算，让动画时长匹配剩余时间
			this.currentInterlude = [now, endTime];
			this.currentTime = now;
		}

		this.element.classList.add(styles.enabled);
	}

	public pause(): void {
		this.playing = false;
		this.element.classList.remove(styles.playing);
	}

	public resume(): void {
		this.playing = true;
		this.element.classList.add(styles.playing);
	}

	/**
	 * 逐帧推进间奏点动画并写入样式
	 *
	 * 动画按播放进度分为三个阶段：
	 * 1. 入场 (前 2 秒)：以 easeOutExpo 从零放大，前 500ms 完全隐藏、500ms~1s 线性渐入
	 * 2. 持续：正弦呼吸缩放，三个圆点随进度依次点亮
	 * 3. 结束 (最后 750ms)：以 easeInOutBack 收缩回弹，最后 375ms 渐隐
	 *
	 * @param delta 距离上一次调用的时长，单位为毫秒
	 */
	public update(delta = 0): void {
		if (!this.playing) return;
		this.currentTime += delta;
		let curStyle = "";

		curStyle += `transform:translate(${this.left.toFixed(
			2,
		)}px, ${this.top.toFixed(2)}px)`;

		// 计算缩放大小
		if (this.currentInterlude) {
			const interludeDuration =
				this.currentInterlude[1] - this.currentInterlude[0];
			const currentDuration = this.currentTime - this.currentInterlude[0];
			if (currentDuration <= interludeDuration) {
				// 将总时长按基准呼吸时长切分为整数次呼吸
				const breatheDuration =
					interludeDuration /
					Math.ceil(interludeDuration / TARGET_BREATHE_DURATION);
				let scale = 1;
				let globalOpacity = 1;

				// 正弦呼吸缩放，围绕基准值上下 ±5% 波动
				scale *=
					Math.sin(
						1.5 * Math.PI - (currentDuration / breatheDuration) * 2 * Math.PI,
					) /
						20 +
					1;

				if (currentDuration < 2000) {
					scale *= easeOutExpo(currentDuration / 2000);
				}

				if (currentDuration < 500) {
					globalOpacity = 0;
				} else if (currentDuration < 1000) {
					globalOpacity *= (currentDuration - 500) / 500;
				}

				if (interludeDuration - currentDuration < 750) {
					scale *=
						1 -
						easeInOutBack(
							(750 - (interludeDuration - currentDuration)) / 750 / 2,
						);
				}
				if (interludeDuration - currentDuration < 375) {
					globalOpacity *= clamp01((interludeDuration - currentDuration) / 375);
				}

				// 点亮阶段长度，为结束收缩预留 750ms
				const dotsDuration = clampPositive(interludeDuration - 750);

				// 收敛到非负后统一缩放到 0.7 基准
				scale = clampPositive(scale) * 0.7;

				curStyle += ` scale(${scale})`;

				// 三个圆点按进度依次点亮，各间隔 1/3 个点亮阶段，最低保持 0.25 亮度
				const dot0Opacity =
					dotsDuration > 0
						? clamp(0.25, ((currentDuration * 3) / dotsDuration) * 0.75, 1)
						: 0.25;
				const dot1Opacity =
					dotsDuration > 0
						? clamp(
								0.25,
								(((currentDuration - dotsDuration / 3) * 3) / dotsDuration) *
									0.75,
								1,
							)
						: 0.25;
				const dot2Opacity =
					dotsDuration > 0
						? clamp(
								0.25,
								(((currentDuration - (dotsDuration / 3) * 2) * 3) /
									dotsDuration) *
									0.75,
								1,
							)
						: 0.25;

				this.dot0.style.opacity = `${clamp01(globalOpacity * dot0Opacity)}`;
				this.dot1.style.opacity = `${clamp01(globalOpacity * dot1Opacity)}`;
				this.dot2.style.opacity = `${clamp01(globalOpacity * dot2Opacity)}`;
			} else {
				curStyle += " scale(0)";
				this.dot0.style.opacity = "0";
				this.dot1.style.opacity = "0";
				this.dot2.style.opacity = "0";
			}

			curStyle += ";";

			if (this.lastStyle !== curStyle) {
				this.element.setAttribute("style", curStyle);
				this.lastStyle = curStyle;
			}
		}
	}

	public dispose(): void {
		this.element.remove();
	}
}
