/**
 * @fileoverview
 * 一个播放歌词的组件
 * @author SteveXMH
 */

import type { LyricLine } from "#interfaces";
import "#styles/index.css";
import { LyricPlayerBase } from "#lyric/base/index.ts";
import type { LyricLineBase } from "#lyric/base/line.ts";
import styles from "#styles/lyric-player.module.css";
import { LyricLineGroup } from "./lyric-group.ts";
import { LyricLineEl, type RawLyricLineMouseEvent } from "./lyric-line.ts";

/**
 * 歌词行鼠标相关事件，可以获取到歌词行的索引和歌词行元素
 */
export class LyricLineMouseEvent extends MouseEvent {
	constructor(
		/**
		 * 歌词行索引
		 */
		public readonly lineIndex: number,
		/**
		 * 歌词行元素
		 */
		public readonly line: LyricLineBase,
		event: MouseEvent,
	) {
		super(`line-${event.type}`, event);
	}
}

export type LyricLineMouseEventListener = (evt: LyricLineMouseEvent) => void;

/**
 * 歌词播放组件，本框架的核心组件
 *
 * 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
 */
export class DomLyricPlayer extends LyricPlayerBase {
	override currentLyricGroups: LyricLineGroup[] = [];

	override onResize(): void {
		const computedStyles = getComputedStyle(this.element);
		this._baseFontSize = Number.parseFloat(computedStyles.fontSize);
		this.rebuildStyle();
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
		this.element.classList.add("amll-lyric-player", "dom");
		if (this.disableSpring) {
			this.element.classList.add(styles.disableSpring);
		}
	}

	private rebuildStyle() {
		// const width = this.innerSize[0];
		// const height = this.innerSize[1];
		// this.element.style.setProperty("--amll-lp-width", `${width.toFixed(4)}px`);
		// this.element.style.setProperty(
		// 	"--amll-lp-height",
		// 	`${height.toFixed(4)}px`,
		// );
	}

	override setWordFadeWidth(value = 0.5): void {
		super.setWordFadeWidth(value);
		for (const group of this.currentLyricGroups) {
			group.mainLine.updateMaskImageSync();
			group.bgLine?.updateMaskImageSync();
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
		if (!this.supportMaskImage) {
			this.element.style.setProperty("--amll-player-time", `${initialTime}`);
		}

		for (const group of this.currentLyricGroups) {
			const linesToDispose = [group.mainLine, group.bgLine].filter(
				(line) => !!line,
			);

			for (const line of linesToDispose) {
				line.removeMouseEventListener("click", this.onLineClickedHandler);
				line.removeMouseEventListener("contextmenu", this.onLineClickedHandler);
			}
			group.dispose();
		}
		this.currentLyricGroups = [];

		let currentGroup: LyricLineGroup | null = null;

		for (let i = 0; i < this.processedLines.length; i++) {
			const line = this.processedLines[i];
			const lineEl = new LyricLineEl(this, line);

			lineEl.addMouseEventListener("click", this.onLineClickedHandler);
			lineEl.addMouseEventListener("contextmenu", this.onLineClickedHandler);

			this.lyricLinesIndexes.set(lineEl, i);

			if (!line.isBG || !currentGroup) {
				currentGroup = new LyricLineGroup(this, lineEl);
				this.currentLyricGroups.push(currentGroup);
				this.lyricGroupElementMap.set(currentGroup.element, currentGroup);
			} else {
				currentGroup.addBgLine(lineEl);
			}
		}

		this.setLinePosXSpringParams({});
		this.setLinePosYSpringParams({});
		this.setLineScaleSpringParams({});
		this.setCurrentTime(initialTime, true);
		this.calcLayout(true);
		this.update(0);
	}

	override pause(): void {
		super.pause();
		this.element.classList.remove(styles.playing);
		this.interludeDots.pause();
		for (const group of this.currentLyricGroups) {
			group.mainLine.pause();
			group.bgLine?.pause();
		}
	}

	override resume(): void {
		super.resume();
		this.element.classList.add(styles.playing);
		this.interludeDots.resume();
		for (const group of this.currentLyricGroups) {
			group.mainLine.resume();
			group.bgLine?.resume();
		}
	}

	override update(delta = 0): void {
		if (!this.timelineState.initialLayoutFinished) return;
		super.update(delta);
		if (!this.supportMaskImage) {
			this.element.style.setProperty(
				"--amll-player-time",
				`${this.timelineState.currentTime}`,
			);
		}
		if (!this.isPageVisible) return;
		const deltaS = delta / 1000;
		for (const group of this.currentLyricGroups) {
			group.update(deltaS);
		}
	}

	override dispose(): void {
		super.dispose();
		this.element.remove();
		for (const group of this.currentLyricGroups) {
			group.dispose();
		}
		this.bottomLine.dispose();
		this.interludeDots.dispose();
	}
}
