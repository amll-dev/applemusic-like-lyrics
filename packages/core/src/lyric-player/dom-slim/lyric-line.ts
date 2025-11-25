import bezier from "bezier-easing";
import type { LyricLine, LyricWord } from "../../interfaces.ts";
import { chunkAndSplitLyricWords } from "../../utils/lyric-split-words.ts";
import {
	createMatrix4,
	matrix4ToCSS,
	scaleMatrix4,
} from "../../utils/matrix.ts";
import { mutexifyFunction } from "../../utils/mutex.ts";
import { measure, mutate } from "../../utils/schedule.ts";
import { LyricLineBase } from "../base.ts";
import styles from "./index.module.css";
import type { DomSlimLyricPlayer } from "./index.ts";

interface RealWord extends LyricWord {
	mainElement: HTMLSpanElement;
	subElements: HTMLSpanElement[];
	elementAnimations: Animation[];
	maskAnimations: Animation[];
	width: number;
	height: number;
	padding: number;
	shouldEmphasize: boolean;
}

const ANIMATION_FRAME_QUANTITY = 32;

const norNum = (min: number, max: number) => (x: number) =>
	Math.min(1, Math.max(0, (x - min) / (max - min)));
const EMP_EASING_MID = 0.5;
const beginNum = norNum(0, EMP_EASING_MID);
const endNum = norNum(EMP_EASING_MID, 1);

const bezIn = bezier(0.2, 0.4, 0.58, 1.0);
const bezOut = bezier(0.3, 0.0, 0.58, 1.0);

const makeEmpEasing = (mid: number) => {
	return (x: number) => (x < mid ? bezIn(beginNum(x)) : 1 - bezOut(endNum(x)));
};

function generateFadeGradient(
	width: number,
	padding = 0,
	bright = "rgba(0,0,0,var(--bright-mask-alpha, 1.0))",
	dark = "rgba(0,0,0,var(--dark-mask-alpha, 1.0))",
): [string, number] {
	const totalAspect = 2 + width + padding;
	const widthInTotal = width / totalAspect;
	const leftPos = (1 - widthInTotal) / 2;
	return [
		`linear-gradient(to right,${bright} ${leftPos * 100}%,${dark} ${
			(leftPos + widthInTotal) * 100
		}%)`,
		totalAspect,
	];
}

export class RawLyricLineMouseEvent extends MouseEvent {
	constructor(
		public readonly line: LyricLineEl,
		event: MouseEvent,
	) {
		super(event.type, event);
	}
}

function getScaleFromTransform(transform: string): number {
	const match = transform.match(/matrix\(([^)]+)\)/);
	if (match) {
		const values = match[1].split(", ");
		const scaleX = Number.parseFloat(values[0]);
		const scaleY = Number.parseFloat(values[3]);
		return (scaleX + scaleY) / 2; // Average of scaleX and scaleY
	}
	return 1; // Default scale value if not found
}

type MouseEventMap = {
	[evt in keyof HTMLElementEventMap]: HTMLElementEventMap[evt] extends MouseEvent
		? evt
		: never;
};
type MouseEventTypes = MouseEventMap[keyof MouseEventMap];
type MouseEventListener = (
	this: LyricLineEl,
	ev: RawLyricLineMouseEvent,
) => void;

export class LyricLineEl extends LyricLineBase {
	private element: HTMLElement = document.createElement("div");
	private splittedWords: RealWord[] = [];
	// 由 LyricPlayer 来设置
	lineSize: number[] = [0, 0];

