import type { Disposable } from "#interfaces";
import { Spring } from "#utils/spring.ts";
import { LyricLineRenderMode } from "./consts.ts";
import type { LyricLineBase } from "./line.ts";

export abstract class LyricLineGroupBase<
	T extends LyricLineBase = LyricLineBase,
> implements Disposable
{
	public posY: Spring = new Spring(0);
	public bgSlideY: Spring = new Spring(-80);
	public top = 0;
	public delay = 0;

	public isActive = false;
	public opacity = 1;
	public blur = 0;

	public isBgFirst = false;

	constructor(
		public mainLine: T,
		public bgLine?: T | undefined,
	) {}

	get startTime(): number {
		// 优化歌词时 `syncMainAndBackgroundLines` 已经把时间同步好了，直接读取主歌词的即可
		// 要是用户关掉了这个优化，我们认为在这种情况下主歌词和背景人声显示不同步是符合用户预期的
		return this.mainLine.getLine().startTime;
	}

	get endTime(): number {
		return this.mainLine.getLine().endTime;
	}

	onLineSizeChange(size: [number, number]): void {
		this.mainLine.onLineSizeChange(size);
		this.bgLine?.onLineSizeChange(size);
	}

	setTransform(
		top: number,
		force: boolean,
		delay: number,
		enableSpring: boolean,
		isActive: boolean,
		opacity: number,
		blur: number,
		enableScale: boolean,
		isPlaying: boolean,
	): void {
		this.top = top;
		this.delay = delay;
		this.isActive = isActive;
		this.opacity = opacity;
		this.blur = blur;

		this.setLineTransformations(force, delay, enableScale, isPlaying);

		const hiddenSlideY = this.isBgFirst ? 80 : -80;

		if (force || !enableSpring) {
			this.posY.setPosition(top);
			this.bgSlideY.setPosition(isActive ? 0 : hiddenSlideY);
			this.renderStyles();
		} else {
			this.posY.setTargetPosition(top, delay);
			this.bgSlideY.setTargetPosition(isActive ? 0 : hiddenSlideY, delay);
		}
	}

	private setLineTransformations(
		force: boolean,
		delay: number,
		enableScale: boolean,
		isPlaying: boolean,
	) {
		const renderMode = this.isActive
			? LyricLineRenderMode.GRADIENT
			: LyricLineRenderMode.SOLID;

		const SCALE_ASPECT = enableScale ? 97 : 100;
		let mainScale = 100;
		if (!this.isActive && isPlaying) {
			mainScale = SCALE_ASPECT;
		}
		this.mainLine.setTransform(mainScale, 1, 0, force, delay, renderMode);

		let bgScale = 100;
		if (!this.isActive && isPlaying) {
			bgScale = 75;
		}
		this.bgLine?.setTransform(bgScale, 1, 0, force, delay, renderMode);
	}

	protected abstract renderStyles(): void;

	abstract get isInSight(): boolean;

	update(delta: number): void {
		this.posY.update(delta);
		this.bgSlideY.update(delta);
		this.renderStyles();

		this.mainLine.update(delta);
		this.bgLine?.update(delta);
	}

	rebuildAllLines(): void {
		this.mainLine.rebuildElement();
		this.bgLine?.rebuildElement();
	}

	enable(time?: number, shouldPlay?: boolean): void {
		this.mainLine.enable(time, shouldPlay);
		this.bgLine?.enable(time, shouldPlay);
	}

	disable(): void {
		this.mainLine.disable();
		this.bgLine?.disable();
	}

	dispose(): void {
		this.mainLine.dispose();
		this.bgLine?.dispose();
	}
}
