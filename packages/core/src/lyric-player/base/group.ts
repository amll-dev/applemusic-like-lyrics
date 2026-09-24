import type { Disposable } from "#interfaces";
import { Spring } from "#utils/spring.ts";
import { Duration, MediaTime } from "#utils/time.ts";
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
	public delay: Duration = Duration.ZERO;

	public isActive = false;
	public opacity = 1;
	public blur = 0;

	public isBgFirst = false;

	/**
	 * 指示当前歌词组是否处于亮度层活跃窗口内
	 *
	 * 由排版逻辑在状态变更时计算并同步。同一组的背景行与主行索引至多相差 1，共用同一判定结果。
	 */
	public inBrightnessWindow = true;

	protected isUiDirty = true;

	constructor(
		public mainLine: T,
		public bgLine?: T | undefined,
	) {}

	get startTime(): MediaTime {
		// 优化歌词时 `syncMainAndBackgroundLines` 已经把时间同步好了，直接读取主歌词的即可
		// 要是用户关掉了这个优化，我们认为在这种情况下主歌词和背景人声显示不同步是符合用户预期的
		return MediaTime.fromMillis(this.mainLine.getLine().startTime);
	}

	get endTime(): MediaTime {
		return MediaTime.fromMillis(this.mainLine.getLine().endTime);
	}

	onLineSizeChange(size: [number, number]): void {
		this.mainLine.onLineSizeChange(size);
		this.bgLine?.onLineSizeChange(size);
	}

	onBgSizeChange?(size: [number, number]): void;

	abstract getElement(): Element;

	setTransform(
		top: number,
		immediate: boolean,
		delay: Duration,
		isActive: boolean,
		opacity: number,
		blur: number,
		inBrightnessWindow: boolean,
	): void {
		this.top = top;
		this.delay = delay;
		this.isActive = isActive;
		this.opacity = opacity;
		this.blur = blur;
		this.inBrightnessWindow = inBrightnessWindow;

		this.setLineTransformations(delay);

		const enableSpring = this.lyricPlayer.getEnableSpring();
		const alwaysPostposition =
			this.lyricPlayer.getAlwaysPostpositionBackground();
		const shouldBgFirst = alwaysPostposition ? false : this.isBgFirst;
		const hiddenSlideY = shouldBgFirst ? 80 : -80;

		const isPlaying = this.lyricPlayer.getIsPlaying();
		const targetBgSlideY = isActive || !isPlaying ? 0 : hiddenSlideY;

		if (immediate || !enableSpring) {
			this.posY.setPosition(top);
			this.bgSlideY.setPosition(targetBgSlideY);
		} else {
			this.posY.setTargetPosition(top, delay);
			this.bgSlideY.setTargetPosition(targetBgSlideY, delay);
		}

		this.isUiDirty = true;
	}

	private setLineTransformations(delay: Duration) {
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

		this.mainLine.setTransform(
			mainScale,
			1,
			0,
			delay,
			renderMode,
			this.inBrightnessWindow,
		);

		let bgScale = 100;
		if (!this.isActive && isPlaying) {
			bgScale = 75;
		}
		this.bgLine?.setTransform(
			bgScale,
			1,
			0,
			delay,
			renderMode,
			this.inBrightnessWindow,
		);
	}

	protected abstract renderStyles(): void;

	/**
	 * 根据当前动画位置判断歌词行是否处于渲染范围内
	 *
	 * @param includeOverscan 是否包含 overscan 渲染缓冲范围，默认包含；
	 * 传入 false 时，仅判断歌词行是否在真实视口范围内
	 */
	abstract isInRenderRange(includeOverscan?: boolean): boolean;

	update(delta: Duration = Duration.ZERO): void {
		if (this.lyricPlayer.getEnableSpring()) {
			const posMoving = !this.posY.arrived();
			const bgMoving = !this.bgSlideY.arrived();
			this.posY.update(delta);
			this.bgSlideY.update(delta);

			if (posMoving || bgMoving) {
				this.isUiDirty = true;
			}
		}

		this.mainLine.update(delta);
		this.bgLine?.update(delta);
	}

	commitChanges(): void {
		if (!this.isInRenderRange()) return;
		if (this.isUiDirty) {
			this.renderStyles();
			this.isUiDirty = false;
		}
		this.mainLine.commitChanges();
		this.bgLine?.commitChanges();
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
