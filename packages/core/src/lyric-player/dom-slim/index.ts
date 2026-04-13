/**
 * @fileoverview
 * 一个播放歌词的组件，但是进行了部分效果的阉割精简，以尝试改善在低性能设备上的性能问题
 * @author SteveXMH
 */

import type { LyricLine } from "../../interfaces.ts";
import "../../styles/index.css";
import { debounce } from "../../utils/debounce.ts";
import { LyricPlayerBase } from "../base.ts";
import { LyricLineMouseEvent } from "../dom/index.ts";
import styles from "./index.module.css";
import { LyricLineEl, type RawLyricLineMouseEvent } from "./lyric-line.ts";

/**
 * 歌词播放组件，本框架的核心组件
 *
 * 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
 */
export class DomSlimLyricPlayer extends LyricPlayerBase {
	override currentLyricLineObjects: LyricLineEl[] = [];

	private debounceCalcLayout = debounce(
		() =>
			this.calcLayout(true).then(() =>
				this.currentLyricLineObjects.map(async (el, i) => {
					el.markMaskImageDirty("DomLyricPlayer onResize");
					await el.waitMaskImageUpdated();
					if (this.hotLines.has(i)) {
						el.enable(this.currentTime);
						el.resume();
					}
				}),
			),
		1000,
	);

	override onResize(): void {
		const computedStyles = getComputedStyle(this.element);
		this._baseFontSize = Number.parseFloat(computedStyles.fontSize);
		const innerWidth =
			this.element.clientWidth -
			Number.parseFloat(computedStyles.paddingLeft) -
			Number.parseFloat(computedStyles.paddingRight);
		const innerHeight =
			this.element.clientHeight -
			Number.parseFloat(computedStyles.paddingTop) -
			Number.parseFloat(computedStyles.paddingBottom);
		this.innerSize[0] = innerWidth;
		this.innerSize[1] = innerHeight;
		this.rebuildStyle();
		// for (const obj of this.currentLyricLineObjects) {
		// 	if (!obj.getElement().classList.contains(styles.dirty))
		// 		obj.getElement().classList.add(styles.dirty);
		// }
		this.debounceCalcLayout();
	}

	readonly supportPlusLighter: boolean = CSS.supports(
		"mix-blend-mode",
		"plus-lighter",
	);
	readonly supportMaskImage: boolean = CSS.supports("mask-image", "none");
	readonly innerSize: [number, number] = [0, 0];
	private readonly onLineClickedHandler = (e: RawLyricLineMouseEvent) => {
		const evt = new LyricLineMouseEvent(
			this.lyricLinesIndexes.get(e.line) ?? -1,
			e.line,
			e,
		);
		if (!this.dispatchEvent(evt)) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	};
	/**
	 * 是否为非逐词歌词
	 * @internal
	 */
	_getIsNonDynamic(): boolean {
		return this.isNonDynamic;
	}
	private _baseFontSize = Number.parseFloat(
		getComputedStyle(this.element).fontSize,
	);
	public get baseFontSize(): number {
		return this._baseFontSize;
	}
	constructor() {
		super();
		this.onResize();
		this.element.classList.add("amll-lyric-player", "dom-slim");
		if (this.disableSpring) {
			this.element.classList.add(styles.disableSpring);
		}
	}

	private rebuildStyle() {
		const width = this.innerSize[0];
		const height = this.innerSize[1];
		this.element.style.setProperty("--amll-lp-width", `${width.toFixed(4)}px`);
		this.element.style.setProperty(
			"--amll-lp-height",
			`${height.toFixed(4)}px`,
		);
	}

	override setWordFadeWidth(value = 0.5): void {
		super.setWordFadeWidth(value);
		for (const el of this.currentLyricLineObjects) {
			el.markMaskImageDirty("DomLyricPlayer setWordFadeWidth");
		}
	}

	/**
	 * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	 * @param lines 歌词数组
	 * @param initialTime 初始时间，默认为 0
	 */
	override setLyricLines(lines: LyricLine[], initialTime = 0): void {
		super.setLyricLines(lines, initialTime);
		if (this.hasDuetLine) {
			this.element.classList.add(styles.hasDuetLine);
		} else {
			this.element.classList.remove(styles.hasDuetLine);
		}

		for (const line of this.currentLyricLineObjects) {
			line.removeMouseEventListener("click", this.onLineClickedHandler);
			line.removeMouseEventListener("contextmenu", this.onLineClickedHandler);
			line.dispose();
		}

		// 创建新的歌词行元素
		this.currentLyricLineObjects = this.processedLines.map((line, i) => {
			const lineEl = new LyricLineEl(this, line);
			lineEl.addMouseEventListener("click", this.onLineClickedHandler);
			lineEl.addMouseEventListener("contextmenu", this.onLineClickedHandler);
			this.element.appendChild(lineEl.getElement());
			this.lyricLinesIndexes.set(lineEl, i);
			lineEl.markMaskImageDirty("DomLyricPlayer setLyricLines");
			return lineEl;
		});

		this.setLinePosXSpringParams({});
		this.setLinePosYSpringParams({});
		this.setLineScaleSpringParams({});
		this.calcLayout(true).then(() => {
			this.initialLayoutFinished = true;
		});
	}

	override pause(): void {
		super.pause();
		this.interludeDots.pause();
		for (const line of this.currentLyricLineObjects) {
			line.pause();
		}
	}

	override resume(): void {
		super.resume();
		this.interludeDots.resume();
		for (const line of this.currentLyricLineObjects) {
			line.resume();
		}
	}

	override update(delta = 0): void {
		if (!this.initialLayoutFinished) return;
		super.update(delta);
		if (!this.isPageVisible) return;
		const deltaS = delta / 1000;
		for (const line of this.currentLyricLineObjects) {
			line.update(deltaS);
		}
	}

	override async calcLayout(sync?: boolean): Promise<void> {
		await super.calcLayout(sync);
		const curLine = this.currentLyricLineObjects[this.targetAlignIndex];
		const curLineEl = curLine.getElement();
		const curLineVisibility = curLineEl.checkVisibility({
			contentVisibilityAuto: true,
		});
		const playerTop = this.element.getBoundingClientRect().top;
		if (!curLineVisibility) {
			curLineEl.scrollIntoView({
				block: "center",
				behavior: "instant",
			});
		}
		const curLineHeight = curLineEl.clientHeight;
		const curLineRect = curLineEl.getBoundingClientRect();
		let scrollToPos =
			curLineRect.top - playerTop - this.size[1] * this.alignPosition;
		if (curLine) {
			switch (this.alignAnchor) {
				case "bottom":
					scrollToPos += curLineHeight;
					break;
				case "center":
					scrollToPos += curLineHeight / 2;
					break;
				case "top":
					break;
			}
		}
		this.element.scrollBy({
			top: scrollToPos,
			behavior: "smooth",
		});
	}

	override dispose(): void {
		super.dispose();
		this.element.remove();
		for (const el of this.currentLyricLineObjects) {
			el.dispose();
		}
		this.bottomLine.dispose();
		this.interludeDots.dispose();
	}
}
