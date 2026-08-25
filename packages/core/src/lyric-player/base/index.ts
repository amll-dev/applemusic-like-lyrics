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
import { Duration, MediaTime } from "#utils/time.ts";
import type { BottomLine } from "./bottom-line.ts";
import {
	LayoutAlignAnchor,
	LayoutReason,
	LayoutReasonStrategyMap,
	type MaskObsceneWordsMode,
} from "./consts.ts";
import { FocusController } from "./focus.ts";
import type { LyricLineGroupBase } from "./group.ts";
import type { InterludeDots } from "./interlude-dots.ts";
import {
	LayoutCalculator,
	type LayoutConfig,
	type LayoutFrameContext,
} from "./layout.ts";
import type { LyricLineBase } from "./line.ts";
import {
	type LyricDataConfig,
	LyricDataManager,
} from "./lyric-data-manager.ts";
import { type ScrollInputType, ScrollInteractionEngine } from "./scroll.ts";
import { SeekDetector } from "./seek-detector.ts";
import { getPosYSpringPolicy } from "./spring";
import { TimelineController, type TimelineSnapshot } from "./timeline.ts";

export type { BottomLine, BottomLineTransforms } from "./bottom-line.ts";
export type { InterludeDots } from "./interlude-dots.ts";
export type { LyricLineBase } from "./line.ts";
export type { LyricDataConfig } from "./lyric-data-manager.ts";

function getEntrySize(entry: ResizeObserverEntry): [number, number] {
	if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
		const borderBox = entry.borderBoxSize[0];
		return [borderBox.inlineSize, borderBox.blockSize];
	}
	const el = entry.target as HTMLElement;
	return [
		el.offsetWidth || entry.contentRect.width,
		el.offsetHeight || entry.contentRect.height,
	];
}

/**
 * 播放器布局状态。
 *
 * 记录当前视口动态测量得到的尺寸
 */
interface PlayerLayoutState {
	/** 间奏点元素当前测量得到的尺寸 */
	interludeDotsSize: [number, number];
}

/**
 * 播放器滚动状态。
 *
 * 记录用户的滚动行为
 */
