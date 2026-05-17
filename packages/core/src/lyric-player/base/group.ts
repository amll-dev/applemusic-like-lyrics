import type { Disposable } from "#interfaces";
import { Spring } from "#utils/spring.ts";
import { LyricLineRenderMode } from "./consts.ts";
import type { LyricLineBase } from "./line.ts";

export interface LyricPlayerFlags {
	getEnableSpring(): boolean;
	getEnableScale(): boolean;
	getIsPlaying(): boolean;
	getAlwaysPostpositionBackground(): boolean;
}

export abstract class LyricLineGroupBase<
	T extends LyricLineBase = LyricLineBase,
> implements Disposable
{
	protected abstract readonly lyricPlayer: LyricPlayerFlags;

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
		isActive: boolean,
		opacity: number,
		blur: number,
	): void {
		this.top = top;
		this.delay = delay;
		this.isActive = isActive;
		this.opacity = opacity;
		this.blur = blur;

		this.setLineTransformations(force, delay);

		const enableSpring = this.lyricPlayer.getEnableSpring();
		const alwaysPostposition =
			this.lyricPlayer.getAlwaysPostpositionBackground();
		const shouldBgFirst = alwaysPostposition ? false : this.isBgFirst;
		const hiddenSlideY = shouldBgFirst ? 80 : -80;

		const isPlaying = this.lyricPlayer.getIsPlaying();

		const targetBgSlideY = isActive || !isPlaying ? 0 : hiddenSlideY;

		if (force || !enableSpring) {
			this.posY.setPosition(top);
			this.bgSlideY.setPosition(targetBgSlideY);
			this.renderStyles();
		} else {
			this.posY.setTargetPosition(top, delay);
			this.bgSlideY.setTargetPosition(targetBgSlideY, delay);
		}
	}

	private setLineTransformations(force: boolean, delay: number) {
		const enableScale = this.lyricPlayer.getEnableScale();
		const isPlaying = this.lyricPlayer.getIsPlaying();

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
		if (this.lyricPlayer.getEnableSpring()) {
			this.posY.update(delta);
			this.bgSlideY.update(delta);
			this.renderStyles();
		}

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
