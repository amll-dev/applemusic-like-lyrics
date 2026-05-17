import structuredClone from "@ungap/structured-clone";
import type {
	Disposable,
	HasElement,
	LyricLine,
	LyricWord,
	OptimizeLyricOptions,
} from "#interfaces";
import styles from "#styles/lyric-player.module.css";
import { clampPositive } from "#utils/clamp.ts";
import { optimizeLyricLines } from "#utils/optimize-lyric.ts";
import type { SpringParams } from "#utils/spring.ts";
import { InterludeDots } from "../dom/interlude-dots.ts";
import { BottomLineEl } from "./bottom-line.ts";
import { LayoutAlignAnchor, MaskObsceneWordsMode } from "./consts.ts";
import type { LyricLineGroupBase } from "./group.ts";
import {
	computeCurrentInterlude,
	computeGroupPresentation,
	computeLineBlur,
	computeLinePosYSpringParams,
	type PlayerLayoutState,
} from "./layout.ts";
import type { LyricLineBase } from "./line.ts";
import {
	attachPlayerScrollHandlers,
	type PlayerScrollState,
	resetPlayerScrollState,
} from "./scroll.ts";
import {
	commitPlayerTimeState,
	computePlayerTimeState,
	type PlayerTimelineState,
} from "./timeline.ts";

export type { PlayerLayoutState } from "./layout.ts";
export type { LyricLineBase } from "./line.ts";
export type { PlayerScrollState } from "./scroll.ts";
export type { PlayerTimelineState } from "./timeline.ts";

/**
 * 歌词播放器的基类，已经包含了有关歌词操作和排版的功能，
 * 子类需要为其实现对应的显示展示操作
 */
