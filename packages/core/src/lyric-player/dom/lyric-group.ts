import { LyricLineGroupBase } from "#lyric/base/group.ts";
import styles from "#styles/lyric-player.module.css";
import { clamp01 } from "#utils/clamp.ts";
import type { DomLyricPlayer } from "./index.ts";
import type { LyricLineEl } from "./lyric-line.ts";

export class LyricLineGroup extends LyricLineGroupBase<LyricLineEl> {
	public element: HTMLElement;
	public bgWrapper?: HTMLElement;
	private lastIsActive?: boolean;

	private lastBgHeight = 0;
	private lastBgIsHidden?: boolean;
	private lastYNum = -9999;
	private lastOpacityNum = -1;
	private lastBlurNum = -1;
	private lastBgSlideYNum = -9999;

	constructor(
		public lyricPlayer: DomLyricPlayer,
		mainLine: LyricLineEl,
	) {
		super(mainLine);
		this.element = document.createElement("div");
		this.element.className = styles.lyricLineWrapper;

		if (mainLine.getLine().isDuet) {
			this.element.classList.add(styles.isDuetWrapper);
		}

		this.element.appendChild(mainLine.getElement());
		this.posY.setPosition(window.innerHeight * 2);

		lyricPlayer.resizeObserver.observe(this.element);
	}

	get isInSight(): boolean {
		const t = this.posY.getCurrentPosition();

		let h = this.lyricPlayer.lyricGroupSize?.get(this)?.[1];
		if (h === undefined || h === 0) {
			h = this.lyricPlayer.size[1] / 5;
		}

		const pb = this.lyricPlayer.size[1];
		const ov = this.lyricPlayer.getOverscanPx();

		return !(t > pb + h + ov || t < -h - ov);
	}

	show(): void {
		if (!this.element.parentElement) {
			const playerEl = this.lyricPlayer.getElement();
			const groups = this.lyricPlayer.currentLyricGroups;
			const myIndex = groups.indexOf(this);

			let referenceNode: HTMLElement | null = null;
			if (myIndex !== -1) {
				for (let i = myIndex + 1; i < groups.length; i++) {
					if (groups[i].element.parentElement === playerEl) {
						referenceNode = groups[i].element;
						break;
					}
				}
			}

			playerEl.insertBefore(this.element, referenceNode);

			this.lyricPlayer.resizeObserver.observe(this.element);
		}

		this.mainLine.show();
		this.bgLine?.show();
	}

	hide(): void {
		if (this.element.parentElement) {
			this.lyricPlayer.resizeObserver.unobserve(this.element);
			this.element.remove();

			this.mainLine.teardownContent();
			this.bgLine?.teardownContent();
		}
	}

	override update(delta: number): void {
		const inSight = this.isInSight;
		if (inSight) {
			this.show();
			super.update(delta);
		} else {
			this.hide();
			if (this.lyricPlayer.getEnableSpring()) {
				this.posY.update(delta);
				this.bgSlideY.update(delta);
			}
		}
	}

	override onLineSizeChange(size: [number, number]): void {
		super.onLineSizeChange(size);
		if (this.bgWrapper) {
			this.lastBgHeight = this.bgWrapper.clientHeight || 0;
		}
	}

	addBgLine(bgLine: LyricLineEl): void {
		if (this.bgLine) {
			this.bgLine.dispose();
		}
		if (this.bgWrapper) {
			this.bgWrapper.remove();
		}

		this.bgLine = bgLine;

		// 需要对比第一个词的开始时间而不是行起始时间，因为行的起始时间已经被
		// `syncMainAndBackgroundLines` 同步过了
		const bgStartTime =
			bgLine.getLine().words[0]?.startTime ?? bgLine.getLine().startTime;
		const mainStartTime =
			this.mainLine.getLine().words[0]?.startTime ??
			this.mainLine.getLine().startTime;

		this.isBgFirst = bgStartTime < mainStartTime;

		if (this.mainLine.getLine().isDuet) {
			bgLine.getElement().classList.add(styles.lyricDuetLine);
			this.element.classList.add(styles.isDuetWrapper);
		}

		this.bgWrapper = document.createElement("div");
		this.bgWrapper.className = styles.bgWrapper;

		this.bgWrapper.appendChild(bgLine.getElement());

		const alwaysPostposition =
			this.lyricPlayer.getAlwaysPostpositionBackground();
		const shouldBgFirst = !alwaysPostposition && this.isBgFirst;

		if (shouldBgFirst) {
			this.bgWrapper.classList.add(styles.bgWrapperTop);
			this.element.insertBefore(this.bgWrapper, this.mainLine.getElement());
			this.bgSlideY.setPosition(80);
		} else {
			this.element.appendChild(this.bgWrapper);
		}

		this.lastBgHeight = this.bgWrapper.clientHeight || 0;
	}

	protected renderStyles(): void {
		const style = this.element.style;

		const currentY = this.posY.getCurrentPosition();
		if (Math.abs(currentY - this.lastYNum) >= 0.001) {
			this.lastYNum = currentY;
			style.transform = `translateY(${currentY.toFixed(1)}px)`;
		}

		if (Math.abs(this.opacity - this.lastOpacityNum) >= 0.05) {
			this.lastOpacityNum = this.opacity;
			style.opacity = String(this.opacity);
		}

		const blurVal = Math.min(5, this.blur);
		if (Math.abs(blurVal - this.lastBlurNum) >= 0.05) {
			this.lastBlurNum = blurVal;
			style.filter = blurVal > 0.01 ? `blur(${blurVal.toFixed(2)}px)` : "none";
		}

		if (this.bgWrapper) {
			if (this.lastIsActive !== this.isActive) {
				this.lastIsActive = this.isActive;
				this.bgWrapper.classList.toggle(styles.bgWrapperActive, this.isActive);
			}

			const bgStyle = this.bgWrapper.style;
			const slideY = this.bgSlideY.getCurrentPosition();

			if (Math.abs(slideY - this.lastBgSlideYNum) >= 0.001) {
				this.lastBgSlideYNum = slideY;
				const activeProgress = clamp01(1 - Math.abs(slideY) / 80);
				const scaleStr = (0.8 + activeProgress * 0.2).toFixed(3);
				const alwaysPostposition =
					this.lyricPlayer.getAlwaysPostpositionBackground();
				const shouldBgFirst = !alwaysPostposition && this.isBgFirst;

				let finalTranslateYPx = (slideY / 100) * this.lastBgHeight;
				if (shouldBgFirst) {
					finalTranslateYPx += -this.lastBgHeight * (1 - activeProgress);
				}

				bgStyle.transform = `translateY(${finalTranslateYPx.toFixed(1)}px) scale(${scaleStr})`;

				const targetHiddenY = shouldBgFirst ? 80 : -80;
				const isHidden =
					Math.abs(slideY - targetHiddenY) < 0.1 && !this.isActive;

				if (this.lastBgIsHidden !== isHidden) {
					this.lastBgIsHidden = isHidden;
					this.bgWrapper.classList.toggle(styles.bgWrapperHidden, isHidden);
				}
			}
		}
	}

	override dispose(): void {
		super.dispose();
		this.lyricPlayer.resizeObserver.unobserve(this.element);
		this.element.remove();
	}
}
