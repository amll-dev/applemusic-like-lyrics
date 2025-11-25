import bezier from "bezier-easing";
import type { Disposable } from "../interfaces.ts";
import { getVelocity } from "./derivative";

export interface SpringParams {
	mass: number; // = 1.0
	damping: number; // = 10.0
	stiffness: number; // = 100.0
}

type seconds = number;

type CSSStyleKeys = {
	[Style in keyof CSSStyleDeclaration]: Style extends string
		? CSSStyleDeclaration[Style] extends string
			? Style
			: never
		: never;
}[keyof CSSStyleDeclaration];

/**
 * 基于 Web Animation API 的弹簧动画工具类，效果上可能逊于实时演算的版本
 */
export class WebAnimationSpring extends EventTarget implements Disposable {
	private currentAnimation: Animation;
	private targetPosition = 0;
	private isStatic = true;
	private currentSolver: (t: seconds) => number = () => this.targetPosition;
	private getV: (t: seconds) => number = () => 0;

	constructor(
		private element: HTMLElement,
		private styleName: CSSStyleKeys,
		private valueGenerator: (value: number) => string,
		private currentPosition = 0,
	) {
		super();
		this.targetPosition = currentPosition;
		this.currentAnimation = element.animate(
			[
				{
					[styleName]: valueGenerator(currentPosition),
				},
			],
			{
				duration: 1000,
				fill: "both",
				composite: "add",
			},
		);
	}

	makeStatic() {
		this.getV = () => 0;
		this.currentSolver = () => this.targetPosition;
		this.currentAnimation.cancel();
		this.currentAnimation = this.element.animate(
			[
				{
					[this.styleName]: this.valueGenerator(this.targetPosition),
				},
				{
					[this.styleName]: this.valueGenerator(this.targetPosition),
				},
			],
			{
				duration: Number.POSITIVE_INFINITY,
				id: `wa-spring-static-${this.styleName}`,
				fill: "both",
				easing: "cubic-bezier(0.5, 0, 0.5, 1)",
				composite: "add",
			},
		);
		this.currentAnimation.pause();
	}

	setTargetPosition(targetPosition: number) {
		this.targetPosition = targetPosition;
		this.onStepFinished();
	}

	getCurrentPosition() {
		if (this.isStatic || !this.currentAnimation.effect)
			return this.currentPosition;

		const timing = this.currentAnimation.effect?.getComputedTiming();
		return this.currentSolver(timing.progress ?? 1);
	}

	getCurrentVelocity() {
		if (this.isStatic || !this.currentAnimation.effect) return 0;

		const timing = this.currentAnimation.effect?.getComputedTiming();
		return this.getV(timing.progress ?? 1);
	}

	private onStepFinished() {
		const currentPosition = this.getCurrentPosition();
		if (Math.abs(this.targetPosition - currentPosition) < 0.0001) {
			this.makeStatic();
			this.dispatchEvent(new Event("finished"));
			return;
		}
		this.currentSolver = bezier(0.5, 0, 0.5, 1);
		this.getV = getVelocity(this.currentSolver);
		this.currentAnimation.cancel();
		const delta = (this.targetPosition - currentPosition) * 1.05;
		this.currentPosition += delta;
		this.currentAnimation = this.element.animate(
			[
				{
					[this.styleName]: this.valueGenerator(currentPosition),
				},
				{
					[this.styleName]: this.valueGenerator(this.currentPosition),
				},
			],
			{
				duration: 250,
				id: `wa-spring-dynamic-${this.styleName}`,
				fill: "forwards",
				easing: "cubic-bezier(0.5, 0, 0.5, 1)",
				composite: "add",
			},
		);
		this.currentAnimation.onfinish = () => this.onStepFinished();
	}

	stop() {
		if (this.currentAnimation) {
			this.currentAnimation.cancel();
		}
	}

	dispose() {
		this.stop();
	}
}
