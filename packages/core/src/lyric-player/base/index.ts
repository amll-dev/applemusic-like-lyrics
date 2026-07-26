import structuredClone from "@ungap/structured-clone";
import type {
	Disposable,
	HasElement,
	LyricLine,
	LyricWord,
	OptimizeLyricOptions,
} from "#interfaces";
import styles from "#styles/lyric-player.module.css";
import { clamp, clampPositive } from "#utils/clamp.ts";
import { optimizeLyricLines } from "#utils/optimize-lyric.ts";
import type { SpringParams } from "#utils/spring.ts";
import { InterludeDots } from "../dom/interlude-dots.ts";
import { BottomLineEl } from "./bottom-line.ts";
import { LayoutAlignAnchor, MaskObsceneWordsMode } from "./consts.ts";
import type { LyricLineGroupBase } from "./group.ts";
import type { LyricLineBase } from "./line.ts";
import {
	attachPlayerScrollHandlers,
	type PlayerScrollState,
	resetPlayerScrollState,
} from "./scroll.ts";

export type { LyricLineBase } from "./line.ts";
export type { PlayerScrollState } from "./scroll.ts";

/**
 * 播放器布局状态。
 *
 * 这部分状态保存布局计算阶段所需的配置项与缓存值，
 * 例如对齐方式、间奏点尺寸、上一轮布局命中的目标行等。
 * 不描述播放时间线或用户滚动交互，仅记录当前歌词排布。
 */
export interface PlayerLayoutState {
	/** 间奏点元素当前测量得到的尺寸 */
	interludeDotsSize: [number, number];
	/** 上一轮布局实际对齐的目标歌词行索引 */
	targetAlignIndex: number;
	/** 上一轮布局时是否处于间奏区间 */
	lastInterludeState: boolean;
	/** 当前歌词目标行的对齐锚点 */
	alignAnchor: LayoutAlignAnchor;
	/** 当前歌词目标行在播放器高度中的相对对齐位置 */
	alignPosition: number;
	/** 视口上下额外保留的预渲染距离，单位为像素 */
	overscanPx: number;
}

/**
 * 当前命中的间奏区间信息。
 *
 * 当播放器检测到当前时间处于两句歌词之间的较长空档期时，
 * 会生成该结构，用于驱动间奏点动画的显示位置与时间范围。
 */
export interface PlayerInterlude {
	/** 间奏动画的开始时间 */
	startTime: number;
	/** 间奏动画的结束时间 */
	endTime: number;
	/** 间奏点应插入到哪一行之后；`-1` 表示位于第一行之前 */
	anchorLineIndex: number;
	/** 间奏结束后的下一句是否为对唱歌词 */
	isNextDuet: boolean;
}

/**
 * 播放时间线状态。
 *
 * 描述播放器在时间轴上的当前位置，当前处于激活状态的歌词组信息
 */
