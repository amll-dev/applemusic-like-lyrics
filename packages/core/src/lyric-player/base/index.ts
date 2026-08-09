import type {
	Disposable,
	HasElement,
	LyricLine,
	OptimizeLyricOptions,
} from "#interfaces";
import styles from "#styles/lyric-player.module.css";
import { clampPositive } from "#utils/clamp.ts";
import { areOptimizeOptionsEqual } from "#utils/optimize-lyric.ts";
import type { SpringParams } from "#utils/spring.ts";
import { InterludeDots } from "../dom/interlude-dots.ts";
import { BottomLineEl } from "./bottom-line.ts";
import { LayoutAlignAnchor, type MaskObsceneWordsMode } from "./consts.ts";
import type { LyricLineGroupBase } from "./group.ts";
import type { LyricLineBase } from "./line.ts";
import {
	type LyricDataConfig,
	LyricDataManager,
} from "./lyric-data-manager.ts";
import { type ScrollInputType, ScrollInteractionEngine } from "./scroll.ts";
import { getPosYSpringPolicy } from "./spring";
import { TimelineController } from "./timeline.ts";

export type { LyricLineBase } from "./line.ts";
export type { LyricDataConfig } from "./lyric-data-manager.ts";

/**
 * 播放器布局状态。
 *
 * 这部分状态保存布局计算阶段所需的配置项与缓存值，
 * 例如对齐方式、间奏点尺寸、上一轮布局命中的目标行等。
 * 不描述播放时间线或用户滚动交互，仅记录当前歌词排布。
 */
interface PlayerLayoutState {
	/** 间奏点元素当前测量得到的尺寸 */
	interludeDotsSize: [number, number];
	/** 上一轮布局实际对齐的目标歌词行索引 */
	targetAlignIndex: number;
	/** 当前歌词目标行的对齐锚点 */
	alignAnchor: LayoutAlignAnchor;
	/** 当前歌词目标行在播放器高度中的相对对齐位置 */
	alignPosition: number;
	/** 视口上下额外保留的预渲染距离，单位为像素 */
	overscanPx: number;
}

/**
 * 播放器滚动状态。
 *
 * 这部分状态描述用户手势/滚轮滚动产生的临时偏移，以及当前允许滚动的范围。
 */
interface PlayerScrollState {
	/** 当前用户滚动带来的额外偏移量 */
	scrollOffset: number;
	/** 是否处于用户滚动过，尚未回归自动对齐的状态 */
	isAutoAlignSuspended: boolean;
	isTouchScrolled: boolean;
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

	protected isPlaying = false;
	protected timelineController: TimelineController = new TimelineController();

	private hasBottomContent = false;
	private bottomLineObserver: MutationObserver;

	/** @internal */
	lyricGroupElementMap: WeakMap<Element, LyricLineGroupBase> = new WeakMap();
	protected lyricLinesIndexes: WeakMap<LyricLineBase, number> = new WeakMap();
	protected disableSpring = false;

	protected dataManager: LyricDataManager = new LyricDataManager();
	protected get processedLines(): ReadonlyArray<LyricLine> {
		return this.dataManager.getProcessedLines();
	}
	protected get isNonDynamic(): boolean {
		return this.dataManager.getIsNonDynamic();
	}
	protected get hasDuetLine(): boolean {
		return this.dataManager.getHasDuetLine();
	}

	protected layoutState: PlayerLayoutState = {
		interludeDotsSize: [0, 0],
		targetAlignIndex: 0,
		alignAnchor: LayoutAlignAnchor.Center,
		alignPosition: 0.35,
		overscanPx: 300,
	};
	protected interludeDots: InterludeDots = new InterludeDots();
	protected bottomLine: BottomLineEl = new BottomLineEl(this);
	protected enableBlur = true;
	protected enableScale = true;
	protected hidePassedLines = false;

	protected scrollEngine: ScrollInteractionEngine;
	protected scrollState: PlayerScrollState = {
		scrollOffset: 0,
		isAutoAlignSuspended: false,
		isTouchScrolled: false,
	};

