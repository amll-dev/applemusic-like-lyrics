import type { Disposable, HasElement } from "../../interfaces.ts";
import styles from "../../styles/lyric-player.module.css";

function easeInOutBack(x: number): number {
	const c1 = 1.70158;
	const c2 = c1 * 1.525;

	return x < 0.5
		? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
		: ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

function easeOutExpo(x: number): number {
	return x === 1 ? 1 : 1 - 2 ** (-10 * x);
}

const clamp = (min: number, cur: number, max: number) =>
	Math.max(min, Math.min(cur, max));

export class InterludeDots implements HasElement, Disposable {
	private element: HTMLElement = document.createElement("div");
	private dot0: HTMLElement = document.createElement("span");
	private dot1: HTMLElement = document.createElement("span");
	private dot2: HTMLElement = document.createElement("span");
	private left = 0;
	private top = 0;
	private playing = true;
	private lastStyle = "";
	private currentInterlude?: [number, number];
	private currentTime = 0;
	private targetBreatheDuration = 1500;
	constructor() {
		this.element.className = styles.interludeDots;
		this.element.appendChild(this.dot0);
		this.element.appendChild(this.dot1);
		this.element.appendChild(this.dot2);
	}
	getElement(): HTMLElement {
		return this.element;
	}
	setTransform(left: number = this.left, top: number = this.top): void {
		this.left = left;
		this.top = top;
		this.update();
	}
	setInterlude(interlude?: [number, number]): void {
		this.currentInterlude = interlude;
		this.currentTime = interlude?.[0] ?? 0;
		if (interlude) {
			this.element.classList.add(styles.enabled);
		} else {
			this.element.classList.remove(styles.enabled);
		}
	}
	pause(): void {
		this.playing = false;
		this.element.classList.remove(styles.playing);
	}
	resume(): void {
		this.playing = true;
		this.element.classList.add(styles.playing);
	}
	update(delta = 0): void {
		if (!this.playing) return;
		this.currentTime += delta;
		let curStyle = "";

		// 计算缩放大小

		if (this.currentInterlude) {
			const interludeDuration =
				this.currentInterlude[1] - this.currentInterlude[0];
			const currentDuration = this.currentTime - this.currentInterlude[0];
			if (currentDuration <= interludeDuration) {
				const breatheDuration =
					interludeDuration /
					Math.ceil(interludeDuration / this.targetBreatheDuration);
				let scale = 1;
				let globalOpacity = 1;

				scale *=
					Math.sin(1.5 * Math.PI - (currentDuration / breatheDuration) * 2) /
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
					globalOpacity *= clamp(
						0,
						(interludeDuration - currentDuration) / 375,
						1,
					);
				}

				const dotsDuration = Math.max(0, interludeDuration - 750);

				scale = Math.max(0, scale) * 0.7;

				curStyle += ` scale(${scale})`;

				const dot0Opacity = clamp(
					0.25,
					((currentDuration * 3) / dotsDuration) * 0.75,
					1,
				);
				const dot1Opacity = clamp(
					0.25,
					(((currentDuration - dotsDuration / 3) * 3) / dotsDuration) * 0.75,
					1,
				);
				const dot2Opacity = clamp(
					0.25,
					(((currentDuration - (dotsDuration / 3) * 2) * 3) / dotsDuration) *
						0.75,
					1,
				);

				this.dot0.style.opacity = `${clamp(
					0,
					Math.max(0, globalOpacity * dot0Opacity),
					1,
				)}`;
				this.dot1.style.opacity = `${clamp(
					0,
					Math.max(0, globalOpacity * dot1Opacity),
					1,
				)}`;
				this.dot2.style.opacity = `${clamp(
					0,
					Math.max(0, globalOpacity * dot2Opacity),
					1,
				)}`;
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
	dispose(): void {
		this.element.remove();
	}
}
