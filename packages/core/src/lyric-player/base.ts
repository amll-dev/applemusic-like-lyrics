import structuredClone from "@ungap/structured-clone";
import {
	type Disposable,
	type HasElement,
	type LyricLine,
	LyricLineRenderMode,
	type LyricWord,
} from "../interfaces.ts";
import styles from "../styles/lyric-player.module.css";
import { eqSet } from "../utils/eq-set.ts";
import { isCJK } from "../utils/is-cjk.ts";
import { optimizeLyricLines } from "../utils/optimize-lyric.ts";
import { Spring, type SpringParams } from "../utils/spring.ts";
import { BottomLineEl } from "./bottom-line.ts";
import { InterludeDots } from "./dom/interlude-dots.ts";
import { MaskObsceneWordsMode } from "./index.ts";

/**
 * 歌词播放器的基类，已经包含了有关歌词操作和排版的功能，子类需要为其实现对应的显示展示操作
 */
export abstract class LyricPlayerBase
	extends EventTarget
	implements HasElement, Disposable
{
	protected element: HTMLElement = document.createElement("div");
	abstract get baseFontSize(): number;

	protected currentTime = 0;
	/** @internal */
	lyricLinesSize: WeakMap<LyricLineBase, [number, number]> = new WeakMap();
	/** @internal */
	lyricLineElementMap: WeakMap<Element, LyricLineBase> = new WeakMap();
	protected currentLyricLines: LyricLine[] = [];
	// protected currentLyricLineObjects: LyricLineBase[] = [];
	protected processedLines: LyricLine[] = [];
	protected lyricLinesIndexes: WeakMap<LyricLineBase, number> = new WeakMap();
	protected hotLines: Set<number> = new Set();
	protected bufferedLines: Set<number> = new Set();
	protected isNonDynamic = false;
	protected hasDuetLine = false;
	protected scrollToIndex = 0;
	protected disableSpring = false;
	protected interludeDotsSize: [number, number] = [0, 0];
	protected interludeDots: InterludeDots = new InterludeDots();
	protected bottomLine: BottomLineEl = new BottomLineEl(this);
	protected enableBlur = true;
	protected enableScale = true;
	protected maskObsceneWords = MaskObsceneWordsMode.Disabled;
	protected hidePassedLines = false;
	protected scrollBoundary = [0, 0];
	protected currentLyricLineObjects: LyricLineBase[] = [];
	protected isSeeking = false;
	protected lastCurrentTime = 0;
	protected alignAnchor: "top" | "bottom" | "center" = "center";
	protected alignPosition = 0.35;
	protected scrollOffset = 0;
	readonly size: [number, number] = [0, 0];
	protected allowScroll = true;
	protected isPageVisible = true;

	protected initialLayoutFinished = false;

	/**
	 * 标记用户是否正在进行滚动交互
	 */
	protected isUserScrolling = false;
	protected wheelTimeout: ReturnType<typeof setTimeout> | undefined;

	/**
	 * 视图额外预渲染（overscan）距离，单位：像素。
	 * 用于决定在视口之外多少距离内也认为是“可见”，以便提前创建/保留行元素。
	 */
	protected overscanPx = 300;

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
		this.setCurrentTime(this.currentTime, true);
	};
	private onPageHide = () => {
		this.isPageVisible = false;
	};
	private scrolledHandler = 0;
	protected isScrolled = false;
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
				this.interludeDotsSize[0] = entry.target.clientWidth;
				this.interludeDotsSize[1] = entry.target.clientHeight;
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
				const lineObj = this.lyricLineElementMap.get(entry.target);
				if (lineObj) {
					const newSize: [number, number] = [
						entry.target.clientWidth,
						entry.target.clientHeight,
					];
					const oldSize: [number, number] = this.lyricLinesSize.get(
						lineObj,
					) ?? [0, 0];

					if (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1]) {
						this.lyricLinesSize.set(lineObj, newSize);
						lineObj.onLineSizeChange(newSize);
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
	protected targetAlignIndex = 0;

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

		let startScrollY = 0;

		let startTouchPosY = 0;
		let startTouchStartX = 0;
		let startTouchStartY = 0;

		let lastMoveY = 0;
		let startScrollTime = 0;
		let scrollSpeed = 0;
		let curScrollId = 0;

		this.element.addEventListener("touchstart", (evt) => {
			if (this.beginScrollHandler()) {
				this.isUserScrolling = true;

				evt.preventDefault();
				startScrollY = this.scrollOffset;

				startTouchPosY = evt.touches[0].screenY;
				lastMoveY = startTouchPosY;

				startTouchStartX = evt.touches[0].screenX;
				startTouchStartY = evt.touches[0].screenY;

				startScrollTime = Date.now();
				scrollSpeed = 0;

				this.calcLayout(true, true);
			}
		});

		this.element.addEventListener("touchmove", (evt) => {
			if (this.beginScrollHandler()) {
				evt.preventDefault();
				const currentY = evt.touches[0].screenY;

				const deltaY = currentY - startTouchPosY;
				this.scrollOffset = startScrollY - deltaY;
				this.limitScrollOffset();

				const now = Date.now();
				const dt = now - startScrollTime;
				if (dt > 0) {
					scrollSpeed = (currentY - lastMoveY) / dt;
				}
				lastMoveY = currentY;
				startScrollTime = now;

				this.calcLayout(true, true);
			}
		});

		this.element.addEventListener("touchend", (evt) => {
			if (this.beginScrollHandler()) {
				evt.preventDefault();

				const touch = evt.changedTouches[0];
				const moveX = Math.abs(touch.screenX - startTouchStartX);
				const moveY = Math.abs(touch.screenY - startTouchStartY);

				if (moveX < 10 && moveY < 10) {
					const target = document.elementFromPoint(
						touch.clientX,
						touch.clientY,
					);
					if (target && this.element.contains(target)) {
						(target as HTMLElement).click();
					}
					this.isUserScrolling = false;
					this.endScrollHandler();
					return;
				}

				startTouchPosY = 0;
				const scrollId = ++curScrollId;

				if (Math.abs(scrollSpeed) < 0.1) scrollSpeed = 0;

				let lastFrameTime = performance.now();

				const onScrollFrame = (time: number) => {
					if (scrollId !== curScrollId) return;

					const dt = time - lastFrameTime;
					lastFrameTime = time;

					if (dt <= 0 || dt > 100) {
						requestAnimationFrame(onScrollFrame);
						return;
					}

					if (Math.abs(scrollSpeed) > 0.05) {
						this.scrollOffset -= scrollSpeed * dt;

						this.limitScrollOffset();

						const frictionFactor = 0.95 ** (dt / 16);
						scrollSpeed *= frictionFactor;

						this.calcLayout(true, true);

						requestAnimationFrame(onScrollFrame);
					} else {
						this.isUserScrolling = false;
						this.endScrollHandler();
					}
				};

				requestAnimationFrame(onScrollFrame);
			} else {
				this.isUserScrolling = false;
			}
		});

		this.element.addEventListener(
			"wheel",
			(evt) => {
				if (this.beginScrollHandler()) {
					evt.preventDefault();
					// this.isUserScrolling = true;

					if (evt.deltaMode === evt.DOM_DELTA_PIXEL) {
						this.scrollOffset += evt.deltaY;
						this.limitScrollOffset();
						this.calcLayout(true, false);
					} else {
						this.scrollOffset += evt.deltaY * 50;
						this.limitScrollOffset();
						this.calcLayout(false, false);
					}

					// if (this.wheelTimeout) {
					// 	clearTimeout(this.wheelTimeout);
					// }

					// this.wheelTimeout = setTimeout(() => {
					// 	this.isUserScrolling = false;
					// 	this.endScrollHandler();
					// }, 150);
				}
			},
			{ passive: false },
		);
	}

	private beginScrollHandler() {
		const allowed = this.allowScroll;
		if (allowed) {
			this.isScrolled = true;
			clearTimeout(this.scrolledHandler);
			this.scrolledHandler = setTimeout(() => {
				this.isScrolled = false;
				this.scrollOffset = 0;
			}, 5000);
		}
		return allowed;
	}
	private endScrollHandler() {}
	private limitScrollOffset() {
		this.scrollOffset = Math.max(
			Math.min(this.scrollBoundary[1], this.scrollOffset),
			this.scrollBoundary[0],
		);
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
	setWordFadeWidth(value = 0.5) {
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
	setEnableScale(enable = true) {
		this.enableScale = enable;
		this.calcLayout();
	}
	/**
	 * 获取当前是否启用了歌词行缩放效果
	 * @returns 是否启用歌词行缩放效果
	 */
	getEnableScale() {
		return this.enableScale;
	}

	/**
	 * 获取当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
	 * @returns 当前文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位
	 */
	getWordFadeWidth() {
		return this.wordFadeWidth;
	}

	setIsSeeking(isSeeking: boolean) {
		this.isSeeking = isSeeking;
	}
	/**
	 * 设置是否隐藏已经播放过的歌词行，默认不隐藏
	 * @param hide 是否隐藏已经播放过的歌词行，默认不隐藏
	 */
	setHidePassedLines(hide: boolean) {
		this.hidePassedLines = hide;
		this.calcLayout();
	}
	/**
	 * 设置是否启用歌词行的模糊效果
	 * @param enable 是否启用
	 */
	setEnableBlur(enable: boolean) {
		if (this.enableBlur === enable) return;
		this.enableBlur = enable;
		this.calcLayout();
	}
	/**
	 * 设置歌词中不雅用语的掩码模式
	 */
	setMaskObsceneWords(mode: MaskObsceneWordsMode) {
		if (this.maskObsceneWords === mode) return;
		this.maskObsceneWords = mode;
		this.rebuildLyricLines();
		this.calcLayout();
	}
	rebuildLyricLines() {
		for (const lineObj of this.currentLyricLineObjects) {
			lineObj.rebuildElement();
		}
	}
	/**
	 * 根据当前配置处理不雅用语单词
	 * @param word 单词对象
	 * @internal
	 */
	processObsceneWord(word: LyricWord): string {
		if (!word.obscene) return word.word;
		if (this.maskObsceneWords === MaskObsceneWordsMode.Disabled)
			return word.word;
		if (this.maskObsceneWords === MaskObsceneWordsMode.FullMask)
			return word.word.replace(/\S/g, "#");
		return word.word;
	}
	/**
	 * 设置目标歌词行的对齐方式，默认为 `center`
	 *
	 * - 设置成 `top` 的话将会向目标歌词行的顶部对齐
	 * - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
	 * - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
	 * @param alignAnchor 歌词行对齐方式，详情见函数说明
	 */
	setAlignAnchor(alignAnchor: "top" | "bottom" | "center") {
		this.alignAnchor = alignAnchor;
	}
	/**
	 * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`
	 * @param alignPosition 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
	 */
	setAlignPosition(alignPosition: number) {
		this.alignPosition = alignPosition;
	}

	/**
	 * 设置 overscan（视图上下额外缓冲渲染区）距离，单位：像素。
	 * @param px 像素值，默认 300
	 */
	setOverscanPx(px: number) {
		this.overscanPx = Math.max(0, px | 0);
	}
	/** 获取当前 overscan 像素距离 */
	getOverscanPx() {
		return this.overscanPx;
	}
	/**
	 * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
	 *
	 * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
	 *
	 * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
	 */
	setEnableSpring(enable = true) {
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
	getEnableSpring() {
		return !this.disableSpring;
	}

	/**
	 * 获取当前播放时间里是否处于间奏区间
	 * 如果是则会返回单位为毫秒的始末时间
	 * 否则返回 undefined
	 *
	 * 这个只允许内部调用
	 * @returns [开始时间,结束时间,大概处于的歌词行ID,下一句是否为对唱歌词] 或 undefined 如果不处于间奏区间
	 */
	protected getCurrentInterlude():
		| [number, number, number, boolean]
		| undefined {
		const currentTime = this.currentTime + 20;
		const currentIndex = this.scrollToIndex;
		const lines = this.processedLines;

		const checkGap = (
			k: number,
		): [number, number, number, boolean] | undefined => {
			if (k < -1 || k >= lines.length - 1) return undefined;

			const prevLine = k === -1 ? null : lines[k];
			const nextLine = lines[k + 1];

			const gapStart = prevLine ? prevLine.endTime : 0;
			const gapEnd = Math.max(gapStart, nextLine.startTime - 250);

			if (gapEnd - gapStart < 4000) {
				return undefined;
			}

			if (gapEnd > currentTime && gapStart < currentTime) {
				return [Math.max(gapStart, currentTime), gapEnd, k, nextLine.isDuet];
			}
			return undefined;
		};

		return (
			checkGap(currentIndex - 1) ||
			checkGap(currentIndex) ||
			checkGap(currentIndex + 1)
		);
	}
	/**
	 * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	 * @param lines 歌词数组
	 * @param initialTime 初始时间，默认为 0
	 */
	setLyricLines(lines: LyricLine[], initialTime = 0) {
		if (import.meta.env.DEV) {
			console.log("设置歌词行", lines, initialTime);
		}

		this.initialLayoutFinished = true;
		this.lastCurrentTime = initialTime;
		this.currentTime = initialTime;
		this.currentLyricLines = structuredClone(lines);
		this.processedLines = structuredClone(this.currentLyricLines);
		optimizeLyricLines(this.processedLines);

		this.isNonDynamic = true;
		for (const line of this.processedLines) {
			if (line.words.length > 1) {
				this.isNonDynamic = false;
				break;
			}
		}

		this.hasDuetLine = this.processedLines.some((line) => line.isDuet);

		for (const line of this.currentLyricLineObjects) {
			line.dispose();
		}

		this.interludeDots.setInterlude(undefined);
		this.hotLines.clear();
		this.bufferedLines.clear();
		this.setCurrentTime(0, true);

		if (import.meta.env.DEV) {
			console.log("歌词处理完成", this);
		}
	}

	/**
	 * 获取当前是否在播放
	 * @returns 当前是否在播放
	 */
	public getIsPlaying() {
		return this.isPlaying;
	}

	/**
	 * 设置当前播放进度，单位为毫秒且**必须是整数**，此时将会更新内部的歌词进度信息
	 * 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好
	 *
	 * 调用完成后，可以每帧调用 `update` 函数来执行歌词动画效果
	 * @param time 当前播放进度，单位为毫秒
	 */
	setCurrentTime(time: number, isSeek = false) {
		// 我在这里定义了歌词的选择状态：
		// 普通行：当前不处于时间范围内的歌词行
		// 热行：当前绝对处于播放时间内的歌词行，且一般会被立刻加入到缓冲行中
		// 缓冲行：一般处于播放时间后的歌词行，会因为当前播放状态的缘故推迟解除状态

		// 然后我们需要让歌词行为如下：
		// 如果当前仍有缓冲行的情况下加入新热行，则不会解除当前缓冲行，且也不会修改当前滚动位置
		// 如果当前所有缓冲行都将被删除且没有新热行加入，则删除所有缓冲行，且也不会修改当前滚动位置
		// 如果当前所有缓冲行都将被删除且有新热行加入，则删除所有缓冲行并加入新热行作为缓冲行，然后修改当前滚动位置

		this.currentTime = time;

		if (!this.initialLayoutFinished && !isSeek) return;

		const removedHotIds = new Set<number>();
		const removedIds = new Set<number>();
		const addedIds = new Set<number>();

		// 先检索当前已经超出时间范围的缓冲行，列入待删除集内
		for (const lastHotId of this.hotLines) {
			const line = this.processedLines[lastHotId];
			if (line) {
				if (line.isBG) continue;
				const nextLine = this.processedLines[lastHotId + 1];
				if (nextLine?.isBG) {
					const nextMainLine = this.processedLines[lastHotId + 2];
					const startTime = Math.min(line.startTime, nextLine?.startTime);
					const endTime = Math.min(
						Math.max(line.endTime, nextMainLine?.startTime ?? Number.MAX_VALUE),
						Math.max(line.endTime, nextLine?.endTime),
					);
					if (startTime > time || endTime <= time) {
						this.hotLines.delete(lastHotId);
						removedHotIds.add(lastHotId);
						this.hotLines.delete(lastHotId + 1);
						removedHotIds.add(lastHotId + 1);
						if (isSeek) {
							this.currentLyricLineObjects[lastHotId]?.disable();
							this.currentLyricLineObjects[lastHotId + 1]?.disable();
						}
					}
				} else if (line.startTime > time || line.endTime <= time) {
					this.hotLines.delete(lastHotId);
					removedHotIds.add(lastHotId);
					if (isSeek) this.currentLyricLineObjects[lastHotId]?.disable();
				}
			} else {
				this.hotLines.delete(lastHotId);
				removedHotIds.add(lastHotId);
				if (isSeek) this.currentLyricLineObjects[lastHotId]?.disable();
			}
		}
		this.currentLyricLineObjects.forEach((lineObj, id, arr) => {
			const line = lineObj.getLine();

			if (!line.isBG && line.startTime <= time && line.endTime > time) {
				if (isSeek) {
					lineObj.enable(time, this.isPlaying);
				}

				if (!this.hotLines.has(id)) {
					this.hotLines.add(id);
					addedIds.add(id);

					if (!isSeek) {
						lineObj.enable();
					}

					if (arr[id + 1]?.getLine()?.isBG) {
						this.hotLines.add(id + 1);
						addedIds.add(id + 1);
						if (isSeek) {
							arr[id + 1].enable(time, this.isPlaying);
						} else {
							arr[id + 1].enable();
						}
					}
				}
			}
		});
		for (const v of this.bufferedLines) {
			if (!this.hotLines.has(v)) {
				removedIds.add(v);
				if (isSeek) this.currentLyricLineObjects[v]?.disable();
			}
		}
		if (isSeek) {
			this.bufferedLines.clear();
			for (const v of this.hotLines) {
				this.bufferedLines.add(v);
			}

			if (this.bufferedLines.size > 0) {
				this.scrollToIndex = Math.min(...this.bufferedLines);
			} else {
				const foundIndex = this.processedLines.findIndex(
					(line) => line.startTime >= time,
				);

				this.scrollToIndex =
					foundIndex === -1 ? this.processedLines.length : foundIndex;
			}

			this.resetScroll();
			this.calcLayout();
		} else if (removedIds.size > 0 || addedIds.size > 0) {
			if (removedIds.size === 0 && addedIds.size > 0) {
				for (const v of addedIds) {
					this.bufferedLines.add(v);
					this.currentLyricLineObjects[v]?.enable();
				}
				this.scrollToIndex = Math.min(...this.bufferedLines);
				this.calcLayout();
			} else if (addedIds.size === 0 && removedIds.size > 0) {
				if (eqSet(removedIds, this.bufferedLines)) {
					for (const v of this.bufferedLines) {
						if (!this.hotLines.has(v)) {
							this.bufferedLines.delete(v);
							this.currentLyricLineObjects[v]?.disable();
						}
					}
					this.calcLayout();
				}
			} else {
				for (const v of addedIds) {
					this.bufferedLines.add(v);
					this.currentLyricLineObjects[v]?.enable();
				}
				for (const v of removedIds) {
					this.bufferedLines.delete(v);
					this.currentLyricLineObjects[v]?.disable();
				}
				if (this.bufferedLines.size > 0)
					this.scrollToIndex = Math.min(...this.bufferedLines);
				this.calcLayout();
			}
		}
		this.lastCurrentTime = time;
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
	async calcLayout(sync = false, force = false) {
		const interlude = this.getCurrentInterlude();
		let curPos = -this.scrollOffset;
		const targetAlignIndex = this.scrollToIndex;
		let isNextDuet = false;
		if (interlude) {
			isNextDuet = interlude[3];
		} else {
			this.interludeDots.setInterlude(undefined);
		}

		const fontSize = this.baseFontSize || 24;
		const dotMargin = fontSize * 0.4;
		const totalInterludeHeight = this.interludeDotsSize[1] + dotMargin * 2;

		if (interlude) {
			if (interlude[2] !== -1) {
				curPos -= totalInterludeHeight;
			}
		}
		// 避免一开始就让所有歌词行挤在一起
		const LINE_HEIGHT_FALLBACK = this.size[1] / 5;
		const scrollOffset = this.currentLyricLineObjects
			.slice(0, targetAlignIndex)
			.reduce(
				(acc, el) =>
					acc +
					(el.getLine().isBG && this.isPlaying
						? 0
						: (this.lyricLinesSize.get(el)?.[1] ?? LINE_HEIGHT_FALLBACK)),
				0,
			);
		this.scrollBoundary[0] = -scrollOffset;
		curPos -= scrollOffset;
		curPos += this.size[1] * this.alignPosition;
		const curLine = this.currentLyricLineObjects[targetAlignIndex];
		this.targetAlignIndex = targetAlignIndex;
		if (curLine) {
			const lineHeight =
				this.lyricLinesSize.get(curLine)?.[1] ?? LINE_HEIGHT_FALLBACK;
			switch (this.alignAnchor) {
				case "bottom":
					curPos -= lineHeight;
					break;
				case "center":
					curPos -= lineHeight / 2;
					break;
				case "top":
					break;
			}
		}
		const latestIndex = Math.max(...this.bufferedLines);
		let delay = 0;
		let baseDelay = sync ? 0 : 0.05;
		let setDots = false;
		this.currentLyricLineObjects.forEach((lineObj, i) => {
			const hasBuffered = this.bufferedLines.has(i);
			const isActive =
				hasBuffered || (i >= this.scrollToIndex && i < latestIndex);
			const line = lineObj.getLine();

			const shouldShowDots = interlude && i === interlude[2] + 1;

			if (!setDots && shouldShowDots) {
				setDots = true;

				curPos += dotMargin;

				let targetX = 0;
				if (interlude && isNextDuet) {
					targetX = this.size[0] - this.interludeDotsSize[0];
				}

				this.interludeDots.setTransform(targetX, curPos);

				if (interlude) {
					this.interludeDots.setInterlude([interlude[0], interlude[1]]);
				}
				curPos += this.interludeDotsSize[1];
				curPos += dotMargin;
			}

			let targetOpacity: number;

			if (this.hidePassedLines) {
				if (
					i < (interlude ? interlude[2] + 1 : this.scrollToIndex) &&
					this.isPlaying
				) {
					// 为了避免浏览器优化，这里使用了一个极小但不为零的值（几乎不可见）
					targetOpacity = 0.00001;
				} else if (hasBuffered) {
					targetOpacity = 0.85;
				} else {
					targetOpacity = this.isNonDynamic ? 0.2 : 1;
				}
			} else {
				if (hasBuffered) {
					targetOpacity = 0.85;
				} else {
					targetOpacity = this.isNonDynamic ? 0.2 : 1;
				}
			}

			let blurLevel = 0;

			if (this.enableBlur) {
				if (isActive) {
					blurLevel = 0;
				} else {
					blurLevel = 1;
					if (i < this.scrollToIndex) {
						blurLevel += Math.abs(this.scrollToIndex - i) + 1;
					} else {
						blurLevel += Math.abs(
							i - Math.max(this.scrollToIndex, latestIndex),
						);
					}
				}
			}

			const SCALE_ASPECT = this.enableScale ? 97 : 100;

			let targetScale = 100;

			if (!isActive && this.isPlaying) {
				if (line.isBG) {
					targetScale = 75;
				} else {
					targetScale = SCALE_ASPECT;
				}
			}

			if (this.isUserScrolling) {
				blurLevel = 0;
			}

			const renderMode = isActive
				? LyricLineRenderMode.GRADIENT
				: LyricLineRenderMode.SOLID;

			lineObj.setTransform(
				curPos,
				targetScale,
				targetOpacity,
				window.innerWidth <= 1024 ? blurLevel * 0.8 : blurLevel,
				force,
				delay,
				renderMode,
			);

			if (line.isBG && (isActive || !this.isPlaying)) {
				curPos += this.lyricLinesSize.get(lineObj)?.[1] ?? LINE_HEIGHT_FALLBACK;
			} else if (!line.isBG) {
				curPos += this.lyricLinesSize.get(lineObj)?.[1] ?? LINE_HEIGHT_FALLBACK;
			}
			if (curPos >= 0 && !this.isSeeking) {
				if (!line.isBG) delay += baseDelay;

				if (i >= this.scrollToIndex) baseDelay /= 1.05;
			}
		});
		this.scrollBoundary[1] = curPos + this.scrollOffset - this.size[1] / 2;
		// console.groupEnd();
		this.bottomLine.setTransform(0, curPos, force, delay);
	}

	/**
	 * 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 * @deprecated 考虑到横向弹簧效果并不常见，所以这个函数将会在未来的版本中移除
	 */
	setLinePosXSpringParams(_params: Partial<SpringParams> = {}) {}
	/**
	 * 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	setLinePosYSpringParams(params: Partial<SpringParams> = {}) {
		this.posYSpringParams = {
			...this.posYSpringParams,
			...params,
		};
		this.bottomLine.lineTransforms.posY.updateParams(this.posYSpringParams);
		for (const line of this.currentLyricLineObjects) {
			line.lineTransforms.posY.updateParams(this.posYSpringParams);
		}
	}
	/**
	 * 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	setLineScaleSpringParams(params: Partial<SpringParams> = {}) {
		this.scaleSpringParams = {
			...this.scaleSpringParams,
			...params,
		};
		this.scaleForBGSpringParams = {
			...this.scaleForBGSpringParams,
			...params,
		};
		for (const lineObj of this.currentLyricLineObjects) {
			if (lineObj.getLine().isBG) {
				lineObj.lineTransforms.scale.updateParams(this.scaleForBGSpringParams);
			} else {
				lineObj.lineTransforms.scale.updateParams(this.scaleSpringParams);
			}
		}
	}
	protected isPlaying = true;
	/**
	 * 暂停部分效果演出，目前会暂停播放间奏点的动画，且将背景歌词显示出来
	 */
	pause() {
		this.interludeDots.pause();
		if (this.isPlaying) {
			this.isPlaying = false;
			this.calcLayout();
		}
	}
	/**
	 * 恢复部分效果演出，目前会恢复播放间奏点的动画
	 */
	resume() {
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

	update(delta = 0) {
		this.bottomLine.update(delta / 1000);
		this.interludeDots.update(delta / 1000);
	}

	protected onResize() {}

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
	resetScroll() {
		this.isScrolled = false;
		this.scrollOffset = 0;
		clearTimeout(this.scrolledHandler);
		this.scrolledHandler = 0;
	}
	/**
	 * 获取当前歌词数组
	 *
	 * 一般和最后调用 `setLyricLines` 给予的参数一样
	 * @returns 当前歌词数组
	 */
	getLyricLines() {
		return this.currentLyricLines;
	}
	/**
	 * 获取当前歌词的播放位置
	 *
	 * 一般和最后调用 `setCurrentTime` 给予的参数一样
	 * @returns 当前播放位置
	 */
	getCurrentTime() {
		return this.currentTime;
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

/**
 * 所有标准歌词行的基类
 * @internal
 */
export abstract class LyricLineBase extends EventTarget implements Disposable {
	protected top = 0;
	protected scale = 1;
	protected blur = 0;
	protected opacity = 1;
	protected delay = 0;
	readonly lineTransforms = {
		posY: new Spring(0),
		scale: new Spring(100),
	};
	abstract getLine(): LyricLine;
	abstract enable(time?: number, shouldPlay?: boolean): void;
	abstract disable(): void;
	abstract resume(): void;
	abstract pause(): void;
	onLineSizeChange(_size: [number, number]): void {}
	setTransform(
		top: number = this.top,
		scale: number = this.scale,
		opacity: number = this.opacity,
		blur: number = this.blur,
		_force = false,
		delay = 0,
		_mode = LyricLineRenderMode.SOLID,
	) {
		this.top = top;
		this.scale = scale;
		this.opacity = opacity;
		this.blur = blur;
		this.delay = delay;
	}

	rebuildElement() {}

	/**
	 * 判定歌词是否可以应用强调辉光效果
	 *
	 * 果子在对辉光效果的解释是一种强调（emphasized）效果
	 *
	 * 条件是一个单词时长大于等于 1s 且长度小于等于 7
	 *
	 * @param word 单词
	 * @returns 是否可以应用强调辉光效果
	 */
	static shouldEmphasize(word: LyricWord): boolean {
		if (isCJK(word.word)) return word.endTime - word.startTime >= 1000;

		return (
			word.endTime - word.startTime >= 1000 &&
			word.word.trim().length <= 7 &&
			word.word.trim().length > 1
		);
	}
	abstract update(delta?: number): void;
	dispose() {}
}
