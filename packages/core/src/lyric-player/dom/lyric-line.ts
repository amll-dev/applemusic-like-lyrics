import type { LyricLine, LyricWord } from "#interfaces";
import { LyricLineRenderMode } from "#lyric/base/consts.ts";
import { LyricLineBase } from "#lyric/base/line.ts";
import styles from "#styles/lyric-player.module.css";
import { clampPositive } from "#utils/clamp.ts";
import { isCJK } from "#utils/is-cjk.ts";
import { LineBalancer } from "#utils/line-balancer.ts";
import { chunkAndSplitLyricWords } from "#utils/lyric-split-words.ts";
import { Duration } from "#utils/time.ts";
import type { DomLyricPlayer } from ".";
import {
	createEmphasizeAnimation,
	createFloatAnimation,
	createLineMaskAnimator,
	type LineMaskAnimator,
} from "./animation/index.ts";

interface RealWord extends LyricWord {
	mainElement: HTMLSpanElement;
	subElements: HTMLSpanElement[];
	elementAnimations: Animation[];
	width: number;
	height: number;
	padding: number;
	shouldEmphasize: boolean;
}

export class LyricLineEl extends LyricLineBase {
	private element: HTMLElement = document.createElement("div");
	private splittedWords: RealWord[] = [];
	// 标记是否已经构建了行内的实际 DOM（单词与动画等）
	private built = false;

	// 由 LyricPlayer 来设置
	lineSize: number[] = [0, 0];

	private renderMode: LyricLineRenderMode = LyricLineRenderMode.SOLID;
	private maskAnimator?: LineMaskAnimator;

	private lastScaleNum = -1;

	/**
	 * 用于平衡换行、尽量减少各行长度差异的类
	 */
	private balancer?: LineBalancer;

	constructor(
		private lyricPlayer: DomLyricPlayer,
		private lyricLine: LyricLine = {
			words: [],
			translatedLyric: "",
			romanLyric: "",
			startTime: 0,
			endTime: 0,
			isBG: false,
			isDuet: false,
		},
	) {
		super();
		this.element.setAttribute("class", styles.lyricLine);
		if (this.lyricLine.isBG) {
			this.element.classList.add(styles.lyricBgLine);
		}
		if (this.lyricLine.isDuet) {
			this.element.classList.add(styles.lyricDuetLine);
		}
		this.element.appendChild(document.createElement("div")); // 歌词行
		this.element.appendChild(document.createElement("div")); // 翻译行
		this.element.appendChild(document.createElement("div")); // 音译行
		const main = this.element.children[0] as HTMLDivElement;
		const trans = this.element.children[1] as HTMLDivElement;
		const roman = this.element.children[2] as HTMLDivElement;
		main.setAttribute("class", styles.lyricMainLine);
		trans.setAttribute("class", styles.lyricSubLine);
		roman.setAttribute("class", styles.lyricSubLine);
		if (LyricLineBase.wordSegmenter) {
			this.balancer = new LineBalancer(main);
		}
		// 延迟构建具体行内容，进入可视区（含 overscan）时再构建
		this.rebuildStyle();
	}