	constructor(
		private lyricPlayer: DomSlimLyricPlayer,
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
		this.rebuildElement();
		this.rebuildStyle();
		this.markMaskImageDirty("Initial construction");
	}
	private listenersMap = new Map<string, Set<MouseEventListener>>();
	private readonly onMouseEvent = (e: MouseEvent) => {
		const wrapped = new RawLyricLineMouseEvent(this, e);
		for (const listener of this.listenersMap.get(e.type) ?? []) {
			listener.call(this, wrapped);
		}
		if (!this.dispatchEvent(wrapped) || wrapped.defaultPrevented) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			return false;
		}
	};

	addMouseEventListener(
		type: MouseEventTypes,
		callback: MouseEventListener | null,
		options?: boolean | AddEventListenerOptions | undefined,
	): void {
		if (callback) {
			const listeners = this.listenersMap.get(type) ?? new Set();
			if (listeners.size === 0)
				this.element.addEventListener(type, this.onMouseEvent, options);
			listeners.add(callback);
			this.listenersMap.set(type, listeners);
		}
	}

	removeMouseEventListener(
		type: MouseEventTypes,
		callback: MouseEventListener | null,
		options?: boolean | EventListenerOptions | undefined,
	): void {
		if (callback) {
			const listeners = this.listenersMap.get(type);
			if (listeners) {
				listeners.delete(callback);
				if (listeners.size === 0)
					this.element.removeEventListener(type, this.onMouseEvent, options);
			}
		}
	}

	areWordsOnSameLine(word1: RealWord, word2: RealWord) {
		if (word1?.mainElement && word2?.mainElement) {
			const word1el = word1.mainElement;
			const word2el = word2.mainElement;

			const rect1 = word1el.getBoundingClientRect();
			const rect2 = word2el.getBoundingClientRect();

			// 检查两个单词的顶部距离是否相等（或者差值很小）
			const topDifference = Math.abs(rect1.top - rect2.top);

			// 如果顶部距离相差很小，可以认为它们在同一行上
			return topDifference < 10;
		}

		return true;
	}

	private isEnabled = false;
	async enable(maskAnimationTime = this.lyricLine.startTime) {
		this.isEnabled = true;
		this.element.classList.add(styles.active);
		await this.waitMaskImageUpdated();
		const main = this.element.children[0] as HTMLDivElement;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				a.currentTime = 0;
				a.playbackRate = 1;
				a.play();
			}
			for (const a of word.maskAnimations) {
				a.currentTime = Math.min(
					this.totalDuration,
					Math.max(0, maskAnimationTime - this.lyricLine.startTime),
				);
				a.playbackRate = 1;
				a.play();
			}
		}
		main.classList.add(styles.active);
	}
	disable() {
		this.isEnabled = false;
		this.element.classList.remove(styles.active);
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
		main.classList.remove(styles.active);
	}
	private lastWord?: RealWord;
	async resume() {
		await this.waitMaskImageUpdated();
		if (!this.isEnabled) return;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				if (
					!this.lastWord ||
					this.splittedWords.indexOf(this.lastWord) <
						this.splittedWords.indexOf(word)
				) {
					a.play();
				}
			}
			for (const a of word.maskAnimations) {
				if (
					!this.lastWord ||
					this.splittedWords.indexOf(this.lastWord) <
						this.splittedWords.indexOf(word)
				) {
					a.play();
				}
			}
		}
	}
	async pause() {
		await this.waitMaskImageUpdated();
		if (!this.isEnabled) return;
		for (const word of this.splittedWords) {
			for (const a of word.elementAnimations) {
				a.pause();
			}
			for (const a of word.maskAnimations) {
				a.pause();
			}
		}
	}
	setMaskAnimationState(maskAnimationTime = 0) {
		const t = maskAnimationTime - this.lyricLine.startTime;
		for (const word of this.splittedWords) {
			for (const a of word.maskAnimations) {
				a.currentTime = Math.min(this.totalDuration, Math.max(0, t));
				a.playbackRate = 1;
				if (t >= 0 && t < this.totalDuration) a.play();
				else a.pause();
			}
		}
	}
	private measureLockMark = false;
	private measureLock = mutexifyFunction(
		async (callback: () => Promise<void>): Promise<void> => {
			if (this.measureLockMark) return;
			this.measureLockMark = true;
			// if (this._hide) {
			// 	await mutate(() => {
			// 		this._prevParentEl.appendChild(this.element);
			// 		this.element.style.display = "";
			// 		this.element.style.visibility = "hidden";
			// 	});
			// }
			await callback();
			// if (this._hide) {
			// 	await mutate(() => {
			// 		this._prevParentEl.removeChild(this.element);
			// 		this.element.style.display = "none";
			// 		this.element.style.visibility = "";
			// 	});
			// }
			this.measureLockMark = false;
		},
	);

	getLine() {
		return this.lyricLine;
	}
	show() {
		// this._hide = false;
		// if (!this.measureLockMark && !this.element.parentElement) {
		// 	this._prevParentEl.appendChild(this.element);
		// }
		this.rebuildStyle();
	}
	hide() {
		// this._hide = true;
		// if (!this.measureLockMark && this.element.parentElement) {
		// 	this._prevParentEl.removeChild(this.element);
		// }
	}
	private rebuildStyle() {
		// let style = "";
		// if (!this.lyricPlayer.getEnableSpring() && this.isInSight) {
		// 	style += `transition-delay:${this.delay}ms;`;
		// }
		// style += `filter:blur(${Math.min(32, this.blur)}px);`;
		// if (style !== this.lastStyle) {
		// 	this.lastStyle = style;
		// 	this.element.setAttribute("style", style);
		// }
	}
	rebuildElement() {
		this.disposeElements();
		const main = this.element.children[0] as HTMLDivElement;
		const trans = this.element.children[1] as HTMLDivElement;
		const roman = this.element.children[2] as HTMLDivElement;
		// 如果是非动态歌词，那么就不需要分词了
		if (this.lyricPlayer._getIsNonDynamic()) {
			main.innerText = this.lyricLine.words.map((w) => w.word).join("");
			trans.innerText = this.lyricLine.translatedLyric;
			roman.innerText = this.lyricLine.romanLyric;
			return;
		}
		const chunkedWords = chunkAndSplitLyricWords(this.lyricLine.words);
		main.innerHTML = "";
		for (const chunk of chunkedWords) {
			if (Array.isArray(chunk)) {
				// 多个没有空格的单词组合成的一个单词数组
				if (chunk.length === 0) continue;
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
				const emp = chunk
					.map((word) => LyricLineBase.shouldEmphasize(word))
					.reduce((a, b) => a || b, LyricLineBase.shouldEmphasize(merged));
				const wrapperWordEl = document.createElement("span");
				wrapperWordEl.classList.add(styles.emphasizeWrapper);
				const characterElements: HTMLElement[] = [];
				for (const word of chunk) {
					const mainWordEl = document.createElement("span");
					// const mainWordFloatAnimation = this.initFloatAnimation(
					// 	merged,
					// 	mainWordEl,
					// );
					if (emp) {
						mainWordEl.classList.add(styles.emphasize);
						const charEls: HTMLSpanElement[] = [];
						for (const char of word.word.trim()) {
							const charEl = document.createElement("span");
							charEl.innerText = char;
							charEls.push(charEl);
							characterElements.push(charEl);
							mainWordEl.appendChild(charEl);
						}
						const realWord: RealWord = {
							...word,
							mainElement: mainWordEl,
							subElements: charEls,
							// elementAnimations: [this.initFloatAnimation(word, mainWordEl)],
							elementAnimations: [], // this.initFloatAnimation(word, mainWordEl)
							maskAnimations: [],
							width: 0,
							height: 0,
							padding: 0,
							shouldEmphasize: emp,
						};
						this.splittedWords.push(realWord);
					} else {
						mainWordEl.innerText = word.word;
						this.splittedWords.push({
							...word,
							mainElement: mainWordEl,
							subElements: [],
							// elementAnimations: [this.initFloatAnimation(word, mainWordEl)],
							elementAnimations: [], // this.initFloatAnimation(word, mainWordEl)
							maskAnimations: [],
							width: 0,
							height: 0,
							padding: 0,
							shouldEmphasize: emp,
						});
					}
					wrapperWordEl.appendChild(mainWordEl);
				}
				if (emp) {
					this.splittedWords[
						this.splittedWords.length - 1
					].elementAnimations.push(
						...this.initEmphasizeAnimation(
							merged,
							characterElements,
							merged.endTime - merged.startTime,
							merged.startTime - this.lyricLine.startTime,
						),
					);
				}

				if (merged.word.trimStart() !== merged.word) {
					main.appendChild(document.createTextNode(" "));
				}
				main.appendChild(wrapperWordEl);
				if (
					merged.word.trimEnd() !== merged.word &&
					LyricLineBase.shouldEmphasize(merged)
				) {
					main.appendChild(document.createTextNode(" "));
				}
			} else if (chunk.word.trim().length === 0) {
				// 纯空格
				main.appendChild(document.createTextNode(" "));
			} else {
				// 单个单词
				const emp = LyricLineBase.shouldEmphasize(chunk);
				const mainWordEl = document.createElement("span");
				const realWord: RealWord = {
					...chunk,
					mainElement: mainWordEl,
					subElements: [],
					// elementAnimations: [this.initFloatAnimation(chunk, mainWordEl)],
					elementAnimations: [], // this.initFloatAnimation(chunk, mainWordEl)
					maskAnimations: [],
					width: 0,
					height: 0,
					padding: 0,
					shouldEmphasize: emp,
				};
				if (LyricLineBase.shouldEmphasize(chunk)) {
					mainWordEl.classList.add(styles.emphasize);
					const charEls: HTMLSpanElement[] = [];
					for (const char of chunk.word.trim()) {
						const charEl = document.createElement("span");
						charEl.innerText = char;
						charEls.push(charEl);
						mainWordEl.appendChild(charEl);
					}
					realWord.subElements = charEls;
					const duration = Math.abs(realWord.endTime - realWord.startTime);
					realWord.elementAnimations.push(
						...this.initEmphasizeAnimation(
							chunk,
							charEls,
							duration,
							realWord.startTime - this.lyricLine.startTime,
						),
					);
					// realWord.elementAnimations = this.initEmphasizeAnimation(realWord);
				} else {
					mainWordEl.innerText = chunk.word.trim();
				}
				if (chunk.word.trimStart() !== chunk.word) {
					main.appendChild(document.createTextNode(" "));
				}
				main.appendChild(mainWordEl);
				if (chunk.word.trimEnd() !== chunk.word) {
					main.appendChild(document.createTextNode(" "));
				}
				this.splittedWords.push(realWord);
			}
		}
		trans.innerText = this.lyricLine.translatedLyric;
		roman.innerText = this.lyricLine.romanLyric;
	}
	// 按照原 Apple Music 参考，强调效果只应用缩放、轻微左右位移和辉光效果，原主要的悬浮位移效果不变
	// 为了避免产生锯齿抖动感，使用 matrix3d 来实现缩放和位移
	private initEmphasizeAnimation(
		word: LyricWord,
		characterElements: HTMLElement[],
		duration: number,
		delay: number,
	): Animation[] {
		const de = Math.max(0, delay);
		let du = Math.max(1000, duration);

		let result: Animation[] = [];

		let amount = du / 2000;
		amount = amount > 1 ? Math.sqrt(amount) : amount ** 3;
		let blur = du / 3000;
		blur = blur > 1 ? Math.sqrt(blur) : blur ** 3;
		amount *= 0.6;
		blur *= 0.5;
		if (
			this.lyricLine.words.length > 0 &&
			word.word.includes(
				this.lyricLine.words[this.lyricLine.words.length - 1].word,
			)
		) {
			amount *= 1.6;
			blur *= 1.5;
			du *= 1.2;
		}
		amount = Math.min(1.2, amount);
		blur = Math.min(0.8, blur);

		const animateDu = Number.isFinite(du) ? du : 0;
		const empEasing = makeEmpEasing(EMP_EASING_MID);

		result = characterElements.flatMap((el, i, arr) => {
			const wordDe = de + (du / 2.5 / arr.length) * i;
			const result: Animation[] = [];

			const frames: Keyframe[] = new Array(ANIMATION_FRAME_QUANTITY)
				.fill(0)
				.map((_, j) => {
					const x = (j + 1) / ANIMATION_FRAME_QUANTITY;
					const transX = empEasing(x);
					const glowLevel = empEasing(x) * blur;

					const mat = scaleMatrix4(createMatrix4(), 1 + transX * 0.1 * amount);
					const offsetX = -transX * 0.03 * amount * (arr.length / 2 - i);
					const offsetY = -transX * 0.025 * amount;

					return {
						offset: x,
						transform: `${matrix4ToCSS(
							mat,
							4,
						)} translate(${offsetX}em, ${offsetY}em)`,
						textShadow: `0 0 ${Math.min(
							0.3,
							blur * 0.3,
						)}em rgba(255, 255, 255, ${glowLevel})`,
					};
				});

			const glow = el.animate(frames, {
				duration: animateDu,
				delay: Number.isFinite(wordDe) ? wordDe : 0,
				id: `emphasize-word-${el.innerText}-${i}`,
				iterations: 1,
				composite: "replace",
				fill: "both",
			});
			glow.onfinish = () => {
				glow.pause();
			};
			glow.pause();
			result.push(glow);

			const floatFrame: Keyframe[] = new Array(ANIMATION_FRAME_QUANTITY)
				.fill(0)
				.map((_, j) => {
					const x = (j + 1) / ANIMATION_FRAME_QUANTITY;
					let y = Math.sin(x * Math.PI);
					// y = x < 0.5 ? y : Math.max(y, 1.0);
					if (this.lyricLine.isBG) {
						y *= 2;
					}

					return {
						offset: x,
						transform: `translateY(${-y * 0.05}em)`,
					};
				});
			const float = el.animate(floatFrame, {
				duration: animateDu * 1.4,
				delay: Number.isFinite(wordDe) ? wordDe - 400 : 0,
				id: "emphasize-word-float",
				iterations: 1,
				composite: "add",
				fill: "both",
			});
			float.onfinish = () => {
				float.pause();
			};
			float.pause();
			result.push(float);

			return result;
		});

		return result;
	}

	private get totalDuration() {
		return this.lyricLine.endTime - this.lyricLine.startTime;
	}
	private maskImageDirty = false;
	private markImageDirtyPromiseResolve: Set<() => void> = new Set();
	private markImageDirtyPromise: Promise<void> = new Promise((resolve) => {
		this.markImageDirtyPromiseResolve.add(resolve);
	});
	markMaskImageDirty(_debugReason = ""): Promise<void> {
		this.maskImageDirty = true;
		if (!this.element.classList.contains(styles.dirty))
			this.element.classList.add(styles.dirty);
		// if (import.meta.env.DEV) {
		// 	console.log("Mark mask image dirty: ", _debugReason);
		// }
		const newPromise = Promise.all([
			this.markImageDirtyPromise,
			new Promise<void>((resolve) => {
				this.markImageDirtyPromiseResolve.add(resolve);
			}),
		]).then(() => {});
		this.markImageDirtyPromise = newPromise;
		return newPromise;
	}
	waitMaskImageUpdated(): Promise<void> {
		return this.markImageDirtyPromise;
	}
	async updateMaskImage() {
		if (
			!this.element.checkVisibility({
				contentVisibilityAuto: true,
			})
		)
			return;
		this.maskImageDirty = false;
		await this.measureLock(async () => {
			await Promise.all(
				this.splittedWords.map(async (word) => {
					const el = word.mainElement;
					if (el) {
						await measure(() => {
							word.padding = Number.parseFloat(
								getComputedStyle(el).paddingLeft,
							);
							word.width = el.clientWidth - word.padding * 2;
							word.height = el.clientHeight - word.padding * 2;
						});
					} else {
						word.width = 0;
						word.height = 0;
						word.padding = 0;
					}
					if (word.width * word.height === 0) {
						console.warn("Word size is zero");
					}
				}),
			);

			await mutate(() => {
				if (this.lyricPlayer.supportMaskImage) {
					this.generateWebAnimationBasedMaskImage();
				} else {
					this.generateCalcBasedMaskImage();
				}
			});
		});

		for (const resolve of this.markImageDirtyPromiseResolve) {
			resolve();
			this.markImageDirtyPromiseResolve.delete(resolve);
		}
		await mutate(() => {
			this.element.classList.remove(styles.dirty);
		});
	}
	private generateCalcBasedMaskImage() {
		for (const word of this.splittedWords) {
			const wordEl = word.mainElement;
			if (wordEl) {
				word.width = wordEl.clientWidth;
				word.height = wordEl.clientHeight;
				const fadeWidth = word.height * this.lyricPlayer.getWordFadeWidth();
				const [maskImage, totalAspect] = generateFadeGradient(
					fadeWidth / word.width,
				);
				const totalAspectStr = `${totalAspect * 100}% 100%`;
				if (this.lyricPlayer.supportMaskImage) {
					wordEl.style.maskImage = maskImage;
					wordEl.style.maskRepeat = "no-repeat";
					wordEl.style.maskOrigin = "left";
					wordEl.style.maskSize = totalAspectStr;
				} else {
					wordEl.style.webkitMaskImage = maskImage;
					wordEl.style.webkitMaskRepeat = "no-repeat";
					wordEl.style.webkitMaskOrigin = "left";
					wordEl.style.webkitMaskSize = totalAspectStr;
				}
				const w = word.width + fadeWidth;
				const maskPos = `clamp(${-w}px,calc(${-w}px + (var(--amll-player-time) - ${
					word.startTime
				})*${
					w / Math.abs(word.endTime - word.startTime)
				}px),0px) 0px, left top`;
				wordEl.style.maskPosition = maskPos;
				wordEl.style.webkitMaskPosition = maskPos;
			}
		}
	}
	private generateWebAnimationBasedMaskImage() {
		// 因为歌词行有可能比行内单词的结束时间早，有可能导致过渡动画提早停止出现瑕疵
		// 所以要以单词的结束时间为准
		const totalFadeDuration =
			Math.max(
				this.splittedWords.reduce((pv, w) => Math.max(w.endTime, pv), 0),
				this.lyricLine.endTime,
			) - this.lyricLine.startTime;
		this.splittedWords.forEach((word, i) => {
			const wordEl = word.mainElement;
			if (wordEl) {
				const fadeWidth = word.height * this.lyricPlayer.getWordFadeWidth();
				const [maskImage, totalAspect] = generateFadeGradient(
					fadeWidth / (word.width + word.padding * 2),
				);
				const totalAspectStr = `${totalAspect * 100}% 100%`;
				if (this.lyricPlayer.supportMaskImage) {
					wordEl.style.maskImage = maskImage;
					wordEl.style.maskRepeat = "no-repeat";
					wordEl.style.maskOrigin = "left";
					wordEl.style.maskSize = totalAspectStr;
				} else {
					wordEl.style.webkitMaskImage = maskImage;
					wordEl.style.webkitMaskRepeat = "no-repeat";
					wordEl.style.webkitMaskOrigin = "left";
					wordEl.style.webkitMaskSize = totalAspectStr;
				}
				// 为了尽可能将渐变动画在相连的每个单词间近似衔接起来
				// 要综合每个单词的效果时间和间隙生成动画帧数组
				const widthBeforeSelf =
					this.splittedWords.slice(0, i).reduce((a, b) => a + b.width, 0) +
					(this.splittedWords[0] ? fadeWidth : 0);
				const minOffset = -(word.width + word.padding * 2 + fadeWidth);
				const clampOffset = (x: number) => Math.max(minOffset, Math.min(0, x));
				let curPos = -widthBeforeSelf - word.width - word.padding - fadeWidth;
				let timeOffset = 0;
				const frames: Keyframe[] = [];
				let lastPos = curPos;
				let lastTime = 0;
				const pushFrame = () => {
					// 此处如果添加过渡函数，会导致单词时序不准确，所以不添加
					// const easing = "cubic-bezier(.33,.12,.83,.9)";
					const moveOffset = curPos - lastPos;
					const time = Math.max(0, Math.min(1, timeOffset));
					const duration = time - lastTime;
					const d = Math.abs(duration / moveOffset);
					// 因为有可能会和之前的动画有边界
					if (curPos > minOffset && lastPos < minOffset) {
						const staticTime = Math.abs(lastPos - minOffset) * d;
						const value = `${clampOffset(lastPos)}px 0`;
						const frame: Keyframe = {
							offset: lastTime + staticTime,
							maskPosition: value,
						};
						frames.push(frame);
					}
					if (curPos > 0 && lastPos < 0) {
						const staticTime = Math.abs(lastPos) * d;
						const value = `${clampOffset(curPos)}px 0`;
						const frame: Keyframe = {
							offset: lastTime + staticTime,
							maskPosition: value,
						};
						frames.push(frame);
					}
					const value = `${clampOffset(curPos)}px 0`;
					const frame: Keyframe = {
						offset: time,
						maskPosition: value,
					};
					frames.push(frame);
					lastPos = curPos;
					lastTime = time;
				};
				pushFrame();
				let lastTimeStamp = 0;
				this.splittedWords.forEach((otherWord, j) => {
					// 停顿
					{
						const curTimeStamp = otherWord.startTime - this.lyricLine.startTime;
						const staticDuration = curTimeStamp - lastTimeStamp;
						timeOffset += staticDuration / totalFadeDuration;
						if (staticDuration > 0) pushFrame();
						lastTimeStamp = curTimeStamp;
					}
					// 移动
					{
						const fadeDuration = otherWord.endTime - otherWord.startTime;
						timeOffset += fadeDuration / totalFadeDuration;
						curPos += otherWord.width;
						if (j === 0) {
							curPos += fadeWidth * 1.5;
						}
						if (j === this.splittedWords.length - 1) {
							curPos += fadeWidth * 0.5;
						}
						if (fadeDuration > 0) pushFrame();
						lastTimeStamp += fadeDuration;
					}
				});
				for (const a of word.maskAnimations) {
					a.cancel();
				}
				try {
					// TODO: 如果此处动画帧计算出错，需要一个后备方案
					// 此处如果添加过渡函数，会导致单词时序不准确，所以不添加
					const ani = wordEl.animate(frames, {
						duration: totalFadeDuration || 1,
						id: `fade-word-${word.word}-${i}`,
						fill: "both",
					});
					ani.pause();
					word.maskAnimations = [ani];
				} catch (err) {
					console.warn("应用渐变动画发生错误", frames, totalFadeDuration, err);
				}
			}
		});
	}
	getElement() {
		return this.element;
	}
	override setTransform(
		top: number = this.top,
		scale: number = this.scale,
		opacity = 1,
		blur = 0,
		force = false,
		delay = 0,
	) {
		super.setTransform(top, scale, opacity, blur, force, delay);
		const beforeInSight = this.isInSight;
		const enableSpring = this.lyricPlayer.getEnableSpring();
		this.top = top;
		this.scale = scale;
		this.delay = (delay * 1000) | 0;
		const main = this.element.children[0] as HTMLDivElement;
		// main.style.opacity = `${opacity *
		// 	(!this.hasFaded ? 1 : this.lyricPlayer._getIsNonDynamic() ? 1 : 0.3)
		// 	}`;
		main.style.opacity = `${opacity}`;
		// trans.style.opacity = `${subopacity}`;
		// roman.style.opacity = `${subopacity}`;
		if (force || !enableSpring) {
			if (force) this.element.classList.add(styles.tmpDisableTransition);
			// this.lineWebAnimationTransforms.posX.setTargetPosition(left);
			// this.lineWebAnimationTransforms.posY.setTargetPosition(top);
			// this.lineWebAnimationTransforms.scale.setTargetPosition(scale);
			this.lineTransforms.posY.setPosition(top);
			this.lineTransforms.scale.setPosition(scale);
			if (!enableSpring) {
				const afterInSight = this.isInSight;
				if (beforeInSight || afterInSight) {
					this.show();
				} else {
					this.hide();
				}
			} else this.rebuildStyle();
			if (force)
				requestAnimationFrame(() => {
					this.element.classList.remove(styles.tmpDisableTransition);
				});
		} else {
			// this.lineWebAnimationTransforms.posX.stop();
			// this.lineWebAnimationTransforms.posY.stop();
			// this.lineWebAnimationTransforms.scale.stop();
			this.lineTransforms.posY.setTargetPosition(top, delay);
			this.lineTransforms.scale.setTargetPosition(scale);
		}
	}
	update(delta = 0) {
		if (!this.lyricPlayer.getEnableSpring()) return;
		this.lineTransforms.posY.update(delta);
		this.lineTransforms.scale.update(delta);
		if (this.isInSight) {
			this.show();
			if (this.maskImageDirty) {
				this.updateMaskImage();
			}
		} else {
			this.hide();
		}
		if (this.lyricPlayer.getEnableSpring()) {
			this.element.style.setProperty(
				"--bright-mask-alpha",
				`${
					Math.max(
						0.0,
						Math.min(
							1.0,
							this.lineTransforms.scale.getCurrentPosition() / 100 - 0.97,
						) / 0.03,
					) *
						0.8 +
					0.2
				}`,
			);
			this.element.style.setProperty(
				"--dark-mask-alpha",
				`${
					Math.max(
						0.0,
						Math.min(
							1.0,
							this.lineTransforms.scale.getCurrentPosition() / 100 - 0.97,
						) / 0.03,
					) *
						0.2 +
					0.2
				}`,
			);
		} else {
			const computedStyle = window.getComputedStyle(this.element);
			const transform = computedStyle.transform;

			// Extract the scale value from the transform property
			const scale = getScaleFromTransform(transform);

			this.element.style.setProperty(
				"--bright-mask-alpha",
				`${Math.max(0.0, Math.min(1.0, (scale - 0.97) / 0.03)) * 0.8 + 0.2}`,
			);
			this.element.style.setProperty(
				"--dark-mask-alpha",
				`${Math.max(0.0, Math.min(1.0, (scale - 0.97) / 0.03)) * 0.2 + 0.2}`,
			);
		}
	}

	_getDebugTargetPos(): string {
		return `[位移: ${this.top}; 缩放: ${this.scale}; 延时: ${this.delay}]`;
	}

	get isInSight() {
		const t = this.lineTransforms.posY.getCurrentPosition();
		const h = this.lineSize[1];
		const b = t + h;
		const pb = this.lyricPlayer.size[1];
		return !(t > pb + h || b < -h);
	}
	private disposeElements() {
		for (const realWord of this.splittedWords) {
			for (const a of realWord.elementAnimations) {
				a.cancel();
			}
			for (const a of realWord.maskAnimations) {
				a.cancel();
			}
			for (const sub of realWord.subElements) {
				sub.remove();
				sub.parentNode?.removeChild(sub);
			}
			realWord.elementAnimations = [];
			realWord.maskAnimations = [];
			realWord.subElements = [];
			realWord.mainElement.remove();
			realWord.mainElement.parentNode?.removeChild(realWord.mainElement);
		}
		this.splittedWords = [];
	}
	override dispose(): void {
		this.disposeElements();
		this.element.remove();
	}
}
