import type { Disposable, HasElement } from "#interfaces";
import styles from "#styles/lyric-player.module.css";
import { measure } from "#utils/schedule.ts";
import { Spring } from "#utils/spring.ts";
import type { LyricPlayerBase } from ".";

interface LineTransforms {
	posX: Spring;
	posY: Spring;
}

export class BottomLineEl implements HasElement, Disposable {
	private element: HTMLElement = document.createElement("div");
	private left = 0;
	private top = 0;
	// 由 LyricPlayer 来设置
	lineSize: [number, number] = [0, 0];
	readonly lineTransforms: LineTransforms = {
		posX: new Spring(0),
		posY: new Spring(0),
	};
	private isFocused = false;
	private blur = 0;

	private lastTransformStyle = "";
	private lastFilterStyle = "";

	constructor(private lyricPlayer: LyricPlayerBase) {
		this.element.setAttribute(
			"class",
			`${styles.lyricLine} ${styles.bottomLine}`,
		);
		this.element.dataset.bottomLine = "true";
		this.rebuildStyle();
	}
	async measureSize(): Promise<[number, number]> {
		const size: [number, number] = await measure(() => [
			this.element.clientWidth,
			this.element.clientHeight,
		]);
		return size;
	}
	show(): void {
		this.rebuildStyle();
	}
	hide(): void {
		this.rebuildStyle();
	}
	setFocused(focused: boolean): void {
		if (this.isFocused !== focused) {
			this.isFocused = focused;
			if (focused) {
				this.element.dataset.focused = "true";
			} else {
				delete this.element.dataset.focused;
			}
		}
	}
	private rebuildStyle() {
		const style = this.element.style;

		const posX = this.lineTransforms.posX.getCurrentPosition().toFixed(2);
		const posY = this.lineTransforms.posY.getCurrentPosition().toFixed(2);
		const transformStr = `translate(${posX}px, ${posY}px)`;

		if (this.lastTransformStyle !== transformStr) {
			this.lastTransformStyle = transformStr;
			style.transform = transformStr;
		}

		const blurVal = Math.min(5, this.blur);
		const filterStr = blurVal > 0.01 ? `blur(${blurVal.toFixed(2)}px)` : "none";
		if (this.lastFilterStyle !== filterStr) {
			this.lastFilterStyle = filterStr;
			style.filter = filterStr;
		}
	}

	getElement(): HTMLElement {
		return this.element;
	}
	setTransform(
		left: number = this.left,
		top: number = this.top,
		blur = 0,
		immediate = false,
		delay = 0,
	): void {
		this.left = left;
		this.top = top;

		if (immediate || !this.lyricPlayer.getEnableSpring()) {
			this.blur = Math.min(32, blur);
			if (immediate) this.element.classList.add(styles.tmpDisableTransition);
			this.lineTransforms.posX.setPosition(left);
			this.lineTransforms.posY.setPosition(top);
			if (!this.lyricPlayer.getEnableSpring()) this.show();
			else this.rebuildStyle();
			if (immediate)
				requestAnimationFrame(() => {
					this.element.classList.remove(styles.tmpDisableTransition);
				});
		} else {
			this.blur = Math.min(5, blur);
			this.lineTransforms.posX.setTargetPosition(left, delay);
			this.lineTransforms.posY.setTargetPosition(top, delay);
		}
	}
	update(delta = 0): void {
		if (!this.lyricPlayer.getEnableSpring()) return;
		this.lineTransforms.posX.update(delta);
		this.lineTransforms.posY.update(delta);
		if (this.isInSight) {
			this.show();
		} else {
			this.hide();
		}
	}
	get isInSight(): boolean {
		const l = this.lineTransforms.posX.getCurrentPosition();
		const t = this.lineTransforms.posY.getCurrentPosition();
		const r = l + this.lineSize[0];
		const b = t + this.lineSize[1];
		const pr = this.lyricPlayer.size[0];
		const pb = this.lyricPlayer.size[1];
		return !(l > pr || t > pb || r < 0 || b < 0);
	}
	dispose(): void {
		this.element.remove();
	}
}