interface PlayerScrollState {
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
	protected seekDetector: SeekDetector = new SeekDetector();
	protected enableAutoSeekDetection = true;

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
	};
	protected layoutConfig: LayoutConfig = {
		alignAnchor: LayoutAlignAnchor.Center,
		alignPosition: 0.35,
		overscanPx: 300,
	};
	/** LayoutCalculator 所使用的排版上下文状态 */
	private frameContext: LayoutFrameContext = {
		containerHeight: 0,
		scrollOffset: 0,
		target: { index: 0, type: "line" },
		bottomLineHeight: 0,
		interlude: undefined,
	};
	/**
	 * 逐帧刷新的视觉推导派生值
	 *
	 * 存放会在逐行循环内被反复求值的量，避免逐行重算
	 */
	private visualFrame = {
		/** 最靠后的高亮行，无高亮时回退到 `scrollToIndex` */
		latestIndex: 0,
		/** 已播放行的分界，`hidePassedLines` 启用时此行之前的歌词被隐藏 */
		passedBoundary: 0,
		/** 是否为窄视口，窄视口下模糊强度打折 */
		isNarrowViewport: false,
	};
	protected interludeDots: InterludeDots;
	protected bottomLine: BottomLine;
	protected enableBlur = true;
	protected enableScale = true;
	protected hidePassedLines = false;

	protected scrollEngine: ScrollInteractionEngine;
	protected scrollState: PlayerScrollState = {
		isAutoAlignSuspended: false,
		isTouchScrolled: false,
	};

	protected layoutCalculator: LayoutCalculator = new LayoutCalculator();
	private focusController: FocusController = new FocusController();

	public currentLyricGroups: LyricLineGroupBase[] = [];
	lyricGroupSize: WeakMap<LyricLineGroupBase, [number, number]> = new WeakMap();
	readonly size: [number, number] = [0, 0];
	protected isPageVisible = true;

	/** 默认/回退单行歌词估算高度基准 (containerHeight / 5) */
	public get defaultLineHeight(): number {
		return this.size[1] / 5;
	}

	/**
	 * 获取指定索引歌词行的高度
	 * @remarks 可能为测量值或估算值
	 */
	public getLineHeight(index: number): number {
		return this.layoutCalculator.getLineHeight(index);
	}

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
	private lyricGroupIndexMap = new WeakMap<LyricLineGroupBase, number>();
	private onPageShow = () => {
		this.isPageVisible = true;
		this.setCurrentTime(this.getCurrentTime(), true);
	};
	private onPageHide = () => {
		this.isPageVisible = false;
	};
	/** @internal */
	resizeObserver: ResizeObserver = new ResizeObserver(((entries) => {
		let shouldRelayout = false;
		let shouldRebuildPlayerStyle = false;
		let shouldUpdateFallback = false;

		for (const entry of entries) {
			if (entry.target === this.element) {
				const rect = entry.contentRect;
				this.size[0] = rect.width;
				this.size[1] = rect.height;
				shouldRebuildPlayerStyle = true;
				shouldUpdateFallback = true;
			} else if (entry.target === this.interludeDots.getElement()) {
				const size = getEntrySize(entry);
				this.layoutState.interludeDotsSize[0] = size[0];
				this.layoutState.interludeDotsSize[1] = size[1];
				shouldRelayout = true;
			} else if (entry.target === this.bottomLine.getElement()) {
				const newSize = getEntrySize(entry);
				const oldSize: [number, number] = this.bottomLine.lineSize;

				if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
					this.bottomLine.lineSize = newSize;
					shouldRelayout = true;
				}
			} else {
				const groupObj = this.lyricGroupElementMap.get(entry.target);
				if (groupObj) {
					const newSize = getEntrySize(entry);

					const isGroupElement = entry.target === groupObj.getElement();

					if (isGroupElement) {
						const oldSize: [number, number] = this.lyricGroupSize.get(
							groupObj,
						) ?? [0, 0];

						if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
							this.lyricGroupSize.set(groupObj, newSize);
							groupObj.onLineSizeChange(newSize);

							const index = this.lyricGroupIndexMap.get(groupObj) ?? -1;
							if (index !== -1) {
								this.layoutCalculator.setLineHeight(index, newSize[1]);
							}
							shouldRelayout = true;
						}
					} else {
						groupObj.onBgSizeChange?.(newSize);
					}
				}
			}
		}

		if (shouldUpdateFallback) {
			this.layoutCalculator.updateUnmeasuredHeights(this.defaultLineHeight);
			shouldRelayout = true;
		}

		if (shouldRelayout) {
			this.calcLayout(LayoutReason.Resize);
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

		this.interludeDots = this.createInterludeDots();
		this.bottomLine = this.createBottomLine();

		this.resizeObserver.observe(this.element);
		this.resizeObserver.observe(this.interludeDots.getElement());
		this.resizeObserver.observe(this.bottomLine.getElement());

		this.element.appendChild(this.interludeDots.getElement());
		this.element.appendChild(this.bottomLine.getElement());
		this.interludeDots.setTransform(0, 200);

		this.bottomLineObserver = new MutationObserver(() => {
			const bottomEl = this.getBottomLineElement();
			const newHasBottomContent = bottomEl.innerHTML.trim().length > 0;
			if (this.hasBottomContent !== newHasBottomContent) {
				if (newHasBottomContent) {
					// 内容可能在歌词视图重建后才由调用者写入，此时也要与歌词行保持从底部远处飞入的入场效果
					this.bottomLine.resetPosition();
				}
				this.hasBottomContent = newHasBottomContent;
				this.calcLayout(LayoutReason.ConfigChange);
			}
		});
		this.bottomLineObserver.observe(this.getBottomLineElement(), {
			childList: true,
			characterData: true,
			subtree: true,
		});

		window.addEventListener("pageshow", this.onPageShow);
		window.addEventListener("pagehide", this.onPageHide);

		this.scrollEngine = new ScrollInteractionEngine(this.element, {
			onScrollUpdate: (isContinuous: boolean) => {
				this.calcLayout(
					isContinuous
						? LayoutReason.ContinuousScroll
						: LayoutReason.DiscreteScroll,
				);
			},
			onInteractionStart: (type: ScrollInputType) => {
				this.scrollState.isAutoAlignSuspended = true;
				this.scrollState.isTouchScrolled = type === "touch";
				this.calcLayout(LayoutReason.InteractionStart);
			},
			onInteractionEnd: () => {},
			onAutoAlignResume: () => {
				this.scrollState.isAutoAlignSuspended = false;
				this.scrollState.isTouchScrolled = false;
				this.scrollEngine.resetScroll(0);
				this.calcLayout(LayoutReason.InteractionEnd);
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
		this.calcLayout(LayoutReason.ConfigChange);
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

	/**
	 * 设置持续性的跳转状态
	 *
	 * @deprecated 此方法已无实际作用，调用它不会产生任何效果，仅为兼容保留，将在未来移除
	 *
	 * 跳转状态现在由每次进度推送逐帧推导，不再存在需要外部显式解除的持续状态
	 *
	 * 跳转会通过以下三条途径被识别，三者同时生效：
	 *
	 * - {@link setCurrentTime} 的 `isSeek` 参数，由调用方明确告知某次进度变化是跳转
	 * - 进度倒退或停滞，由内部无条件识别，不受任何开关控制
	 * - 自动推导，由内部比对进度的实际推进量与它应有的推进量识别超量前进，默认启用，
	 *   可通过 {@link setEnableAutoSeekDetection} 关闭
	 */
	setIsSeeking(_isSeeking: boolean): void {}

	/**
	 * 设置是否自动推导跳转状态，默认启用
	 *
	 * 启用后，即使调用 {@link setCurrentTime} 时没有传入 `isSeek`，
	 * 内部也会在进度前进时比较它的实际推进量与应有的推进量，超量前进即视为跳转
	 *
	 * 应有的推进量取决于当前的播放状态，因此请按 {@link pause} 与 {@link resume}
	 * 的文档正确同步播放状态：
	 * - 播放时以物理时钟的推进量为准，容差随之按比例放宽，以容纳倍速播放与不均匀的推送节奏
	 * - 暂停时进度本不该前进，应有的推进量是零，因此任何超出抖动幅度的前进都会被视为跳转
	 *
	 * 这意味着进度信息的粒度粗于推送间隔时，绝大多数推送都会被视为跳转，
	 * 此时应当改善进度来源的精度，或在进度未发生变化时跳过推送
	 *
	 * 较小的向前跳转可能无法被识别，但一般影响不大
	 *
	 * 此开关只控制上述超量前进的判定。进度倒退与停滞不受它控制，无论是否启用推导都会
	 * 被视为跳转：正常播放不会让进度停滞不前，因此重复推送同一个时间表达的是把逐字遮罩
	 * 这类自行推进的动画拉回到该时间的意图
	 *
	 * 推导只会额外识别出跳转，不会否决已显式传入的跳转标志，因此如果你已经在正确传入
	 * 跳转标志了，则一般无需关心此开关。若你的进度来源精度很差而导致超量前进被频繁误判，
	 * 可以选择关闭
	 *
	 * @param enable 是否启用自动推导
	 */
	setEnableAutoSeekDetection(enable = true): void {
		if (this.enableAutoSeekDetection === enable) return;
		this.enableAutoSeekDetection = enable;
		this.seekDetector.reset();
	}

	/**
	 * 获取当前是否启用了跳转状态的自动推导
	 * @returns 是否启用自动推导
	 */
	getEnableAutoSeekDetection(): boolean {
		return this.enableAutoSeekDetection;
	}

	/**
	 * 设置是否隐藏已经播放过的歌词行，默认不隐藏
	 * @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
	 */
	setHidePassedLines(hide: boolean): void {
		this.hidePassedLines = hide;
		this.calcLayout(LayoutReason.ConfigChange);
	}
	/**
	 * 设置是否启用歌词行的模糊效果
	 * @param enable 是否启用
	 */
	setEnableBlur(enable: boolean): void {
		if (this.enableBlur === enable) return;
		this.enableBlur = enable;
		this.calcLayout(LayoutReason.ConfigChange);
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
			this.calcLayout(LayoutReason.ConfigChange);
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
		this.layoutConfig.alignAnchor = alignAnchor;
	}
	/**
	 * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
	 * @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
	 */
	setAlignPosition(alignPosition: number): void {
		this.layoutConfig.alignPosition = alignPosition;
	}

	/**
	 * 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
	 * @param px 像素值，默认 300
	 */
	setOverscanPx(px: number): void {
		this.layoutConfig.overscanPx = clampPositive(px | 0);
	}
	/** 获取当前 overscan 像素距离 */
	getOverscanPx(): number {
		return this.layoutConfig.overscanPx;
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
		this.calcLayout(LayoutReason.ConfigChange);
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
	 * @throws {TypeError} 歌词时间戳不是有限的非负数字
	 * @throws {RangeError} 任一行、单词或注音的开始时间晚于结束时间
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
	 * 内部会根据调用间隔和播放进度自动决定应如何滚动和显示歌词，所以此方法的调用频率越快越准确越好。
	 * 调用频率较低或进度细度过粗可能会导致歌词显示延迟或导致自动跳转推导错误。
	 * 调用完成后，应每帧调用 {@link update} 方法来执行歌词动画效果。此函数本身不会触发动画效果。
	 *
	 * 当 `isSeek` 为 `true` 时，将强制按跳转处理，并在下次调用 {@link update} 时触发一系列的行为变更，
	 * 具体请参考 <https://amll.dev/guides/component/seeking>，因此请只在真正跳转时设为 `true`
	 *
	 * @param time 当前播放进度，单位为毫秒，非有限值会被静默忽略
	 * @param isSeek 是否强制按跳转处理，默认交由内部推导
	 * @see {@link setEnableAutoSeekDetection} 自动推导跳转状态的文档
	 * @see https://amll.dev/guides/component/sequence#播放进度
	 */
	setCurrentTime(time: number, isSeek = false): void {
		if (!Number.isFinite(time)) return;

		const mediaTime = MediaTime.round(MediaTime.fromMillis(time));

		if (
			!isSeek &&
			!this.isPlaying &&
			mediaTime === this.timelineController.getSnapshot().currentTime
		) {
			return;
		}

		// 探测器必须消费每一次进度推送才能维持内部状态正确，即使本次已经被调用方标记为跳转
		const isDetectedSeek = this.enableAutoSeekDetection
			? this.seekDetector.detect(mediaTime, this.isPlaying)
			: false;

		this.syncTime(mediaTime, isSeek || isDetectedSeek);
	}

	/**
	 * 推进时间线并把增量变化应用到视图上
	 * @param mediaTime 当前播放进度
	 * @param isSeek 这次进度变化是否为跳转
	 */
	private syncTime(mediaTime: MediaTime, isSeek: boolean): void {
		const diff = this.timelineController.sync(mediaTime, isSeek);

		if (!diff.hasChanged) {
			return;
		}

		// 时间轴是否跳跃由时间线统一推导，除了传入的 isSeek 外还包含进度倒退和停滞的情况
		const isTimeJumped = diff.isTimeJumped;
		const snapshot = this.timelineController.getSnapshot();

		for (let i = 0; i < diff.removedHighlighted.length; i++) {
			this.currentLyricGroups[diff.removedHighlighted[i]]?.disable();
		}

		if (isTimeJumped) {
			for (const index of snapshot.highlightedGroups) {
				this.currentLyricGroups[index]?.enable();
			}
		} else {
			for (let i = 0; i < diff.addedHighlighted.length; i++) {
				this.currentLyricGroups[diff.addedHighlighted[i]]?.enable();
			}
		}

		if (isTimeJumped) {
			if (!this.scrollState.isTouchScrolled) {
				this.resetScroll();
			}
		}

		if (
			diff.isInterludeChanged ||
			diff.isScrollToChanged ||
			diff.isEndOfSongChanged ||
			isTimeJumped
		) {
			this.updateSpringParams(
				!!snapshot.activeInterlude,
				isTimeJumped,
				snapshot.isEndOfSong,
			);
		}

		this.calcLayout(
			isTimeJumped ? LayoutReason.Seek : LayoutReason.PlaybackTick,
		);
	}

	/**
	 * 由子类实现的歌词组构建逻辑
	 */
	protected abstract buildLyricGroups(): void;

	/**
	 * 由子类实现的间奏点组件创建逻辑
	 *
	 * 在基类构造函数中调用，子类需要返回对应渲染实现的实例
	 *
	 * @remarks 工厂执行时子类字段尚未初始化，实现内不得读取子类实例状态，
	 * 所需资源应由返回的组件自行创建或延迟获取
	 */
	protected abstract createInterludeDots(): InterludeDots;

	/**
	 * 由子类实现的底栏组件创建逻辑
	 *
	 * 在基类构造函数中调用，子类需要返回对应渲染实现的实例
	 *
	 * @remarks 工厂执行时子类字段尚未初始化，实现内不得读取子类实例状态，
	 * 所需资源应由返回的组件自行创建或延迟获取
	 */
	protected abstract createBottomLine(): BottomLine;

	/**
	 * 重新构建歌词行和时间状态
	 *
	 * 一般用于在调用 {@link setLyricProcessConfig} 更新配置后手动刷新视图，
	 * 或在外部样式/DOM 结构发生改变后重置歌词视图
	 *
	 * @param initialTime 重建后对齐的初始时间（毫秒），默认使用当前播放进度
	 */
	public rebuildLyricView(initialTime: number = this.getCurrentTime()): void {
		this.resetScroll();
		this.focusController.reset();

		const bottomLineContent = this.getBottomLineElement();
		if (bottomLineContent.innerHTML.trim().length > 0) {
			this.bottomLine.resetPosition();
		}

		for (const group of this.currentLyricGroups) {
			group.dispose();
		}
		this.currentLyricGroups = [];

		this.interludeDots.setInterlude(undefined);

		this.buildLyricGroups();

		// 对歌词组进行排序，确保滑动窗口与二分查找算法面对的时间线是严格升序的
		this.currentLyricGroups.sort((a, b) =>
			MediaTime.cmp(a.startTime, b.startTime),
		);
		for (let i = 0; i < this.currentLyricGroups.length; i++) {
			this.lyricGroupIndexMap.set(this.currentLyricGroups[i], i);
		}

		const bounds = this.currentLyricGroups.map((group) => ({
			startTime: group.startTime,
			endTime: group.endTime,
		}));
		this.timelineController.setTimeBounds(bounds);

		this.layoutCalculator.initHeights(
			this.currentLyricGroups.length,
			this.defaultLineHeight,
		);

		this.seekDetector.reset();
		this.setCurrentTime(initialTime, true);
		this.calcLayout(LayoutReason.RebuildView);

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
	 * - 播放完毕时使用中速弹簧参数
	 *
	 * @param isInterludeActive 当前是否命中间奏区间
	 * @param isSeeking 本次同步的时间轴是否发生了跳转
	 * @param isEndOfSong 歌曲是否播放完毕
	 */
	private updateSpringParams(
		isInterludeActive: boolean,
		isSeeking: boolean,
		isEndOfSong: boolean,
	): void {
		if (!this.getEnableSpring() || this.currentLyricGroups.length === 0) {
			return;
		}

		const { scrollToIndex } = this.timelineController.getSnapshot();

		const currentGroup = this.currentLyricGroups[scrollToIndex];
		const prevGroup = this.currentLyricGroups[scrollToIndex - 1];

		let interval: number | undefined;
		if (currentGroup && prevGroup) {
			interval = Duration.asMillis(
				MediaTime.since(currentGroup.startTime, prevGroup.startTime),
			);
		}

		const policy = getPosYSpringPolicy(
			isSeeking,
			isInterludeActive,
			interval,
			isEndOfSong,
		);

		this.setLinePosYSpringParams(policy);
	}

	/**
	 * 重新计算歌词行的几何排版坐标与视觉状态
	 *
	 * 此方法不会触发 DOM 强制重排
	 *
	 * 计算完成后，在每一帧调用 `update()` / `commitChanges()` 即可让歌词平滑移动至目标位置
	 *
	 * @internal 仅供内部和绑定包使用
	 * @param reason 触发排版布局更新的原因场景
	 */
	calcLayout(reason: LayoutReason): void {
		const strategy = LayoutReasonStrategyMap[reason];

		const snapshot = this.timelineController.getSnapshot();
		const interlude = snapshot.activeInterlude;

		// 确定这一帧焦点应该对齐谁
		const focalTarget = this.focusController.resolve(
			snapshot,
			this.currentLyricGroups.length,
			{
				isAutoAlignSuspended: this.scrollState.isAutoAlignSuspended,
				hasBottomContent: this.hasBottomContent,
			},
		);

		// 组装给布局计算器和滚动引擎用的数据
		const fontSize = this.baseFontSize || 24;
		const dotMargin = fontSize * 0.4;
		const totalInterludeHeight =
			this.layoutState.interludeDotsSize[1] + dotMargin * 2;

		const ctx = this.frameContext;
		ctx.containerHeight = this.size[1];
		ctx.target = focalTarget;

		ctx.bottomLineHeight = this.bottomLine.lineSize[1] || 0;

		// 设置间奏相关的上下文参数
		const interludeAnchorIndex = LayoutCalculator.resolveInterludeAnchorIndex(
			interlude,
			focalTarget,
		);

		if (interludeAnchorIndex !== undefined) {
			ctx.interlude = ctx.interlude || { totalHeight: 0, anchorIndex: 0 };
			ctx.interlude.totalHeight = totalInterludeHeight;
			ctx.interlude.anchorIndex = interludeAnchorIndex;
		} else {
			ctx.interlude = undefined;
		}

		// 获取滚动边界与帧 Session，钳制出安全 offset 后提交排版
		const { bounds, session } = this.layoutCalculator.beginFrame(
			ctx,
			this.layoutConfig,
		);
		ctx.scrollOffset = this.scrollEngine.updateBoundary(bounds.min, bounds.max);

		// 让 LayoutCalculator 算出各个排版信息
		const result = this.layoutCalculator.commit(session, ctx.scrollOffset);

		// 检查是否需要显示间奏点
		if (result.hasInterlude && interlude) {
			const nextLineIndex = interlude.anchorLineIndex + 1;
			const nextGroup = this.currentLyricGroups[nextLineIndex];
			const isNextDuet = nextGroup?.mainLine.getLine().isDuet ?? false;

			// 如果下一行是对唱，让间奏点右对齐
			const targetX = isNextDuet
				? this.size[0] - this.layoutState.interludeDotsSize[0]
				: 0;

			this.interludeDots.setTransform(targetX, result.interludeY + dotMargin);

			this.interludeDots.setInterlude(
				[interlude.startTime, interlude.endTime],
				snapshot.currentTime,
				strategy.resetInterlude,
			);
		} else {
			this.interludeDots.setInterlude(undefined);
		}

		// 刷新本帧的视觉推导派生值
		const visual = this.visualFrame;
		visual.latestIndex =
			snapshot.latestHighlightedIndex ?? snapshot.scrollToIndex;
		visual.passedBoundary = interlude
			? interlude.anchorLineIndex + 1
			: snapshot.scrollToIndex;
		visual.isNarrowViewport = window.innerWidth <= 1024;

		// 遍历 LayoutCalculator 算出的排版信息并应用视觉效果
		const activeCount = result.lineCount;

		let delay = Duration.ZERO;
		let baseDelay = strategy.disableStagger
			? Duration.ZERO
			: Duration.fromSecs(0.05);

		for (let i = 0; i < activeCount; i++) {
			const group = this.currentLyricGroups[i];
			const instruction = result.lineInstructions[i];
			const curPos = instruction.y;
			const isInViewport = instruction.isInViewport;
			const isActive = this.resolveIsActive(i, snapshot);

			// 设置样式
			group.setTransform(
				curPos,
				strategy.snapPosY,
				delay,
				isActive,
				this.resolveOpacity(i, isInViewport, snapshot),
				this.resolveBlurLevel(i, isActive, isInViewport, snapshot),
			);

			// 应用阶梯式的动画延迟
			const lineH = instruction.height;
			if (curPos + lineH >= 0) {
				delay = Duration.add(delay, baseDelay);
				if (i >= snapshot.scrollToIndex) {
					baseDelay = Duration.mulF64(baseDelay, 1 / 1.05);
				}
			}
		}

		// 底栏相关的处理
		const isBottomFocused = focalTarget.type === "bottom";
		this.bottomLine.setFocused(isBottomFocused);

		this.bottomLine.setTransform(
			result.bottomLineY,
			// 底栏按「末行之后的一行」索引计算模糊度
			this.resolveBlurLevel(
				activeCount,
				isBottomFocused,
				result.isBottomLineInViewport,
				snapshot,
			),
			strategy.snapPosY,
			delay,
		);
	}

	/**
	 * 推导某一行是否处于激活状态
	 * @param index 歌词行索引
	 * @param snapshot 当前帧的时间线快照
	 */
	private resolveIsActive(index: number, snapshot: TimelineSnapshot): boolean {
		return (
			snapshot.highlightedGroups.has(index) ||
			(index >= snapshot.scrollToIndex && index < this.visualFrame.latestIndex)
		);
	}

	/**
	 * 推导一行的目标透明度
	 * @param index 歌词行索引
	 * @param isInViewport 该行是否在可视区域内
	 * @param snapshot 当前帧的时间线快照
	 */
	private resolveOpacity(
		index: number,
		isInViewport: boolean,
		snapshot: TimelineSnapshot,
	): number {
		// 在视口外则剔除渲染
		if (!isInViewport) return 0;

		if (
			this.hidePassedLines &&
			this.isPlaying &&
			index < this.visualFrame.passedBoundary
		) {
			// 为了避免浏览器优化，这里使用了一个极小但不为零的值（几乎不可见）
			return 1e-4;
		}

		if (snapshot.highlightedGroups.has(index)) return 0.85;

		return this.isNonDynamic ? 0.2 : 1;
	}

	/**
	 * 按距焦点的行距推导模糊档位
	 * @param index 歌词行索引，底栏传入歌词总行数
	 * @param isFocused 该目标是否为当前焦点，歌词行传 `isActive`，底栏传是否聚焦底栏
	 * @param isInViewport 该目标是否在可视区域内
	 * @param snapshot 当前帧的时间线快照
	 */
	private resolveBlurLevel(
		index: number,
		isFocused: boolean,
		isInViewport: boolean,
		snapshot: TimelineSnapshot,
	): number {
		if (!this.enableBlur) return 0;

		// 在视口外直接给到最大模糊
		if (!isInViewport) return 5;

		// 用户触摸滑动期间和对焦目标不施加模糊
		if (this.scrollState.isTouchScrolled || isFocused) return 0;

		const scrollToIndex = snapshot.scrollToIndex;
		const distance =
			index < scrollToIndex
				? Math.abs(scrollToIndex - index) + 1
				: Math.abs(index - this.visualFrame.latestIndex);

		const level = 1 + distance;
		return this.visualFrame.isNarrowViewport ? level * 0.8 : level;
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
			this.calcLayout(LayoutReason.ConfigChange);
		}
	}
	/**
	 * 恢复部分效果演出，目前会恢复播放间奏点的动画
	 */
	resume(): void {
		this.interludeDots.resume();
		if (!this.isPlaying) {
			this.isPlaying = true;
			this.calcLayout(LayoutReason.ConfigChange);
		}
	}
	/**
	 * 更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：
	 *
	 * 1. 刚刚调用完设置歌词函数的时候
	 * @param delta 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数）
	 */

	update(delta = 0): void {
		const d = Duration.fromMillis(delta);
		this.bottomLine.update(d);
		this.interludeDots.update(d);
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
		return (
			this.bottomLine.getContentElement?.() ?? this.bottomLine.getElement()
		);
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
		return MediaTime.asMillis(
			this.timelineController.getSnapshot().currentTime,
		);
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
		this.calcLayout(LayoutReason.ConfigChange);
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
		this.interludeDots.dispose();
		this.bottomLine.dispose();
		window.removeEventListener("pageshow", this.onPageShow);
		window.removeEventListener("pagehide", this.onPageHide);
	}
}
