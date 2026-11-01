import type { LineMaskAnimator, MaskContext, MaskTargetWord } from "./types.ts";
import { generateFadeGradient } from "./utils.ts";

interface KeyframeTimelineCursor {
	curPos: number;
	lastPos: number;
	timeOffset: number;
	lastTime: number;
	lastTimeStamp: number;
	frames: Keyframe[];
}

interface KeyframeConfig {
	readonly minOffset: number;
	readonly fadeWidth: number;
}

/**
 * 使用 Web Animations API 为行内所有单词创建逐词点亮的遮罩动画
 *
 * 创建后的动画均处于暂停状态，外部需要根据播放进度进行调度
 */
export class WebMaskAnimator implements LineMaskAnimator {
	private readonly animations: Animation[] = [];
	private readonly totalFadeDuration: number;

	constructor(
		private readonly words: ReadonlyArray<MaskTargetWord>,
		private readonly context: MaskContext,
	) {
		this.totalFadeDuration =
			this.context.lineEndTime - this.context.lineStartTime;
	}

	public apply(): void {
		this.buildAnimations();
	}

	public setCurrentTime(timeRelative: number, isPlaying: boolean): void {
		const t = Math.min(this.totalFadeDuration, Math.max(0, timeRelative));
		for (const a of this.animations) {
			a.currentTime = t;
			a.playbackRate = 1;
			const endTime = this.getAnimationEndTime(a);

			if (isPlaying && t < endTime) {
				a.play();
			} else {
				a.pause();
			}
		}
	}

	public pause(): void {
		for (const a of this.animations) {
			a.pause();
		}
	}

	public resume(): void {
		for (const a of this.animations) {
			const endTime = this.getAnimationEndTime(a);
			const currentTime = Number(a.currentTime ?? 0);

			if (a.playState !== "finished" && currentTime < endTime) {
				a.play();
			}
		}
	}

	private buildAnimations(): void {
		for (const [i, word] of this.words.entries()) {
			const wordEl = word.mainElement;
			if (!wordEl) continue;

			const fadeWidth = word.height * this.context.wordFadeWidth;

			this.updateWordMaskStyles(wordEl, word, fadeWidth);

			const frames = this.generateWordKeyframes(word, i, fadeWidth);

			try {
				const ani = wordEl.animate(frames, {
					duration: Math.max(this.totalFadeDuration, 1),
					id: `fade-word-${word.word}-${i}`,
					fill: "both",
				});
				ani.pause();
				this.animations.push(ani);
			} catch (err) {
				console.warn(
					"应用渐变动画发生错误",
					frames,
					this.totalFadeDuration,
					err,
				);
			}
		}
	}

	/**
	 * 为单个单词 DOM 元素配置 CSS 渐变遮罩样式
	 */
	private updateWordMaskStyles(
		wordEl: HTMLElement,
		word: MaskTargetWord,
		fadeWidth: number,
	): void {
		const [maskImage, totalAspect] = generateFadeGradient(
			fadeWidth / (word.width + word.padding * 2),
		);

		Object.assign(wordEl.style, {
			maskImage,
			maskRepeat: "no-repeat",
			maskSize: `${totalAspect * 100}% 100%`,
		});
	}

	/**
	 * 推导时间轴并生成单个单词在播放周期内的所有遮罩关键帧
	 */
	private generateWordKeyframes(
		targetWord: MaskTargetWord,
		targetIndex: number,
		fadeWidth: number,
	): Keyframe[] {
		// 计算目标单词的前置累加宽度与有效位移边界
		const widthBeforeSelf =
			this.words.slice(0, targetIndex).reduce((a, b) => a + b.width, 0) +
			(this.words[0] ? fadeWidth : 0);

		const minOffset = -(targetWord.width + targetWord.padding * 2 + fadeWidth);
		const initialPos =
			-widthBeforeSelf - targetWord.width - targetWord.padding - fadeWidth;

		const config: KeyframeConfig = { minOffset, fadeWidth };
		const cursor: KeyframeTimelineCursor = {
			curPos: initialPos,
			lastPos: initialPos,
			timeOffset: 0,
			lastTime: 0,
			lastTimeStamp: 0,
			frames: [],
		};

		// 压入起始帧
		this.pushClampedKeyframe(cursor, config.minOffset);

		// 遍历整行所有音节推进时间线
		for (const [j, otherWord] of this.words.entries()) {
			// 处理单词开始前的停顿区间
			this.advancePauseTimeline(cursor, otherWord.startTime, config);

			// 处理单词播放时的移动区间
			const rubySegments =
				otherWord.ruby?.filter((r) => Boolean(r?.word?.trim())) ?? [];
			if (rubySegments.length > 0) {
				this.advanceRubyWordTimeline(
					cursor,
					otherWord,
					rubySegments,
					config,
					j,
				);
			} else {
				this.advancePlainWordTimeline(cursor, otherWord, config, j);
			}
		}

		return cursor.frames;
	}

	private advancePauseTimeline(
		cursor: KeyframeTimelineCursor,
		targetStartTime: number,
		config: KeyframeConfig,
	): void {
		const curTimeStamp = targetStartTime - this.context.lineStartTime;
		const staticDuration = curTimeStamp - cursor.lastTimeStamp;

		if (staticDuration > 0) {
			this.advanceTimelineStep(cursor, config, staticDuration, 0);
		}
		cursor.lastTimeStamp = curTimeStamp;
	}

