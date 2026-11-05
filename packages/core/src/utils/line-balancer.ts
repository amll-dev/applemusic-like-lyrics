import styles from "#styles/lyric-player.module.css";
import { clampPositive } from "./clamp.ts";
import {
	type ChildNodeInfo,
	calcBalancedBreaks,
	segmentForLineBreaks,
} from "./lyric-line-break.ts";
import { getTextAutospaceOffsets } from "./text-autospace.ts";
import {
	appendTextWithAutospace,
	getTextAutospaceWidth,
} from "./text-autospace-dom.ts";

let sharedCanvasCtx: CanvasRenderingContext2D | null = null;
export function getMeasurementContext(): CanvasRenderingContext2D | null {
	if (!sharedCanvasCtx) {
		const canvas = document.createElement("canvas");
		sharedCanvasCtx = canvas.getContext("2d");
	}
	return sharedCanvasCtx;
}

interface LineBalanceAdapter {
	resetDOM(): void;
	buildChildInfos(): { childInfos: ChildNodeInfo[]; fullText: string };
	applyBreaks(breaks: number[], childInfos: ChildNodeInfo[]): void;
	needsCalibration: boolean;
}

/**
 * 用于平衡歌词行在换行后的各行长度
 */
export class LineBalancer {
	private isBalancing = false;
	private lastBalancedContainerWidth = -1;
	private lastBalanceFont = "";

	constructor(private mainElement: HTMLDivElement) {}

	public balanceLineBreaks(
		isNonDynamic: boolean,
		hasSplittedWords: boolean,
		wordSegmenter: Intl.Segmenter | null,
		mainStyle?: CSSStyleDeclaration,
	): void {
		if (this.isBalancing || !this.mainElement) return;

		const computedStyle = mainStyle ?? getComputedStyle(this.mainElement);
		const font = `${computedStyle.font}|${computedStyle.letterSpacing}|${computedStyle.wordSpacing}|${computedStyle.getPropertyValue("--amll-lp-text-autospace")}`;
		if (font !== this.lastBalanceFont) {
			this.reset();
			this.lastBalanceFont = font;
		}
		const containerWidth = this.computeContainerWidth(computedStyle);

		if (containerWidth <= 0) return;

		if (isNonDynamic) {
			this.balanceNonDynamicLineBreaks(
				containerWidth,
				computedStyle,
				wordSegmenter,
			);
			return;
		}

		if (!hasSplittedWords) return;
		this.balanceDynamicLineBreaks(containerWidth, wordSegmenter);
	}

	/**
	 * 计算换行平衡所使用的容器可用宽度
	 *
	 * 调用方在判断换行输入是否变更时可复用此计算逻辑，以确保与
	 * {@link balanceLineBreaks} 内部的计算标准保持严格一致
	 * @returns 容器宽度减去左右内边距。若容器尚未完成布局，返回值可能为负值或零
	 * @param mainStyle 调用方预先获取的的主歌词行计算样式。未提供时会自行读取
	 */
	public getContainerWidth(mainStyle?: CSSStyleDeclaration): number {
		if (!this.mainElement) return 0;
		return this.computeContainerWidth(
			mainStyle ?? getComputedStyle(this.mainElement),
		);
	}

	private computeContainerWidth(computedStyle: CSSStyleDeclaration): number {
		const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
		return this.mainElement.clientWidth - paddingLeft - paddingRight;
	}

	public reset(): void {
		this.lastBalancedContainerWidth = -1;
	}