	private isEnabled = false;
	async enable(
		maskAnimationTime: number = this.lyricPlayer.getCurrentTime(),
		shouldPlay: boolean = this.lyricPlayer.getIsPlaying(),
	): Promise<void> {
		this.isEnabled = true;
		this.element.classList.add(styles.active);
		const main = this.element.children[0] as HTMLDivElement;

		const relativeTime = clampPositive(
			maskAnimationTime - this.lyricLine.startTime,
		);

		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				a.currentTime = relativeTime;
				a.playbackRate = 1;

				const timing = a.effect?.getComputedTiming();
				const endTime =
					Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0);
				if (shouldPlay && relativeTime < endTime) a.play();
				else a.pause();
			}
		}

		this.maskAnimator?.setCurrentTime(relativeTime, shouldPlay);

		main.classList.add(styles.active);
	}

	disable(): void {
		this.isEnabled = false;
		this.element.classList.remove(styles.active);
		this.setRenderMode(LyricLineRenderMode.SOLID);

		const main = this.element.children[0] as HTMLDivElement;

		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				if (
					a.id === "float-word" ||
					a.id.includes("emphasize-word-float-only")
				) {
					a.playbackRate = -1;
					a.play();
				}
			}
		}

		this.maskAnimator?.pause();
		main.classList.remove(styles.active);
	}

	private lastWord?: RealWord;

	async resume(): Promise<void> {
		if (!this.isEnabled) return;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				if (
					!this.lastWord ||
					this.splittedWords.indexOf(this.lastWord) <
						this.splittedWords.indexOf(word)
				) {
					const timing = a.effect?.getComputedTiming();
					const endTime =
						Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0);
					if (
						a.playState !== "finished" &&
						((a.currentTime as number) || 0) < endTime
					)
						a.play();
				}
			}
		}
		this.maskAnimator?.resume();
	}

	async pause(): Promise<void> {
		if (!this.isEnabled) return;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				a.pause();
			}
		}
		this.maskAnimator?.pause();
	}

	getLine(): LyricLine {
		return this.lyricLine;
	}
	// private _hide = true;

	show(): void {
		if (!this.built) {
			this.rebuildElement();
			this.built = true;
			this.updateMaskImageSync();
		}
	}

	private rebuildStyle(): void {
		const style = this.element.style;
		const currentScale = this.lineTransforms.scale.getCurrentPosition() / 100;

		if (Math.abs(currentScale - this.lastScaleNum) >= 0.0001) {
			this.lastScaleNum = currentScale;
			style.transform = `scale(${currentScale.toFixed(3)})`;
		}
	}

	override rebuildElement(): void {
		this.disposeElements();
		const main = this.element.children[0] as HTMLDivElement;
		const trans = this.element.children[1] as HTMLDivElement;
		const roman = this.element.children[2] as HTMLDivElement;
		// 非动态歌词，直接渲染整行与副行
		if (this.lyricPlayer._getIsNonDynamic()) {
			main.textContent = this.lyricLine.words.map((w) => w.word).join("");
			this.setSubLinesText(trans, roman);
			return;
		}

		const chunkedWords = chunkAndSplitLyricWords(this.lyricLine.words);
		const hasRubyLine = this.lyricLine.words.some(
			(word) => (word.ruby?.length ?? 0) > 0,
		);
		const hasRomanLine = this.lyricLine.words.some(
			(word) => (word.romanWord?.trim().length ?? 0) > 0,
		);
		main.innerHTML = "";

		for (const chunk of chunkedWords) {
			this.buildWord(chunk, main, hasRubyLine, hasRomanLine);
		}

		this.setSubLinesText(trans, roman);
	}

	/** 设置翻译与音译行文本 */
	private setSubLinesText(trans: HTMLDivElement, roman: HTMLDivElement) {
		trans.textContent = this.lyricLine.translatedLyric;
		roman.textContent = this.lyricLine.romanLyric;
	}

	private getRubyCharCount(word: LyricWord) {
		return (word.ruby ?? []).reduce(
			(total, ruby) => total + ruby.word.length,
			0,
		);
	}

	private getRubySegments(word: LyricWord) {
		return (word.ruby ?? []).filter(
			(ruby) => (ruby?.word?.trim().length ?? 0) > 0,
		);
	}

	private createWord(
		word: LyricWord,
		shouldEmphasize: boolean,
		hasRubyLine: boolean,
		hasRomanLine: boolean,
	): RealWord {
		const mainWordEl = document.createElement("span");
		const subElements: HTMLSpanElement[] = [];
		const romanWord = word.romanWord?.trim() ?? "";
		const wordContainer = hasRubyLine
			? document.createElement("span")
			: mainWordEl;
		const wordTextContainer = hasRubyLine
			? document.createElement("span")
			: wordContainer;

		if (hasRubyLine) {
			const rubyWordEl = document.createElement("span");
			const rubySegments = this.getRubySegments(word);
			for (const ruby of rubySegments) {
				const rubyPartEl = document.createElement("span");
				rubyPartEl.textContent = ruby.word;
				rubyPartEl.dataset.startTime = String(ruby.startTime);
				rubyPartEl.dataset.endTime = String(ruby.endTime);
				rubyWordEl.appendChild(rubyPartEl);
			}
			rubyWordEl.classList.add(styles.rubyWord);
			mainWordEl.classList.add(styles.wordWithRuby);
			wordContainer.classList.add(styles.wordBody);
			wordTextContainer.classList.add(styles.rubyBaseWord);
			wordContainer.appendChild(wordTextContainer);
			mainWordEl.appendChild(rubyWordEl);
			mainWordEl.appendChild(wordContainer);
		}

		const displayWord = word.word;

		if (shouldEmphasize) {
			mainWordEl.classList.add(styles.emphasize);
			const trimmedWord = displayWord.trim();

			if (LyricLineBase.graphemeSegmenter) {
				for (const { segment } of LyricLineBase.graphemeSegmenter.segment(
					trimmedWord,
				)) {
					const charEl = document.createElement("span");
					charEl.textContent = segment;
					subElements.push(charEl);
					wordTextContainer.appendChild(charEl);
				}
			} else {
				for (const segment of Array.from(trimmedWord)) {
					const charEl = document.createElement("span");
					charEl.textContent = segment;
					subElements.push(charEl);
					wordTextContainer.appendChild(charEl);
				}
			}
		} else {
			if (hasRomanLine) {
				const wordEl = document.createElement("div");
				wordEl.textContent = displayWord.trim();
				wordTextContainer.appendChild(wordEl);
			} else if (romanWord.length === 0) {
				wordTextContainer.textContent = displayWord.trim();
			}
		}

		if (hasRomanLine) {
			const romanWordEl = document.createElement("div");
			romanWordEl.textContent = romanWord.length > 0 ? romanWord : "\u00A0";
			romanWordEl.classList.add(styles.romanWord);
			wordContainer.appendChild(romanWordEl);
		}

		const realWord: RealWord = {
			...word,
			mainElement: mainWordEl,
			subElements: subElements,
			elementAnimations: [
				createFloatAnimation(mainWordEl, {
					word: word,
					lineStartTime: this.lyricLine.startTime,
					isBG: this.lyricLine.isBG,
				}),
			],
			width: 0,
			height: 0,
			padding: 0,
			shouldEmphasize: shouldEmphasize,
		};

		return realWord;
	}

	private buildWord(
		input: LyricWord | LyricWord[],
		main: HTMLDivElement,
		hasRubyLine: boolean,
		hasRomanLine: boolean,
	) {
		const chunk = Array.isArray(input) ? input : [input];
		if (chunk.length === 0) return;

		const isPureSpace = chunk.every((w) => !w.word.trim());
		if (isPureSpace) {
			const textContent = chunk.map((w) => w.word).join("");
			main.appendChild(document.createTextNode(textContent));
			return;
		}

		const merged = chunk.reduce(
			(a, b) => {
				a.endTime = Math.max(a.endTime, b.endTime);
				a.startTime = Math.min(a.startTime, b.startTime);
				a.word += b.word;
				return a;
			},
			{
				word: "",
				romanWord: "",
				startTime: Number.POSITIVE_INFINITY,
				endTime: Number.NEGATIVE_INFINITY,
				wordType: "normal",
				obscene: false,
			} as LyricWord,
		);

		let emp = chunk.some((word) => LyricLineBase.shouldEmphasize(word));
		if (!isCJK(merged.word)) {
			emp = emp || LyricLineBase.shouldEmphasize(merged);
		}

		const wrapperWordEl = document.createElement("span");
		wrapperWordEl.classList.add(styles.emphasizeWrapper);

		const characterElements: HTMLElement[] = [];

		for (const word of chunk) {
			if (!word.word.trim()) {
				wrapperWordEl.appendChild(document.createTextNode(word.word));
				continue;
			}

			const realWord = this.createWord(word, emp, hasRubyLine, hasRomanLine);

			if (emp) {
				characterElements.push(...realWord.subElements);
			}

			this.splittedWords.push(realWord);
			wrapperWordEl.appendChild(realWord.mainElement);
		}

		if (emp && this.splittedWords.length > 0) {
			const lastWordOfChunk = this.splittedWords[this.splittedWords.length - 1];
			const rubyCharCount = chunk.reduce(
				(total, word) => total + this.getRubyCharCount(word),
				0,
			);

			const lineWords = this.lyricLine.words;
			const isLastWord =
				lineWords.length > 0 &&
				merged.word.includes(lineWords[lineWords.length - 1].word);

			lastWordOfChunk.elementAnimations.push(
				...createEmphasizeAnimation({
					word: merged,
					characterElements: characterElements,
					duration: merged.endTime - merged.startTime,
					delay: merged.startTime - this.lyricLine.startTime,
					rubyCharCount: rubyCharCount,
					isBG: this.lyricLine.isBG,
					isLastWord: isLastWord,
				}),
			);
		}

		main.appendChild(wrapperWordEl);
	}

	override onLineSizeChange(_size: [number, number]): void {
		this.updateMaskImageSync();
	}
	updateMaskImageSync(): void {
		for (const word of this.splittedWords) {
			const el = word.mainElement;
			if (el) {
				word.padding = Number.parseFloat(getComputedStyle(el).paddingLeft);
				word.width = el.clientWidth - word.padding * 2;
				word.height = el.clientHeight - word.padding * 2;
			} else {
				word.width = 0;
				word.height = 0;
				word.padding = 0;
			}
		}
		if (this.balancer && LyricLineBase.wordSegmenter) {
			this.balancer.balanceLineBreaks(
				this.lyricPlayer._getIsNonDynamic(),
				this.splittedWords.length > 0,
				LyricLineBase.wordSegmenter,
			);
		}

		this.maskAnimator?.dispose();

		// 因为歌词行有可能比行内单词的结束时间早，有可能导致过渡动画提早停止出现瑕疵
		// 所以要以单词的结束时间为准
		const maxEndTime = Math.max(
			0,
			...this.splittedWords.map((w) => w.endTime),
			this.lyricLine.endTime,
		);

		this.maskAnimator = createLineMaskAnimator(this.splittedWords, {
			lineStartTime: this.lyricLine.startTime,
			lineEndTime: maxEndTime,
			wordFadeWidth: this.lyricPlayer.getWordFadeWidth(),
			supportMaskImage: this.lyricPlayer.supportMaskImage,
		});

		this.maskAnimator.apply();

		if (this.isEnabled) {
			const isPlayerRunning = this.lyricPlayer.getIsPlaying?.() ?? true;
			this.enable(this.lyricPlayer.getCurrentTime(), isPlayerRunning);
		}
	}

	getElement(): HTMLElement {
		return this.element;
	}

	private setRenderMode(mode: LyricLineRenderMode): void {
		if (this.renderMode === mode) return;
		this.renderMode = mode;
		this.element.classList.toggle(
			styles.gradientMask,
			mode === LyricLineRenderMode.GRADIENT,
		);
	}

	override setTransform(
		scale: number = this.scale,
		opacity: number = this.opacity,
		blur = 0,
		delay: Duration = Duration.ZERO,
		mode: LyricLineRenderMode = LyricLineRenderMode.SOLID,
	): void {
		super.setTransform(scale, opacity, blur, delay);

		this.setRenderMode(mode);
		this.top = 0;
		this.scale = scale;
		this.delay = delay;

		if (this.lyricPlayer.getEnableSpring()) {
			this.lineTransforms.scale.setTargetPosition(scale);
		} else {
			this.lineTransforms.scale.setPosition(scale);
		}
	}

	update(delta: Duration = Duration.ZERO): void {
		if (!this.lyricPlayer.getEnableSpring()) return;

		const scaleMoving = !this.lineTransforms.scale.arrived();
		this.lineTransforms.scale.update(delta);

		if (scaleMoving) {
			this.isUiDirty = true;
		}
	}

	override commitChanges(): void {
		if (this.isUiDirty) {
			this.rebuildStyle();
			this.isUiDirty = false;
		}
	}

	/** @internal */
	_getDebugTargetPos(): string {
		return `[位移: ${this.top}; 缩放: ${this.scale}; 延时: ${this.delay}]`;
	}

	private disposeElements() {
		this.balancer?.reset();
		this.maskAnimator?.dispose();
		this.maskAnimator = undefined;

		for (const realWord of this.splittedWords) {
			for (const a of realWord.elementAnimations) {
				a.cancel();
			}
			for (const sub of realWord.subElements) {
				sub.remove();
				sub.parentNode?.removeChild(sub);
			}
			realWord.elementAnimations = [];
			realWord.subElements = [];
			if (realWord.mainElement?.parentNode) {
				realWord.mainElement.parentNode.removeChild(realWord.mainElement);
			}
		}
		this.splittedWords = [];
		const main = this.element.children[0] as HTMLDivElement;
		const trans = this.element.children[1] as HTMLDivElement;
		const roman = this.element.children[2] as HTMLDivElement;
		if (main) main.innerHTML = "";
		if (trans) trans.innerHTML = "";
		if (roman) roman.innerHTML = "";
	}
	override dispose(): void {
		this.disposeElements();
		this.lyricPlayer.resizeObserver.unobserve(this.element);
		this.element.remove();
	}
}