	/**
	 * 推导带有 Ruby 注音的多音节单词时间线
	 *
	 * 原理是把每个主音节的总宽度均分给 ruby 片段总数，并应用每个 ruby 片段的时间给主音节
	 *
	 * 此功能具有诸多缺陷，如下所示：
	 * 1. 汉字是一个紧凑的表意单位，内部由形旁、声旁或笔画构成，与读音之间不存在从左到右的序列关系，
	 *    像是一个多音节英语单词按连字符分开时间轴和停顿这才有语义
	 * 2. 在主音节中间分时间和停顿会导致用户必须将视线焦点从主音节上移到上方的 ruby
	 *    注音，以寻找音节锚点，显然破坏用户预期
	 * 3. ruby 的注音功能已由逐字音译承担
	 *
	 * 但考虑到功能已进入生产环境，因此保留此功能
	 */
	private advanceRubyWordTimeline(
		cursor: KeyframeTimelineCursor,
		otherWord: MaskTargetWord,
		rubySegments: NonNullable<MaskTargetWord["ruby"]>,
		config: KeyframeConfig,
		wordIndex: number,
	): void {
		const rubyCharCount = rubySegments.reduce(
			(sum, r) => sum + r.word.length,
			0,
		);
		const widthPerChar = otherWord.width / rubyCharCount;
		let charIndex = 0;

		for (const ruby of rubySegments) {
			const rubyStart = Math.max(ruby.startTime, otherWord.startTime);
			const rubyEnd = Math.min(
				Math.max(ruby.endTime, rubyStart),
				otherWord.endTime,
			);

			const rubyStartStamp = rubyStart - this.context.lineStartTime;
			const rubyStaticDuration = rubyStartStamp - cursor.lastTimeStamp;
			if (rubyStaticDuration > 0) {
				this.advanceTimelineStep(cursor, config, rubyStaticDuration, 0);
			}
			cursor.lastTimeStamp = rubyStartStamp;

			const rubyDuration = Math.max(0, rubyEnd - rubyStart);
			const perCharDuration = rubyDuration / ruby.word.length;

			for (let i = 0; i < ruby.word.length; i++) {
				let movePx = widthPerChar;
				if (wordIndex === 0 && charIndex === 0)
					movePx += config.fadeWidth * 1.5;
				if (
					wordIndex === this.words.length - 1 &&
					charIndex === rubyCharCount - 1
				)
					movePx += config.fadeWidth * 0.5;

				this.advanceTimelineStep(cursor, config, perCharDuration, movePx);
				cursor.lastTimeStamp += perCharDuration;
				charIndex++;
			}
		}

		const wordEndStamp = Math.max(
			otherWord.endTime - this.context.lineStartTime,
			cursor.lastTimeStamp,
		);
		const wordTailDuration = wordEndStamp - cursor.lastTimeStamp;
		if (wordTailDuration > 0) {
			this.advanceTimelineStep(cursor, config, wordTailDuration, 0);
		}
		cursor.lastTimeStamp = wordEndStamp;
	}

	private advancePlainWordTimeline(
		cursor: KeyframeTimelineCursor,
		otherWord: MaskTargetWord,
		config: KeyframeConfig,
		wordIndex: number,
	): void {
		const { startTime, endTime, width } = otherWord;
		const fadeDuration = Math.max(0, endTime - startTime);

		let movePx = width;
		if (wordIndex === 0) {
			movePx += config.fadeWidth * 1.5;
		}
		if (wordIndex === this.words.length - 1) {
			movePx += config.fadeWidth * 0.5;
		}

		this.advanceTimelineStep(cursor, config, fadeDuration, movePx);
		cursor.lastTimeStamp += fadeDuration;
	}

	private advanceTimelineStep(
		cursor: KeyframeTimelineCursor,
		config: KeyframeConfig,
		duration: number,
		movePx: number,
	): void {
		cursor.timeOffset += duration / this.totalFadeDuration;
		cursor.curPos += movePx;

		if (duration > 0) {
			this.pushClampedKeyframe(cursor, config.minOffset);
		}
	}

	private pushClampedKeyframe(
		cursor: KeyframeTimelineCursor,
		minOffset: number,
	): void {
		const moveOffset = cursor.curPos - cursor.lastPos;
		const time = Math.min(1, Math.max(0, cursor.timeOffset));
		const duration = time - cursor.lastTime;
		const msPerPixel = moveOffset !== 0 ? Math.abs(duration / moveOffset) : 0;

		// 穿越左侧不可见边界进入有效视野时，插值一个折点
		if (cursor.curPos > minOffset && cursor.lastPos < minOffset) {
			const staticTime = Math.abs(cursor.lastPos - minOffset) * msPerPixel;
			cursor.frames.push({
				offset: cursor.lastTime + staticTime,
				maskPosition: `${Math.min(Math.max(cursor.lastPos, minOffset), 0)}px 0`,
			});
		}

		// 穿越右侧越界边界时，插值一个折点
		if (cursor.curPos > 0 && cursor.lastPos < 0) {
			const staticTime = Math.abs(cursor.lastPos) * msPerPixel;
			cursor.frames.push({
				offset: cursor.lastTime + staticTime,
				maskPosition: `${Math.min(Math.max(cursor.curPos, minOffset), 0)}px 0`,
			});
		}

		cursor.frames.push({
			offset: time,
			maskPosition: `${Math.min(Math.max(cursor.curPos, minOffset), 0)}px 0`,
		});

		cursor.lastPos = cursor.curPos;
		cursor.lastTime = time;
	}

	private getAnimationEndTime(animation: Animation): number {
		const timing = animation.effect?.getComputedTiming();
		return Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0);
	}

	public dispose(): void {
		for (const a of this.animations) {
			a.cancel();
		}
		this.animations.length = 0;

		for (const word of this.words) {
			const wordEl = word.mainElement;
			if (wordEl) {
				wordEl.style.removeProperty("mask");
			}
		}
	}
}