	public currentLyricGroups: LyricLineGroupBase[] = [];
	lyricGroupSize: WeakMap<LyricLineGroupBase, [number, number]> = new WeakMap();
	readonly size: [number, number] = [0, 0];
	protected isPageVisible = true;

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
		this.setCurrentTime(
			this.timelineController.getSnapshot().currentTime,
			true,
		);
	};
	private onPageHide = () => {
		this.isPageVisible = false;
	};
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

		this.scrollEngine = new ScrollInteractionEngine(this.element, {
			onScrollUpdate: (offset: number, isContinuous: boolean) => {
				this.scrollState.scrollOffset = offset;
				this.calcLayout(true, isContinuous);
			},
			onInteractionStart: (type: ScrollInputType) => {
				this.scrollState.isAutoAlignSuspended = true;
				this.scrollState.isTouchScrolled = type === "touch";
				this.calcLayout(true, false);
			},
			onInteractionEnd: () => {},
			onAutoAlignResume: () => {
				this.scrollState.isAutoAlignSuspended = false;
				this.scrollState.isTouchScrolled = false;
				this.scrollState.scrollOffset = 0;
				this.scrollEngine.resetScroll(0);
				this.calcLayout(false, false);
			},
		});
	}

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
		this.timelineController.setSeekingState(isSeeking);
		this.updateSpringParams(
			!!this.timelineController.getSnapshot().activeInterlude,
		);
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
	 * 批量更新歌词处理配置，包括优化和掩码设置
	 *
	 * @remarks
	 * 此方法不会自动重建歌词行和刷新视图，
	 * 适用于在渲染前预设配置、批量初始化，或需要手动控制 DOM 刷新时机的场景
	 * @param config 需要更新的配置集合
	 * @see {@link LyricDataConfig}
	 */
	setLyricProcessConfig(config: LyricDataConfig): void {
		this.dataManager.setConfig(config);
	}

	/**
	 * 批量更新歌词处理配置，包括优化和掩码设置
	 *
	 * 可以调用此方法以避免多次单独设置处理配置导致的多次刷新开销
	 * @remarks 在设置完成后会自动重建歌词行和刷新视图
	 * @param config 需要更新的配置集合
	 * @see {@link LyricDataConfig}
	 */
	updateLyricProcessConfig(config: LyricDataConfig): void {
		const currentOptimize = this.dataManager.getOptimizeOptions();
		const currentMaskMode = this.dataManager.getMaskMode();
		const currentMaskChar = this.dataManager.getMaskChar();

		const newOptimize =
			config.optimizeOptions !== undefined
				? config.optimizeOptions
				: currentOptimize;
		const newMaskMode =
			config.maskMode !== undefined ? config.maskMode : currentMaskMode;
		const newMaskChar =
			config.maskChar !== undefined ? config.maskChar : currentMaskChar;

		if (
			newMaskMode === currentMaskMode &&
			newMaskChar === currentMaskChar &&
			areOptimizeOptionsEqual(newOptimize, currentOptimize)
		) {
			return;
		}

		this.dataManager.setConfig({
			optimizeOptions: newOptimize,
			maskMode: newMaskMode,
			maskChar: newMaskChar,
		});

		if (this.dataManager.getRawLines().length > 0) {
			this.rebuildLyricView(this.getCurrentTime());
			this.calcLayout();
		}
	}

	/**
	 * 设置歌词中不雅用语的掩码模式
	 * @remarks 在设置完成后会自动重建歌词行和刷新视图
	 * @param mode 掩码模式
	 * @see {@link MaskObsceneWordsMode}
	 */
	setMaskObsceneWords(mode: MaskObsceneWordsMode): void {
		this.updateLyricProcessConfig({ maskMode: mode });
	}

	/**
	 * 设置不雅用语掩码使用的字符，默认为 `*`
	 * @remarks 在设置完成后会自动重建歌词行和刷新视图
	 * @param char 单个字符，用于替换不雅用语中的字符
	 */
	setMaskObsceneWordChar(char: string): void {
		const c = char.charAt(0) || "*";
		this.updateLyricProcessConfig({ maskChar: c });
	}

	/**
	 * 设置歌词的优化配置项，这些配置项默认全部开启
	 * @remarks 在设置完成后会自动重建歌词行和刷新视图
	 * @param options 优化配置选项
	 * @see {@link OptimizeLyricOptions}
	 */
	setOptimizeOptions(options: OptimizeLyricOptions): void {
		const currentOpts = this.dataManager.getOptimizeOptions();
		this.updateLyricProcessConfig({
			optimizeOptions: { ...currentOpts, ...options },
		});
	}

	rebuildLyricLines(): void {
		for (const group of this.currentLyricGroups) {
			group.rebuildAllLines();
		}
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
	 * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	 * @param lines 歌词数组
	 * @param initialTime 初始时间，默认为 0
	 */
	setLyricLines(lines: LyricLine[], initialTime = 0): void {
		if (import.meta.env.DEV) {
			console.log("设置歌词行", lines, initialTime);
		}

		this.dataManager.setOriginalLines(lines);
		this.rebuildLyricView(initialTime);
	}

	/**
	 * 获取当前是否在播放
	 * @returns 当前是否在播放
	 */
	public getIsPlaying(): boolean {
		return this.isPlaying;
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
	 * @param isSeek 这个进度变化是否为跳转触发的
	 */
	setCurrentTime(time: number, isSeek = false): void {
		time = Math.round(time);

		const diff = this.timelineController.sync(time, isSeek);

		if (!diff.hasChanged) {
			return;
		}

		for (let i = 0; i < diff.removedHighlighted.length; i++) {
			this.currentLyricGroups[diff.removedHighlighted[i]]?.disable();
		}

		for (let i = 0; i < diff.addedHighlighted.length; i++) {
			this.currentLyricGroups[diff.addedHighlighted[i]]?.enable();
		}

		if (diff.isTimeJumped) {
			if (!this.scrollState.isTouchScrolled) {
				this.resetScroll();
			}
		}

		if (
			diff.isInterludeChanged ||
			diff.isScrollToChanged ||
			diff.isTimeJumped
		) {
			const isInterludeActive =
				!!this.timelineController.getSnapshot().activeInterlude;
			this.updateSpringParams(isInterludeActive);
		}

		this.calcLayout();
	}

	/**
	 * 由子类实现的歌词组构建逻辑
	 */
	protected abstract buildLyricGroups(): void;

	/**
	 * 重新构建歌词行和时间状态
	 *
	 * 一般用于在调用 {@link setLyricProcessConfig} 更新配置后手动刷新视图，
	 * 或在外部样式/DOM 结构发生改变后重置歌词视图
	 *
	 * @param initialTime 重建后对齐的初始时间（毫秒），默认使用当前播放进度
	 */
	public rebuildLyricView(initialTime: number = this.getCurrentTime()): void {
		for (const group of this.currentLyricGroups) {
			group.dispose();
		}
		this.currentLyricGroups = [];

		this.interludeDots.setInterlude(undefined);

		this.buildLyricGroups();

		// 对歌词组进行排序，确保滑动窗口与二分查找算法面对的时间线是严格升序的
		this.currentLyricGroups.sort((a, b) => a.startTime - b.startTime);

		const bounds = this.currentLyricGroups.map((group) => ({
			startTime: group.startTime,
			endTime: group.endTime,
		}));
		this.timelineController.setTimeBounds(bounds);
		this.setCurrentTime(initialTime, true);
		this.calcLayout(true);

		if (import.meta.env.DEV) {
			console.log("歌词视图重建完成", this);
		}
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

		const snapshot = this.timelineController.getSnapshot();
		const { scrollToIndex, isSeeking } = snapshot;

		const currentGroup = this.currentLyricGroups[scrollToIndex];
		const prevGroup = this.currentLyricGroups[scrollToIndex - 1];

		let interval: number | undefined;
		if (currentGroup && prevGroup) {
			interval = currentGroup.startTime - prevGroup.startTime;
		}

		const policy = getPosYSpringPolicy(isSeeking, isInterludeActive, interval);

		this.setLinePosYSpringParams(policy);
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
		const snapshot = this.timelineController.getSnapshot();
		const interlude = snapshot.activeInterlude;
		const isInterludeFocused = snapshot.isFocusOnInterlude && !!interlude;

		if (!interlude) {
			this.interludeDots.setInterlude(undefined);
		}

		let targetAlignIndex = snapshot.scrollToIndex;

		const isLayoutFocusOnInterlude =
			isInterludeFocused && !this.scrollState.isAutoAlignSuspended;

		// 当用户接管视图滚动时，锁定排版的坐标原点不随底层播放递增
		if (this.scrollState.isAutoAlignSuspended) {
			targetAlignIndex = this.layoutState.targetAlignIndex;
		} else {
			if (isInterludeFocused && interlude) {
				targetAlignIndex = interlude.anchorLineIndex + 1;
			} else if (snapshot.isEndOfSong) {
				targetAlignIndex = this.hasBottomContent
					? this.currentLyricGroups.length
					: this.currentLyricGroups.length - 1;
			}
		}

		this.layoutState.targetAlignIndex = targetAlignIndex;

		const fontSize = this.baseFontSize || 24;
		const dotMargin = fontSize * 0.4;
		const totalInterludeHeight =
			this.layoutState.interludeDotsSize[1] + dotMargin * 2;

		// 避免一开始就让所有歌词行挤在一起
		const LINE_HEIGHT_FALLBACK = this.size[1] / 5;

		const scrollOffsetToTarget = this.currentLyricGroups
			.slice(0, targetAlignIndex)
			.reduce(
				(acc, group) =>
					acc + (this.lyricGroupSize.get(group)?.[1] ?? LINE_HEIGHT_FALLBACK),
				0,
			);

		const totalGroupsHeight = this.currentLyricGroups.reduce(
			(acc, group) =>
				acc + (this.lyricGroupSize.get(group)?.[1] ?? LINE_HEIGHT_FALLBACK),
			0,
		);

		const curGroup = this.currentLyricGroups[targetAlignIndex];
		const isBottomFocused = targetAlignIndex === this.currentLyricGroups.length;
		const targetLineHeight = isLayoutFocusOnInterlude
			? totalInterludeHeight
			: curGroup
				? (this.lyricGroupSize.get(curGroup)?.[1] ?? LINE_HEIGHT_FALLBACK)
				: isBottomFocused
					? this.bottomLine.lineSize[1]
					: 0;

		let anchorOffset = 0;
		if (targetLineHeight > 0) {
			switch (this.layoutState.alignAnchor) {
				case LayoutAlignAnchor.Bottom:
					anchorOffset = targetLineHeight;
					break;
				case LayoutAlignAnchor.Center:
					anchorOffset = targetLineHeight / 2;
					break;
				case LayoutAlignAnchor.Top:
					anchorOffset = 0;
					break;
			}
		}

		const minOffset = Math.min(0, -scrollOffsetToTarget);

		let basePosWithoutScroll =
			-scrollOffsetToTarget +
			this.size[1] * this.layoutState.alignPosition -
			anchorOffset;

		if (
			!isLayoutFocusOnInterlude &&
			interlude &&
			interlude.anchorLineIndex !== -1
		) {
			basePosWithoutScroll -= totalInterludeHeight;
		}

		const rawMaxOffset =
			basePosWithoutScroll + totalGroupsHeight - this.size[1] / 2;
		const maxOffset = Math.max(0, rawMaxOffset);

		this.scrollState.scrollOffset = this.scrollEngine.updateBoundary(
			minOffset,
			maxOffset,
		);

		let curPos = -this.scrollState.scrollOffset;

		if (
			!isLayoutFocusOnInterlude &&
			interlude &&
			interlude.anchorLineIndex !== -1
		) {
			curPos -= totalInterludeHeight;
		}

		curPos -= scrollOffsetToTarget;
		curPos += this.size[1] * this.layoutState.alignPosition;
		curPos -= anchorOffset;

		this.layoutState.targetAlignIndex = targetAlignIndex;
		this.bottomLine.setFocused(isBottomFocused);

		const fallbackFocusIndex = snapshot.scrollToIndex;
		const latestIndex = snapshot.latestHighlightedIndex ?? fallbackFocusIndex;

		let delay = 0;
		let baseDelay = sync ? 0 : 0.05;
		let setDots = false;

		this.currentLyricGroups.forEach((group, i) => {
			const hasHighlighted = snapshot.highlightedGroups.has(i);
			const shouldShowDots = interlude && i === interlude.anchorLineIndex + 1;

			if (!setDots && shouldShowDots) {
				setDots = true;
				curPos += dotMargin;

				let targetX = 0;
				if (interlude) {
					const nextLineIndex = interlude.anchorLineIndex + 1;
					const nextGroup = this.currentLyricGroups[nextLineIndex];
					const isNextDuet = nextGroup?.mainLine.getLine().isDuet ?? false;

					// 如果下一行是对唱，让间奏点右对齐
					if (isNextDuet) {
						targetX = this.size[0] - this.layoutState.interludeDotsSize[0];
					}

					this.interludeDots.setTransform(targetX, curPos);

					const shouldResetAnimation = snapshot.isSeeking || sync;
					this.interludeDots.setInterlude(
						[interlude.startTime, interlude.endTime],
						snapshot.currentTime,
						shouldResetAnimation,
					);
				}

				curPos += this.layoutState.interludeDotsSize[1];
				curPos += dotMargin;
			}

			const isActive =
				hasHighlighted || (i >= snapshot.scrollToIndex && i < latestIndex);

			const blurFocusIndex = snapshot.isTimelineEmpty
				? fallbackFocusIndex
				: latestIndex;

			let blurLevel = 0;
			let targetOpacity = 1;

			const overscan = this.layoutState.overscanPx;
			const safeBuffer = LINE_HEIGHT_FALLBACK * 2;

			const isOutOfRenderRange =
				curPos < -(overscan + safeBuffer) ||
				curPos > this.size[1] + overscan + safeBuffer;

			if (isOutOfRenderRange) {
				blurLevel = this.enableBlur ? 5 : 0;
				targetOpacity = 0;
			} else {
				if (this.enableBlur && !this.scrollState.isTouchScrolled && !isActive) {
					blurLevel = 1;
					if (i < snapshot.scrollToIndex) {
						blurLevel += Math.abs(snapshot.scrollToIndex - i) + 1;
					} else {
						blurLevel += Math.abs(i - blurFocusIndex);
					}
					if (window.innerWidth <= 1024) {
						blurLevel *= 0.8;
					}
				}

				if (this.hidePassedLines) {
					if (
						i <
							(interlude
								? interlude.anchorLineIndex + 1
								: snapshot.scrollToIndex) &&
						this.isPlaying
					) {
						// 为了避免浏览器优化，这里使用了一个极小但不为零的值（几乎不可见）
						targetOpacity = 1e-4;
					} else if (hasHighlighted) {
						targetOpacity = 0.85;
					} else {
						targetOpacity = this.isNonDynamic ? 0.2 : 1;
					}
				} else if (hasHighlighted) {
					targetOpacity = 0.85;
				} else {
					targetOpacity = this.isNonDynamic ? 0.2 : 1;
				}
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

			if (curPos >= 0 && !snapshot.isSeeking) {
				delay += baseDelay;
				if (i >= snapshot.scrollToIndex) baseDelay /= 1.05;
			}
		});

		const bottomIndex = this.currentLyricGroups.length;

		let finalBottomBlur = 0;
		const bottomBlurFocusIndex = snapshot.isTimelineEmpty
			? fallbackFocusIndex
			: latestIndex;

		if (
			this.enableBlur &&
			!this.scrollState.isAutoAlignSuspended &&
			!isBottomFocused
		) {
			finalBottomBlur = 1;
			if (bottomIndex < snapshot.scrollToIndex) {
				finalBottomBlur += Math.abs(snapshot.scrollToIndex - bottomIndex) + 1;
			} else {
				finalBottomBlur += Math.abs(bottomIndex - bottomBlurFocusIndex);
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
		if (this.isPlaying) {
			this.isPlaying = false;
			this.calcLayout();
		}
	}
	/**
	 * 恢复部分效果演出，目前会恢复播放间奏点的动画
	 */
	resume(): void {
		this.interludeDots.resume();
		if (!this.isPlaying) {
			this.isPlaying = true;
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
	 * 重置用户滚动状态并恢复自动对齐
	 *
	 * 一个典型的使用场景是在用户滚动完毕、但歌词未自动归位时立刻归位
	 */
	resetScroll(): void {
		this.scrollEngine.resetScroll(0);
		this.scrollState.isAutoAlignSuspended = false;
		this.scrollState.isTouchScrolled = false;
		this.scrollState.scrollOffset = 0;
	}
	/**
	 * 获取当前播放的、未经过优化和掩码处理的歌词数组
	 *
	 * 一般和最后调用 `setLyricLines` 给予的参数一样
	 * @returns 当前歌词数组
	 */
	getLyricLines(): ReadonlyArray<LyricLine> {
		return this.dataManager.getRawLines();
	}
	/**
	 * 获取当前歌词的播放位置
	 *
	 * 一般和最后调用 `setCurrentTime` 给予的参数一样
	 * @returns 当前播放位置
	 */
	getCurrentTime(): number {
		return this.timelineController.getSnapshot().currentTime;
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
		this.scrollEngine.dispose();
		this.element.remove();
		this.bottomLineObserver.disconnect();
		window.removeEventListener("pageshow", this.onPageShow);
		window.removeEventListener("pagehide", this.onPageHide);
	}
}