	private executeLineBalance(
		containerWidth: number,
		adapter: LineBalanceAdapter,
		wordSegmenter: Intl.Segmenter | null,
	): void {
		const existingBrs = this.mainElement.querySelectorAll("br");
		if (
			containerWidth === this.lastBalancedContainerWidth &&
			existingBrs.length > 0
		) {
			return;
		}

		adapter.resetDOM();

		// 临时设置 white-space: nowrap 以便测量单个歌词行的宽度
		const prevWhiteSpace = this.mainElement.style.whiteSpace;
		this.mainElement.style.whiteSpace = "nowrap";

		// DOM rects include scale on both the lyric line and its background wrapper.
		// Compare unscaled measurements with clientWidth, restoring animation styles after.
		const parentElement = this.mainElement.parentElement;
		const transformedAncestors: Array<[HTMLElement, string]> = [];
		let lockAcquired = false;

		try {
			for (const ancestor of [parentElement, parentElement?.parentElement]) {
				const transform = ancestor?.style.transform;
				if (ancestor && transform && transform !== "none") {
					transformedAncestors.push([ancestor, transform]);
					ancestor.style.transform = "none";
				}
			}

			const { childInfos, fullText } = adapter.buildChildInfos();

			let layoutWidth = childInfos.reduce((sum, c) => sum + c.width, 0);

			// 非动态歌词（用 Canvas 测量）才用 range 来缩放校准；动态歌词的强调 wrapper 有 1em 的 padding 和
			// margin，用 range 测会把首尾溢出的 1em 也加进来，极大地增大了行长度，视觉上就是非常激进地换行
			if (adapter.needsCalibration) {
				const range = document.createRange();
				range.selectNodeContents(this.mainElement);
				const visualWidth = range.getBoundingClientRect().width;

				const spacingWidth = childInfos.reduce(
					(sum, info) => sum + (info.spacingWidth ?? 0),
					0,
				);
				const glyphWidth = layoutWidth - spacingWidth;
				if (glyphWidth > 0 && visualWidth > spacingWidth) {
					const scale = (visualWidth - spacingWidth) / glyphWidth;
					for (const info of childInfos) {
						const spacing = info.spacingWidth ?? 0;
						info.width = (info.width - spacing) * scale + spacing;
					}
				}
				layoutWidth = visualWidth;
			}

			const safeContainerWidth = Math.max(1, containerWidth);

			if (layoutWidth <= safeContainerWidth) {
				this.lastBalancedContainerWidth = containerWidth;
				return;
			}

			const breaks = calcBalancedBreaks(
				childInfos,
				safeContainerWidth,
				fullText,
				wordSegmenter,
			);

			if (breaks.length === 0) {
				this.lastBalancedContainerWidth = containerWidth;
				return;
			}

			this.isBalancing = true;
			lockAcquired = true;

			adapter.applyBreaks(breaks, childInfos);
			this.lastBalancedContainerWidth = containerWidth;
			this.isBalancing = false;
		} finally {
			this.mainElement.style.whiteSpace = prevWhiteSpace;
			for (const [ancestor, original] of transformedAncestors.reverse()) {
				ancestor.style.transform = original;
			}

			if (lockAcquired) {
				this.isBalancing = false;
			}
		}
	}