export interface PlayerTimelineState {
	/** 当前播放时间，单位为毫秒 */
	currentTime: number;
	/** 上一次提交到时间线状态的播放时间，单位为毫秒 */
	lastCurrentTime: number;
	/** 热行：当前时间 {@link currentTime} 正在命中的组（含主行+可能的背景行） */
	hotGroups: Set<number>;
	/** 缓冲组：UI 上还保持激活表现的组索引，通常包含热组，和刚结束仍在过渡中的组 */
	bufferedGroups: Set<number>;
	/** 当前应滚动对齐到的歌词组索引 */
	scrollToIndex: number;
	/** 是否正在拖拽进度条。若是，更新时丢弃缓冲行，并根据当前时间直接计算热行 */
	isSeeking: boolean;
	/** 是否处于播放状态 */
	isPlaying: boolean;
	/** 是否已经完成至少一次初始布局 */
	initialLayoutFinished: boolean;
	/** 当前是否处于间奏期间 */
	activeInterlude?: PlayerInterlude;
}

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
		activeInterlude: undefined,
	};

	private tempAddedIds: number[] = [];
	private tempRemovedHotIds: number[] = [];
	private tempRemovedBufferedIds: number[] = [];

	private hasBottomContent = false;
	private bottomLineObserver: MutationObserver;

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

		this.bottomLineObserver = new MutationObserver(() => {
			const bottomEl = this.bottomLine.getElement();
			this.hasBottomContent = bottomEl.innerHTML.trim().length > 0;
		});
		this.bottomLineObserver.observe(this.bottomLine.getElement(), {
			childList: true,
			characterData: true,
			subtree: true,
		});

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
	 * 当 `isSeek` 为 `true` 时，将触发重新排版，代价较高，因此请只在真正跳转时设为 `true`
	 *
	 * @param time 当前播放进度，单位为毫秒
	 * @param isSeek 是否为用户手动跳转进度
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

		if (!timelineState.initialLayoutFinished && !timelineState.isSeeking) {
			return;
		}

		let shouldLayout = false;
		let shouldResetScroll = false;

		if (timelineState.isSeeking) {
			const result = this.syncForSeek(time);
			shouldLayout = result.shouldLayout;
			shouldResetScroll = result.shouldResetScroll;
		} else {
			const result = this.syncForPlayback(time);
			shouldLayout = result.shouldLayout;
			shouldResetScroll = result.shouldResetScroll;
		}

		if (shouldResetScroll) this.resetScroll();
		if (shouldLayout) this.calcLayout();
	}

	/**
	 * 处理 Seek 时的时间线推倒
	 *
	 * 将会丢弃历史缓冲行，直接根据当前时间重新计算热行
	 */
	private syncForSeek(time: number): {
		shouldLayout: boolean;
		shouldResetScroll: boolean;
	} {
		const { timelineState, currentLyricGroups } = this;

		this.tempRemovedHotIds.length = 0;
		for (const id of timelineState.hotGroups) {
			this.tempRemovedHotIds.push(id);
		}
		this.tempRemovedBufferedIds.length = 0;
		for (const id of timelineState.bufferedGroups) {
			if (!timelineState.hotGroups.has(id)) {
				this.tempRemovedBufferedIds.push(id);
			}
		}

		timelineState.hotGroups.clear();
		timelineState.bufferedGroups.clear();

		// TODO: 二分查找优化性能
		for (let id = 0; id < currentLyricGroups.length; id++) {
			const group = currentLyricGroups[id];
			if (group && group.startTime <= time && group.endTime > time) {
				timelineState.hotGroups.add(id);
				timelineState.bufferedGroups.add(id);
			}
		}

		if (timelineState.bufferedGroups.size > 0) {
			timelineState.scrollToIndex = Math.min(...timelineState.bufferedGroups);
		} else {
			let foundIndex = -1;
			for (let i = 0; i < currentLyricGroups.length; i++) {
				if (currentLyricGroups[i]?.startTime >= time) {
					foundIndex = i;
					break;
				}
			}
			timelineState.scrollToIndex =
				foundIndex === -1 ? currentLyricGroups.length : foundIndex;
		}

		// 就地启用/停用对应歌词行
		for (const id of this.tempRemovedHotIds) {
			if (!timelineState.bufferedGroups.has(id))
				currentLyricGroups[id]?.disable();
		}
		for (const id of this.tempRemovedBufferedIds) {
			if (!timelineState.bufferedGroups.has(id))
				currentLyricGroups[id]?.disable();
		}
		for (const id of timelineState.hotGroups) {
			currentLyricGroups[id]?.enable();
		}

		// 重新计算间奏信息
		this.updateInterludeState(time, timelineState.scrollToIndex);

		timelineState.lastCurrentTime = time;

		// Seek 需要重排与重置滚动
		return { shouldLayout: true, shouldResetScroll: true };
	}

	/**
	 * 根据当前时间与给定的基准行，计算间奏区间状态
	 */
	private updateInterludeState(
		currentTime: number,
		currentIndex: number,
	): void {
		const time = currentTime + 20;
		const groups = this.currentLyricGroups;

		const checkGap = (k: number): PlayerInterlude | undefined => {
			if (k < -1 || k >= groups.length - 1) return undefined;

			const prevGroup = k === -1 ? null : groups[k];
			const nextGroup = groups[k + 1];

			const gapStart = prevGroup ? prevGroup.endTime : 0;
			const gapEnd = Math.max(gapStart, nextGroup.startTime - 250);

			if (gapEnd - gapStart < 4000) return undefined;

			if (gapEnd > time && gapStart < time) {
				return {
					startTime: Math.max(gapStart, time),
					endTime: gapEnd,
					anchorLineIndex: k,
					isNextDuet: nextGroup.mainLine.getLine().isDuet,
				};
			}
			return undefined;
		};

		this.timelineState.activeInterlude =
			checkGap(currentIndex - 1) ||
			checkGap(currentIndex) ||
			checkGap(currentIndex + 1);
	}

	/**
	 * 处理正常播放时的时间线推导
	 */
	private syncForPlayback(time: number): {
		shouldLayout: boolean;
		shouldResetScroll: boolean;
	} {
		const { timelineState, currentLyricGroups } = this;
		let shouldLayout = false;

		this.tempAddedIds.length = 0;
		this.tempRemovedHotIds.length = 0;
		this.tempRemovedBufferedIds.length = 0;

		// 检索已经过期的热行
		for (const lastHotId of timelineState.hotGroups) {
			const group = currentLyricGroups[lastHotId];
			if (!group || time < group.startTime || group.endTime <= time) {
				timelineState.hotGroups.delete(lastHotId);
				this.tempRemovedHotIds.push(lastHotId);
			}
		}

		// TODO: 用滑动窗口和二分查找优化性能
		for (let id = 0; id < currentLyricGroups.length; id++) {
			const group = currentLyricGroups[id];
			if (
				group &&
				group.startTime <= time &&
				group.endTime > time &&
				!timelineState.hotGroups.has(id)
			) {
				timelineState.hotGroups.add(id);
				this.tempAddedIds.push(id);
			}
		}

		// 检索应该被移除的缓冲行
		for (const id of timelineState.bufferedGroups) {
			if (!timelineState.hotGroups.has(id)) {
				this.tempRemovedBufferedIds.push(id);
			}
		}

		if (this.tempAddedIds.length > 0) {
			for (const id of this.tempAddedIds) {
				timelineState.bufferedGroups.add(id);
				currentLyricGroups[id]?.enable();
			}
			for (const id of this.tempRemovedBufferedIds) {
				timelineState.bufferedGroups.delete(id);
				currentLyricGroups[id]?.disable();
			}
			if (timelineState.bufferedGroups.size > 0) {
				timelineState.scrollToIndex = Math.min(...timelineState.bufferedGroups);
			}
			shouldLayout = true;
		} else if (
			this.tempRemovedBufferedIds.length > 0 &&
			this.tempRemovedBufferedIds.length === timelineState.bufferedGroups.size
		) {
			for (const id of timelineState.bufferedGroups) {
				if (timelineState.hotGroups.has(id)) continue;
				timelineState.bufferedGroups.delete(id);
				currentLyricGroups[id]?.disable();
			}
			shouldLayout = true;
		}

		// 整首歌播放完毕后聚焦到底栏
		if (
			timelineState.bufferedGroups.size === 0 &&
			currentLyricGroups.length > 0
		) {
			const lastGroup = currentLyricGroups[currentLyricGroups.length - 1];
			if (time >= lastGroup.endTime) {
				const targetIndex = this.hasBottomContent
					? currentLyricGroups.length
					: currentLyricGroups.length - 1;
				if (timelineState.scrollToIndex !== targetIndex) {
					timelineState.scrollToIndex = targetIndex;
					shouldLayout = true;
				}
			}
		}

		// 更新间奏状态
		const prevInterlude = timelineState.activeInterlude;
		this.updateInterludeState(time, timelineState.scrollToIndex);
		const currInterlude = timelineState.activeInterlude;

		if (
			(!prevInterlude && currInterlude) ||
			(prevInterlude && !currInterlude) ||
			(prevInterlude &&
				currInterlude &&
				prevInterlude.anchorLineIndex !== currInterlude.anchorLineIndex)
		) {
			shouldLayout = true;
		}

		timelineState.lastCurrentTime = time;

		return { shouldLayout, shouldResetScroll: false };
	}

	/**
	 * 更新歌词纵向滚动动画的弹簧参数。
	 *
	 * 其策略为：
	 * - seeking 或间奏时使用更稳定的固定参数
	 * - 普通播放时根据相邻歌词的时间间隔动态调整 stiffness / damping
	 */
	private updateSpringParams(isInterludeActive: boolean): void {
		if (!this.getEnableSpring() || this.currentLyricGroups.length === 0) {
			return;
		}

		const { scrollToIndex, isSeeking } = this.timelineState;

		if (isSeeking || isInterludeActive) {
			this.setLinePosYSpringParams({ stiffness: 90, damping: 15 });
			return;
		}

		const currentGroup = this.currentLyricGroups[scrollToIndex];
		const prevGroup = this.currentLyricGroups[scrollToIndex - 1];

		if (!currentGroup || !prevGroup) {
			return;
		}

		const interval = currentGroup.startTime - prevGroup.startTime;
		const MIN_INTERVAL = 100;
		const MAX_INTERVAL = 800;
		const clampedInterval = clamp(interval, MIN_INTERVAL, MAX_INTERVAL);

		const MAX_STIFFNESS = 220;
		const MIN_STIFFNESS = 170;

		let ratio =
			1 - (clampedInterval - MIN_INTERVAL) / (MAX_INTERVAL - MIN_INTERVAL);
		ratio = ratio ** 0.2;

		const targetStiffness =
			MIN_STIFFNESS + ratio * (MAX_STIFFNESS - MIN_STIFFNESS);
		const dampingMultiplier = 2.2;
		const targetDamping = Math.sqrt(targetStiffness) * dampingMultiplier;

		this.setLinePosYSpringParams({
			stiffness: targetStiffness,
			damping: targetDamping,
		});
	}

	/**
	 * 重新布局定位歌词行的位置，调用完成后再逐帧调用 `update`
	 * 函数即可让歌词通过动画移动到目标位置。
	 *
	 * 函数有一个 `force` 参数，用于指定是否强制修改布局，也就是不经过动画直接调整元素位置和大小。
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
		const interlude = this.timelineState.activeInterlude;
		const isInterludeActive = !!interlude;

		if (
			this.layoutState.targetAlignIndex !== this.timelineState.scrollToIndex ||
			this.layoutState.lastInterludeState !== isInterludeActive
		) {
			this.layoutState.lastInterludeState = isInterludeActive;
			this.updateSpringParams(isInterludeActive);
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

		if (interlude && interlude.anchorLineIndex !== -1) {
			curPos -= totalInterludeHeight;
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

			const isActive =
				hasBuffered ||
				(i >= this.timelineState.scrollToIndex && i < latestIndex);

			let blurLevel = 0;
			if (this.enableBlur && !this.scrollState.isUserScrolling && !isActive) {
				blurLevel = 1;
				if (i < this.timelineState.scrollToIndex) {
					blurLevel += Math.abs(this.timelineState.scrollToIndex - i) + 1;
				} else {
					blurLevel += Math.abs(
						i - Math.max(this.timelineState.scrollToIndex, latestIndex),
					);
				}
				if (window.innerWidth <= 1024) {
					blurLevel *= 0.8;
				}
			}

			let targetOpacity: number;

			if (this.hidePassedLines) {
				if (
					i <
						(interlude
							? interlude.anchorLineIndex + 1
							: this.timelineState.scrollToIndex) &&
					this.timelineState.isPlaying
				) {
					// 为了避免浏览器优化，这里使用了一个极小但不为零的值（几乎不可见）
					targetOpacity = 1e-4;
				} else if (hasBuffered) {
					targetOpacity = 0.85;
				} else {
					targetOpacity = this.isNonDynamic ? 0.2 : 1;
				}
			} else if (hasBuffered) {
				targetOpacity = 0.85;
			} else {
				targetOpacity = this.isNonDynamic ? 0.2 : 1;
			}

			group.setTransform(
				curPos,
				force,
				delay,
				isActive,
				targetOpacity,
				blurLevel,
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

		let finalBottomBlur = 0;
		if (
			this.enableBlur &&
			!this.scrollState.isUserScrolling &&
			!isBottomFocused
		) {
			finalBottomBlur = 1;
			if (bottomIndex < this.timelineState.scrollToIndex) {
				finalBottomBlur +=
					Math.abs(this.timelineState.scrollToIndex - bottomIndex) + 1;
			} else {
				finalBottomBlur += Math.abs(
					bottomIndex - Math.max(this.timelineState.scrollToIndex, latestIndex),
				);
			}
			if (window.innerWidth <= 1024) {
				finalBottomBlur *= 0.8;
			}
		}

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
		this.bottomLineObserver.disconnect();
		window.removeEventListener("pageshow", this.onPageShow);
		window.removeEventListener("pagehide", this.onPageHide);
	}
}