export abstract class LyricPlayerBase
	extends EventTarget
	implements HasElement, Disposable
{
	protected element: HTMLElement = document.createElement("div");
	abstract get baseFontSize(): number;

	/** 播放时间线状态 */
	protected timelineState: PlayerTimelineState = {
		currentTime: 0,
		lastCurrentTime: 0,
		hotGroups: new Set(),
		bufferedGroups: new Set(),
		scrollToIndex: 0,
		isSeeking: false,
		isPlaying: true,
		initialLayoutFinished: false,
	};
	/** @internal */
	lyricGroupElementMap: WeakMap<Element, LyricLineGroupBase> = new WeakMap();
	protected currentLyricLines: LyricLine[] = [];
	protected processedLines: LyricLine[] = [];
	protected lyricLinesIndexes: WeakMap<LyricLineBase, number> = new WeakMap();
	protected isNonDynamic = false;
	protected hasDuetLine = false;
	protected disableSpring = false;
	protected layoutState: PlayerLayoutState = {
		interludeDotsSize: [0, 0],
		targetAlignIndex: 0,
		lastInterludeState: false,
		alignAnchor: LayoutAlignAnchor.Center,
		alignPosition: 0.35,
		overscanPx: 300,
	};
	protected interludeDots: InterludeDots = new InterludeDots();
	protected bottomLine: BottomLineEl = new BottomLineEl(this);
	protected enableBlur = true;
	protected enableScale = true;
	protected maskObsceneWords: MaskObsceneWordsMode =
		MaskObsceneWordsMode.Disabled;
	protected maskObsceneWordChar = "*";
	protected hidePassedLines = false;
	protected scrollState: PlayerScrollState = {
		scrollBoundary: { minOffset: 0, maxOffset: 0 },
		scrollOffset: 0,
		allowScroll: true,
		isScrolled: false,
		isUserScrolling: false,
	};
	public currentLyricGroups: LyricLineGroupBase[] = [];
	lyricGroupSize: WeakMap<LyricLineGroupBase, [number, number]> = new WeakMap();
	readonly size: [number, number] = [0, 0];
	protected isPageVisible = true;
	protected optimizeOptions: OptimizeLyricOptions = {};

	/** 是否强制让背景人声行始终后置（即始终在主歌词下方显示，不前置背景人声） */
	protected alwaysPostpositionBackground = false;

	protected posXSpringParams: Partial<SpringParams> = {
		mass: 1,
		damping: 10,
		stiffness: 100,
	};
	protected posYSpringParams: Partial<SpringParams> = {
		mass: 0.9,
		damping: 15,
		stiffness: 90,
	};
	protected scaleSpringParams: Partial<SpringParams> = {
		mass: 2,
		damping: 25,
		stiffness: 100,
	};
	protected scaleForBGSpringParams: Partial<SpringParams> = {
		mass: 1,
		damping: 20,
		stiffness: 50,
	};
	private onPageShow = () => {
		this.isPageVisible = true;
		this.setCurrentTime(this.timelineState.currentTime, true);
	};
	private onPageHide = () => {
		this.isPageVisible = false;
	};
	private scrolledHandler: ReturnType<typeof setTimeout> | undefined;
	/** @internal */
	resizeObserver: ResizeObserver = new ResizeObserver(((entries) => {
		let shouldRelayout = false;
		let shouldRebuildPlayerStyle = false;
		for (const entry of entries) {
			if (entry.target === this.element) {
				const rect = entry.contentRect;
				this.size[0] = rect.width;
				this.size[1] = rect.height;
				shouldRebuildPlayerStyle = true;
			} else if (entry.target === this.interludeDots.getElement()) {
				this.layoutState.interludeDotsSize[0] = entry.target.clientWidth;
				this.layoutState.interludeDotsSize[1] = entry.target.clientHeight;
				shouldRelayout = true;
			} else if (entry.target === this.bottomLine.getElement()) {
				const newSize: [number, number] = [
					entry.target.clientWidth,
					entry.target.clientHeight,
				];
				const oldSize: [number, number] = this.bottomLine.lineSize;

				if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
					this.bottomLine.lineSize = newSize;
					shouldRelayout = true;
				}
			} else {
				const groupObj = this.lyricGroupElementMap.get(entry.target);
				if (groupObj) {
					const newSize: [number, number] = [
						entry.target.clientWidth,
						entry.target.clientHeight,
					];

					const oldSize: [number, number] = this.lyricGroupSize.get(
						groupObj,
					) ?? [0, 0];

					if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
						this.lyricGroupSize.set(groupObj, newSize);
						groupObj.onLineSizeChange(newSize);
						shouldRelayout = true;
					}
				}
			}
		}
		if (shouldRelayout) {
			this.calcLayout(true);
		}
		if (shouldRebuildPlayerStyle) {
			this.onResize();
		}
	}) as ResizeObserverCallback);
	protected wordFadeWidth = 0.5;

	constructor(element?: HTMLElement) {
		super();
		if (element) this.element = element;
		this.element.classList.add("amll-lyric-player");

		this.resizeObserver.observe(this.element);
		this.resizeObserver.observe(this.interludeDots.getElement());

		this.element.appendChild(this.interludeDots.getElement());
		this.element.appendChild(this.bottomLine.getElement());
		this.interludeDots.setTransform(0, 200);

		window.addEventListener("pageshow", this.onPageShow);
		window.addEventListener("pagehide", this.onPageHide);
		attachPlayerScrollHandlers(this.element, this.scrollState, {
			onBeginScroll: () => this.beginScrollHandler(),
			onEndScroll: () => this.endScrollHandler(),
			onLayout: (sync, force) => this.calcLayout(sync, force),
			containsTarget: (target) => this.element.contains(target),
			clickTarget: (target) => target.click(),
		});
	}

	private beginScrollHandler() {
		const allowed = this.scrollState.allowScroll;
		if (allowed) {
			this.scrollState.isScrolled = true;
			clearTimeout(this.scrolledHandler);
			this.scrolledHandler = setTimeout(() => {
				this.scrollState.isScrolled = false;
				this.scrollState.scrollOffset = 0;
			}, 5000);
		}
		return allowed;
	}
	private endScrollHandler() {}

	/**
	 * 设置文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5，即一个全角字符的一半宽度
	 *
	 * 如果要模拟 Apple Music for Android 的效果，可以设置为 1
	 *
	 * 如果要模拟 Apple Music for iPad 的效果，可以设置为 0.5
	 *
	 * 如果想要近乎禁用渐变效果，可以设置成非常接近 0 的小数（例如 `0.0001` ），但是**不可以为 0**
	 *
	 * @param value 需要设置的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5
	 */
	setWordFadeWidth(value = 0.5): void {
		this.wordFadeWidth = Math.max(0.0001, value);
	}

	/**
	 * 是否启用歌词行缩放效果，默认启用
	 *
	 * 如果启用，非选中的歌词行会轻微缩小以凸显当前播放歌词行效果
	 *
	 * 此效果对性能影响微乎其微，推荐启用
	 * @param enable 是否启用歌词行缩放效果
	 */
	setEnableScale(enable = true): void {
		this.enableScale = enable;
		this.calcLayout();
	}
	/**
	 * 获取当前是否启用了歌词行缩放效果
	 * @returns 是否启用歌词行缩放效果
	 */
	getEnableScale(): boolean {
		return this.enableScale;
	}

	/**
	 * 获取当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
	 * @returns 当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
	 */
	getWordFadeWidth(): number {
		return this.wordFadeWidth;
	}

	setIsSeeking(isSeeking: boolean): void {
		this.timelineState.isSeeking = isSeeking;
	}
	/**
	 * 设置是否隐藏已经播放过的歌词行，默认不隐藏
	 * @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
	 */
	setHidePassedLines(hide: boolean): void {
		this.hidePassedLines = hide;
		this.calcLayout();
	}
	/**
	 * 设置是否启用歌词行的模糊效果
	 * @param enable 是否启用
	 */
	setEnableBlur(enable: boolean): void {
		if (this.enableBlur === enable) return;
		this.enableBlur = enable;
		this.calcLayout();
	}

	/**
	 * 设置歌词中不雅用语的掩码模式
	 * @param mode 掩码模式
	 * @see {@link MaskObsceneWordsMode}
	 */
	setMaskObsceneWords(mode: MaskObsceneWordsMode): void {
		if (this.maskObsceneWords === mode) return;
		this.maskObsceneWords = mode;
		this.rebuildLyricLines();
		this.calcLayout();
	}

	/**
	 * 设置不雅用语掩码使用的字符，默认为 `*`
	 * @param char 单个字符，用于替换不雅用语中的字符
	 */
	setMaskObsceneWordChar(char: string): void {
		const c = char.charAt(0) || "*";
		if (this.maskObsceneWordChar === c) return;
		this.maskObsceneWordChar = c;
		if (this.maskObsceneWords !== MaskObsceneWordsMode.Disabled) {
			this.rebuildLyricLines();
			this.calcLayout();
		}
	}

	rebuildLyricLines(): void {
		for (const group of this.currentLyricGroups) {
			group.rebuildAllLines();
		}
	}
	/**
	 * 根据当前配置处理不雅用语单词
	 * @param word 单词对象
	 * @internal
	 */
	processObsceneWord(word: LyricWord): string {
		const text = word.word;

		if (
			!word.obscene ||
			this.maskObsceneWords === MaskObsceneWordsMode.Disabled
		) {
			return text;
		}

		const maskChar = this.maskObsceneWordChar;

		if (this.maskObsceneWords === MaskObsceneWordsMode.FullMask) {
			return text.replace(/\S/g, maskChar);
		}

		if (this.maskObsceneWords === MaskObsceneWordsMode.PartialMask) {
			const trimmed = text.trim();

			if (trimmed.length <= 2) {
				return text.replace(/\S/g, maskChar);
			}

			const startPos = text.indexOf(trimmed);
			const endPos = startPos + trimmed.length - 1;

			return (
				text.slice(0, startPos + 1) +
				text.slice(startPos + 1, endPos).replace(/\S/g, maskChar) +
				text.slice(endPos)
			);
		}

		return text;
	}
	/**
	 * 设置目标歌词行的对齐方式，默认为 `center`
	 *
	 * - 设置成 `top` 的话将会向目标歌词行的顶部对齐
	 * - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
	 * - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
	 * @param alignAnchor 歌词行对齐方式，详情见函数说明
	 */
	setAlignAnchor(alignAnchor: LayoutAlignAnchor): void {
		this.layoutState.alignAnchor = alignAnchor;
	}
	/**
	 * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
	 * @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
	 */
	setAlignPosition(alignPosition: number): void {
		this.layoutState.alignPosition = alignPosition;
	}

	/**
	 * 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
	 * @param px 像素值，默认 300
	 */
	setOverscanPx(px: number): void {
		this.layoutState.overscanPx = clampPositive(px | 0);
	}
	/** 获取当前 overscan 像素距离 */
	getOverscanPx(): number {
		return this.layoutState.overscanPx;
	}
	/**
	 * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
	 *
	 * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
	 *
	 * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
	 */
	setEnableSpring(enable = true): void {
		this.disableSpring = !enable;
		if (enable) {
			this.element.classList.remove(styles.disableSpring);
		} else {
			this.element.classList.add(styles.disableSpring);
		}
		this.calcLayout(true);
	}
	/**
	 * 获取当前是否启用了物理弹簧
	 * @returns 是否启用物理弹簧
	 */
	getEnableSpring(): boolean {
		return !this.disableSpring;
	}

	/**
	 * 设置歌词的优化配置项，这些配置项默认全部开启
	 *
	 * 注意，如果在 `setLyricLines` 之后修改此配置，需要重新调用 `setLyricLines()` 才能对当前歌词生效
	 * @param options 优化配置选项
	 * @see {@link OptimizeLyricOptions}
	 */
	setOptimizeOptions(options: OptimizeLyricOptions): void {
		this.optimizeOptions = { ...this.optimizeOptions, ...options };
	}

	/**
	 * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	 * @param lines 歌词数组
	 * @param initialTime 初始时间，默认为 0
	 */
	setLyricLines(lines: LyricLine[], initialTime = 0): void {
		if (import.meta.env.DEV) {
			console.log("设置歌词行", lines, initialTime);
		}

		this.timelineState.initialLayoutFinished = true;
		this.timelineState.lastCurrentTime = initialTime;
		this.timelineState.currentTime = initialTime;

		this.currentLyricLines = structuredClone(lines);
		this.processedLines = structuredClone(this.currentLyricLines);
		optimizeLyricLines(this.processedLines, this.optimizeOptions);

		this.isNonDynamic = true;
		for (const line of this.processedLines) {
			if (line.words.length > 1) {
				this.isNonDynamic = false;
				break;
			}
		}

		this.hasDuetLine = this.processedLines.some((line) => line.isDuet);

		for (const group of this.currentLyricGroups) {
			group.dispose();
		}
		this.currentLyricGroups = [];

		this.interludeDots.setInterlude(undefined);
		this.timelineState.hotGroups.clear();
		this.timelineState.bufferedGroups.clear();

		if (import.meta.env.DEV) {
			console.log("歌词处理完成", this);
		}
	}

	/**
	 * 获取当前是否在播放
	 * @returns 当前是否在播放
	 */
	public getIsPlaying(): boolean {
		return this.timelineState.isPlaying;
	}

	/**
	 * 设置当前播放进度，此时将会更新内部的歌词进度信息。
	 *
	 * 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好。
	 * 调用完成后，应每帧调用 {@link update} 方法来执行歌词动画效果。**此函数本身不会触发动画效果**。
	 *
	 * @param time 当前播放进度，单位为毫秒
	 */
	setCurrentTime(time: number, isSeek = false): void {
		// 歌词行为如下：
		// 如果当前仍有缓冲行的情况下加入新热行，则不会解除当前缓冲行，且也不会修改当前滚动位置
		// 如果当前所有缓冲行都将被删除且没有新热行加入，则删除所有缓冲行，且也不会修改当前滚动位置
		// 如果当前所有缓冲行都将被删除且有新热行加入，则删除所有缓冲行并加入新热行作为缓冲行，然后修改当前滚动位置

		time = Math.round(time);

		const { timelineState } = this;
		timelineState.isSeeking = Boolean(isSeek);
		timelineState.currentTime = time;

		if (!timelineState.initialLayoutFinished && !timelineState.isSeeking)
			return;

		const stateResult = computePlayerTimeState({
			time,
			currentGroups: this.currentLyricGroups,
			timelineState,
		});

		const bottomEl = this.bottomLine.getElement();
		const hasBottomContent = bottomEl.innerHTML.trim().length > 0;
		const commitResult = commitPlayerTimeState({
			timelineState: timelineState,
			time,
			currentGroups: this.currentLyricGroups,
			hasBottomContent,
			stateResult,
		});

		for (const id of commitResult.groupsToDisable)
			this.currentLyricGroups[id]?.disable();

		for (const id of commitResult.groupsToEnable)
			this.currentLyricGroups[id]?.enable();

		if (commitResult.shouldResetScroll) this.resetScroll();
		if (commitResult.shouldLayout) this.calcLayout();
	}

	/**
	 * 重新布局定位歌词行的位置，调用完成后再逐帧调用 `update`
	 * 函数即可让歌词通过动画移动到目标位置。
	 *
	 * 函数有一个 `force` 参数，用于指定是否强制修改布局，也就是不经过动画直接调整元素位置和大小。
	 *
	 * 此函数还有一个 `reflow` 参数，用于指定是否需要重新计算布局
	 *
	 * 因为计算布局必定会导致浏览器重排布局，所以会大幅度影响流畅度和性能，故请只在以下情况下将其​设置为 true：
	 *
	 * 1. 歌词页面大小发生改变时（这个组件会自行处理）
	 * 2. 加载了新的歌词时（不论前后歌词是否完全一样）
	 * 3. 用户自行跳转了歌曲播放位置（不论距离远近）
	 *
	 * @param sync 是否同步执行，通常用于初始化或 Resize 时立即布局
	 * @param force 是否绕过弹簧效果强制更新位置
	 */
	async calcLayout(sync = false, force = false): Promise<void> {
		const interlude = computeCurrentInterlude({
			currentTime: this.timelineState.currentTime,
			scrollToIndex: this.timelineState.scrollToIndex,
			currentGroups: this.currentLyricGroups,
		});
		const isInterludeActive = !!interlude;

		if (
			this.layoutState.targetAlignIndex !== this.timelineState.scrollToIndex ||
			this.layoutState.lastInterludeState !== isInterludeActive
		) {
			this.layoutState.lastInterludeState = isInterludeActive;

			const springParams = computeLinePosYSpringParams({
				enabled: this.getEnableSpring(),
				currentGroups: this.currentLyricGroups,
				scrollToIndex: this.timelineState.scrollToIndex,
				isSeeking: this.timelineState.isSeeking,
				isInterludeActive,
			});
			if (springParams.shouldUpdate && springParams.params) {
				this.setLinePosYSpringParams(springParams.params);
			}
		}

		let curPos = -this.scrollState.scrollOffset;
		const targetAlignIndex = this.timelineState.scrollToIndex;
		let isNextDuet = false;
		if (interlude) {
			isNextDuet = interlude.isNextDuet;
		} else {
			this.interludeDots.setInterlude(undefined);
		}

		const fontSize = this.baseFontSize || 24;
		const dotMargin = fontSize * 0.4;
		const totalInterludeHeight =
			this.layoutState.interludeDotsSize[1] + dotMargin * 2;

		if (interlude) {
			if (interlude.anchorLineIndex !== -1) {
				curPos -= totalInterludeHeight;
			}
		}
		// 避免一开始就让所有歌词行挤在一起
		const LINE_HEIGHT_FALLBACK = this.size[1] / 5;
		const scrollOffset = this.currentLyricGroups
			.slice(0, targetAlignIndex)
			.reduce(
				(acc, group) =>
					acc + (this.lyricGroupSize.get(group)?.[1] ?? LINE_HEIGHT_FALLBACK),
				0,
			);

		this.scrollState.scrollBoundary.minOffset = -scrollOffset;
		curPos -= scrollOffset;
		curPos += this.size[1] * this.layoutState.alignPosition;

		const curGroup = this.currentLyricGroups[targetAlignIndex];
		this.layoutState.targetAlignIndex = targetAlignIndex;

		const isBottomFocused = targetAlignIndex === this.currentLyricGroups.length;
		this.bottomLine.setFocused(isBottomFocused);

		const targetLineHeight = curGroup
			? (this.lyricGroupSize.get(curGroup)?.[1] ?? LINE_HEIGHT_FALLBACK)
			: isBottomFocused
				? this.bottomLine.lineSize[1]
				: 0;

		if (targetLineHeight > 0) {
			switch (this.layoutState.alignAnchor) {
				case LayoutAlignAnchor.Bottom:
					curPos -= targetLineHeight;
					break;
				case LayoutAlignAnchor.Center:
					curPos -= targetLineHeight / 2;
					break;
				case LayoutAlignAnchor.Top:
					break;
			}
		}

		const latestIndex = Math.max(...this.timelineState.bufferedGroups);
		let delay = 0;
		let baseDelay = sync ? 0 : 0.05;
		let setDots = false;

		this.currentLyricGroups.forEach((group, i) => {
			const hasBuffered = this.timelineState.bufferedGroups.has(i);

			const shouldShowDots = interlude && i === interlude.anchorLineIndex + 1;

			if (!setDots && shouldShowDots) {
				setDots = true;

				curPos += dotMargin;

				let targetX = 0;
				if (interlude && isNextDuet) {
					targetX = this.size[0] - this.layoutState.interludeDotsSize[0];
				}

				this.interludeDots.setTransform(targetX, curPos);

				if (interlude) {
					this.interludeDots.setInterlude([
						interlude.startTime,
						interlude.endTime,
					]);
				}
				curPos += this.layoutState.interludeDotsSize[1];
				curPos += dotMargin;
			}

			const presentation = computeGroupPresentation({
				groupIndex: i,
				scrollToIndex: this.timelineState.scrollToIndex,
				latestIndex,
				hasBuffered,
				hidePassedLines: this.hidePassedLines,
				isPlaying: this.timelineState.isPlaying,
				isNonDynamic: this.isNonDynamic,
				enableBlur: this.enableBlur,
				isUserScrolling: this.scrollState.isUserScrolling,
				isCompact: window.innerWidth <= 1024,
				interlude,
			});

			group.setTransform(
				curPos,
				force,
				delay,
				presentation.isActive,
				presentation.targetOpacity,
				presentation.blurLevel,
			);

			curPos += this.lyricGroupSize.get(group)?.[1] ?? LINE_HEIGHT_FALLBACK;

			if (curPos >= 0 && !this.timelineState.isSeeking) {
				delay += baseDelay;
				if (i >= this.timelineState.scrollToIndex) baseDelay /= 1.05;
			}
		});
		this.scrollState.scrollBoundary.maxOffset =
			curPos + this.scrollState.scrollOffset - this.size[1] / 2;

		const bottomIndex = this.currentLyricGroups.length;
		const finalBottomBlur = computeLineBlur({
			enableBlur: this.enableBlur,
			isUserScrolling: this.scrollState.isUserScrolling,
			isActive: isBottomFocused,
			itemIndex: bottomIndex,
			scrollToIndex: this.timelineState.scrollToIndex,
			latestIndex,
			isCompact: window.innerWidth <= 1024,
		});

		this.bottomLine.setTransform(0, curPos, finalBottomBlur, force, delay);
	}

	/**
	 * 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 * @deprecated 考虑到横向弹簧效果并不常见，所以这个函数将会在未来的版本中移除
	 */
	setLinePosXSpringParams(_params: Partial<SpringParams> = {}): void {}
	/**
	 * 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	setLinePosYSpringParams(params: Partial<SpringParams> = {}): void {
		this.posYSpringParams = {
			...this.posYSpringParams,
			...params,
		};
		this.bottomLine.lineTransforms.posY.updateParams(this.posYSpringParams);
		for (const group of this.currentLyricGroups) {
			group.posY.updateParams(this.posYSpringParams);
			group.bgSlideY.updateParams(this.posYSpringParams);
		}
	}
	/**
	 * 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	setLineScaleSpringParams(params: Partial<SpringParams> = {}): void {
		this.scaleSpringParams = {
			...this.scaleSpringParams,
			...params,
		};
		this.scaleForBGSpringParams = {
			...this.scaleForBGSpringParams,
			...params,
		};
		for (const group of this.currentLyricGroups) {
			group.mainLine.lineTransforms.scale.updateParams(this.scaleSpringParams);

			group.bgLine?.lineTransforms.scale.updateParams(
				this.scaleForBGSpringParams,
			);
		}
	}
	/**
	 * 暂停部分效果演出，目前会暂停播放间奏点的动画，且将背景歌词显示出来
	 */
	pause(): void {
		this.interludeDots.pause();
		if (this.timelineState.isPlaying) {
			this.timelineState.isPlaying = false;
			this.calcLayout();
		}
	}
	/**
	 * 恢复部分效果演出，目前会恢复播放间奏点的动画
	 */
	resume(): void {
		this.interludeDots.resume();
		if (!this.timelineState.isPlaying) {
			this.timelineState.isPlaying = true;
			this.calcLayout();
		}
	}
	/**
	 * 更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：
	 *
	 * 1. 刚刚调用完设置歌词函数的时候
	 * @param delta 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数）
	 */

	update(delta = 0): void {
		this.bottomLine.update(delta / 1000);
		this.interludeDots.update(delta);
	}

	protected onResize(): void {}

	/**
	 * 获取一个特殊的底栏元素，默认是空白的，可以往内部添加任意元素
	 *
	 * 这个元素始终在歌词的底部，可以用于显示歌曲创作者等信息
	 *
	 * 但是请勿删除该元素，只能在内部存放元素
	 *
	 * @returns 一个元素，可以往内部添加任意元素
	 */
	getBottomLineElement(): HTMLElement {
		return this.bottomLine.getElement();
	}
	/**
	 * 重置用户滚动状态
	 *
	 * 请在用户完成滚动点击跳转歌词时调用本事件再调用 `calcLayout` 以正确滚动到目标位置
	 */
	resetScroll(): void {
		resetPlayerScrollState(this.scrollState);
		clearTimeout(this.scrolledHandler);
	}
	/**
	 * 获取当前歌词数组
	 *
	 * 一般和最后调用 `setLyricLines` 给予的参数一样
	 * @returns 当前歌词数组
	 */
	getLyricLines(): LyricLine[] {
		return this.currentLyricLines;
	}
	/**
	 * 获取当前歌词的播放位置
	 *
	 * 一般和最后调用 `setCurrentTime` 给予的参数一样
	 * @returns 当前播放位置
	 */
	getCurrentTime(): number {
		return this.timelineState.currentTime;
	}

	/**
	 * 设置是否让背景人声行始终后置显示
	 *
	 * 默认情况下，如果背景歌词开始时间早于主歌词，会在主歌词上方展示；
	 * 如果设置为 `true`，则无论时间顺序如何，背景歌词都会始终在主歌词下方展示
	 * @param enable 是否启用始终后置
	 */
	setAlwaysPostpositionBackground(enable: boolean): void {
		if (this.alwaysPostpositionBackground === enable) {
			return;
		}

		this.alwaysPostpositionBackground = enable;

		this.rebuildLyricLines();
		this.calcLayout();
	}

	/** 获取当前是否设置了让背景人声行始终后置显示 */
	getAlwaysPostpositionBackground(): boolean {
		return this.alwaysPostpositionBackground;
	}

	getElement(): HTMLElement {
		return this.element;
	}
	dispose(): void {
		this.element.remove();
		window.removeEventListener("pageshow", this.onPageShow);
		window.removeEventListener("pagehide", this.onPageHide);
	}
}
