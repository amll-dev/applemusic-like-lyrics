import type {
	BottomLine,
	BottomLineTransforms,
} from "#lyric/base/bottom-line.ts";
import type { LyricPlayerBase } from "#lyric/base/index.ts";
import styles from "#styles/lyric-player.module.css";
import { Spring } from "#utils/spring.ts";
import { Duration } from "#utils/time.ts";

/**
 * 底栏组件的 DOM 实现
 *
 * 一个始终位于歌词底部的空白容器元素，外部可经由播放器的
 * getBottomLineElement 获取元素并添加歌曲创作者等内容
 */
export class BottomLineEl implements BottomLine {
	private element: HTMLElement = document.createElement("div");
	private contentElement: HTMLElement = document.createElement("div");
	private top = 0;
	private isFocused = false;
	private blur = 0;

	private lastTransformStyle = "";
	private lastFilterStyle = "";

	readonly lineTransforms: BottomLineTransforms = {
		posY: new Spring(0),
	};

	/**
	 * 底栏当前测量得到的尺寸
	 *
	 * 由播放器的 ResizeObserver 回调写入
	 */
	public lineSize: [number, number] = [0, 0];

	constructor(private lyricPlayer: LyricPlayerBase) {
		this.element.setAttribute(
			"class",
			`${styles.lyricLineWrapper} ${styles.bottomLineWrapper}`,
		);
		this.contentElement.setAttribute(
			"class",
			`${styles.lyricLine} ${styles.bottomLine}`,
		);
		this.contentElement.dataset.bottomLine = "true";
		this.element.appendChild(this.contentElement);
		this.rebuildStyle();
	}

	public getElement(): HTMLElement {
		return this.element;
	}

	public getContentElement(): HTMLElement {
		return this.contentElement;
	}

	public resetPosition(): void {
		this.lineTransforms.posY.setPosition(window.innerHeight * 2);
		this.rebuildStyle();
	}

	/**
	 * 设置底栏是否处于聚焦状态
	 *
	 * 一般在歌曲播放完毕且底栏有内容时聚焦到底栏并设为 true
	 */
	public setFocused(focused: boolean): void {
		if (this.isFocused !== focused) {
			this.isFocused = focused;
			this.contentElement.classList.toggle(styles.gradientMask, focused);
			if (focused) {
				this.element.dataset.focused = "true";
			} else {
				delete this.element.dataset.focused;
			}
		}
	}

	public setTransform(
		top: number = this.top,
		blur = 0,
		immediate = false,
		delay: Duration = Duration.ZERO,
	): void {
		this.top = top;

		if (immediate || !this.lyricPlayer.getEnableSpring()) {
			this.blur = Math.min(32, blur);
			if (immediate) this.element.classList.add(styles.tmpDisableTransition);
			this.lineTransforms.posY.setPosition(top);
			this.rebuildStyle();
			if (immediate)
				requestAnimationFrame(() => {
					this.element.classList.remove(styles.tmpDisableTransition);
				});
		} else {
			this.blur = Math.min(5, blur);
			this.lineTransforms.posY.setTargetPosition(top, delay);
		}
	}

	/**
	 * 逐帧推进弹簧动画并应用样式
	 * @param delta 距离上一次调用的时长
	 */
	public update(delta: Duration = Duration.ZERO): void {
		if (!this.lyricPlayer.getEnableSpring()) return;
		this.lineTransforms.posY.update(delta);
		this.rebuildStyle();
	}

	/**
	 * 将弹簧当前位置与模糊值写入内联样式
	 */
	private rebuildStyle(): void {
		const style = this.element.style;

		const posY = this.lineTransforms.posY.getCurrentPosition().toFixed(2);
		const transformStr = `translate(0px, ${posY}px)`;

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

	public dispose(): void {
		this.element.remove();
	}
}