	private balanceDynamicLineBreaks(
		containerWidth: number,
		wordSegmenter: Intl.Segmenter | null,
	): void {
		const infoToNode: Node[] = [];

		const dynamicAdapter: LineBalanceAdapter = {
			resetDOM: () => {
				this.mainElement.querySelectorAll("br").forEach((br) => {
					br.remove();
				});
				for (const el of this.mainElement.querySelectorAll(
					`.${styles.textAutospaceLineStart}`,
				)) {
					el.classList.remove(styles.textAutospaceLineStart);
				}
			},
			buildChildInfos: () => {
				infoToNode.length = 0;
				const childNodes = Array.from(this.mainElement.childNodes);
				const childInfos: ChildNodeInfo[] = [];
				const range = document.createRange();

				for (const node of childNodes) {
					if (node.nodeType === Node.TEXT_NODE) {
						const text = node.textContent ?? "";
						if (text.length === 0) continue;
						range.selectNodeContents(node);
						childInfos.push({
							width: range.getBoundingClientRect().width,
							text,
							isSpace: text.trim().length === 0,
						});
						infoToNode.push(node);
					} else if (node.nodeType === Node.ELEMENT_NODE) {
						const el = node as HTMLElement;
						const rect = el.getBoundingClientRect();
						const elStyle = getComputedStyle(el);
						const marginLeft = Number.parseFloat(elStyle.marginLeft) || 0;
						const marginRight = Number.parseFloat(elStyle.marginRight) || 0;
						childInfos.push({
							width: clampPositive(rect.width + marginLeft + marginRight),
							text: el.dataset.amllText ?? el.textContent ?? "",
							isSpace: false,
							leadingSpacing: el.classList.contains(styles.textAutospaceBefore)
								? getTextAutospaceWidth(elStyle)
								: 0,
						});
						infoToNode.push(node);
					}
				}
				return { childInfos, fullText: childInfos.map((c) => c.text).join("") };
			},
			applyBreaks: (breaks) => {
				for (let i = breaks.length - 1; i >= 0; i--) {
					const breakIndex = breaks[i];
					if (breakIndex >= 0 && breakIndex < infoToNode.length) {
						const node = infoToNode[breakIndex];
						if (node instanceof HTMLElement) {
							node.classList.add(styles.textAutospaceLineStart);
						}
						this.mainElement.insertBefore(
							document.createElement("br"),
							infoToNode[breakIndex],
						);
					}
				}
			},
			needsCalibration: false,
		};

		this.executeLineBalance(containerWidth, dynamicAdapter, wordSegmenter);
	}

	private balanceNonDynamicLineBreaks(
		containerWidth: number,
		computedStyle: CSSStyleDeclaration,
		wordSegmenter: Intl.Segmenter | null,
	): void {
		const fullText = this.mainElement.textContent ?? "";
		if (fullText.trim().length === 0) return;

		const nonDynamicAdapter: LineBalanceAdapter = {
			resetDOM: () => {
				this.mainElement.replaceChildren();
				appendTextWithAutospace(this.mainElement, fullText);
			},
			buildChildInfos: () => {
				const ctx = getMeasurementContext();

				if (!ctx) {
					console.debug(
						"Canvas 2D context is not supported, skipping line balancing",
					);
					return { childInfos: [], fullText };
				}

				ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

				if ("letterSpacing" in ctx) {
					ctx.letterSpacing =
						computedStyle.letterSpacing !== "normal"
							? computedStyle.letterSpacing
							: "0px";
				}
				if ("wordSpacing" in ctx) {
					ctx.wordSpacing =
						computedStyle.wordSpacing !== "normal"
							? computedStyle.wordSpacing
							: "0px";
				}

				const childInfos: ChildNodeInfo[] = [];
				const offsets = getTextAutospaceOffsets(fullText);
				const spacing = getTextAutospaceWidth(computedStyle);
				let boundary = 0;
				for (const { segment, index } of segmentForLineBreaks(
					fullText,
					wordSegmenter,
				)) {
					const leadingSpacing = offsets[boundary] === index ? spacing : 0;
					let count = 0;
					while (
						boundary < offsets.length &&
						offsets[boundary] < index + segment.length
					) {
						count++;
						boundary++;
					}
					const spacingWidth = count * spacing;
					childInfos.push({
						width: ctx.measureText(segment).width + spacingWidth,
						text: segment,
						isSpace: segment.trim().length === 0,
						leadingSpacing,
						spacingWidth,
					});
				}

				return { childInfos, fullText };
			},
			applyBreaks: (breaks, childInfos) => {
				this.mainElement.innerHTML = "";
				const breakSet = new Set(breaks);
				const fragment = document.createDocumentFragment();

				for (let i = 0; i < childInfos.length; i++) {
					if (breakSet.has(i)) {
						fragment.appendChild(document.createElement("br"));
					}
					appendTextWithAutospace(
						fragment,
						childInfos[i].text,
						!breakSet.has(i) && (childInfos[i].leadingSpacing ?? 0) > 0,
					);
				}
				this.mainElement.appendChild(fragment);
			},
			needsCalibration: true,
		};

		this.executeLineBalance(containerWidth, nonDynamicAdapter, wordSegmenter);
	}
}
