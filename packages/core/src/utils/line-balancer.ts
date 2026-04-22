import { type ChildNodeInfo, calcBalancedBreaks } from "./lyric-line-break.ts";

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
}

/**
 * 用于平衡歌词行在换行后的各行长度
 */
export class LineBalancer {
	private isBalancing = false;
	private lastBalancedContainerWidth = -1;

	/**
	 * 防止误差导致的意外换行
	 */
	private static readonly SAFE_WIDTH_PADDING = 25;

	constructor(private mainElement: HTMLDivElement) {}

	public balanceLineBreaks(
		isNonDynamic: boolean,
		hasSplittedWords: boolean,
		wordSegmenter: Intl.Segmenter,
	): void {
		if (this.isBalancing || !this.mainElement) return;

		const computedStyle = getComputedStyle(this.mainElement);
		const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
		const containerWidth =
			this.mainElement.clientWidth - paddingLeft - paddingRight;

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

	public reset(): void {
		this.lastBalancedContainerWidth = -1;
	}

	private executeLineBalance(
		containerWidth: number,
		adapter: LineBalanceAdapter,
		wordSegmenter: Intl.Segmenter,
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

		try {
			const range = document.createRange();
			range.selectNodeContents(this.mainElement);
			const lineWidth = range.getBoundingClientRect().width;

			const safeContainerWidth = Math.max(
				1,
				containerWidth - LineBalancer.SAFE_WIDTH_PADDING,
			);

			if (lineWidth <= safeContainerWidth) {
				this.lastBalancedContainerWidth = containerWidth;
				return;
			}

			const { childInfos, fullText } = adapter.buildChildInfos();

			const measuredTotal = childInfos.reduce((sum, c) => sum + c.width, 0);
			if (measuredTotal > 0 && lineWidth > 0) {
				const scale = lineWidth / measuredTotal;
				for (const info of childInfos) {
					info.width *= scale;
				}
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
			adapter.applyBreaks(breaks, childInfos);
			this.lastBalancedContainerWidth = containerWidth;
			this.isBalancing = false;
		} finally {
			this.mainElement.style.whiteSpace = prevWhiteSpace;
		}
	}

	private balanceDynamicLineBreaks(
		containerWidth: number,
		wordSegmenter: Intl.Segmenter,
	): void {
		const infoToNode: Node[] = [];

		const dynamicAdapter: LineBalanceAdapter = {
			resetDOM: () => {
				this.mainElement.querySelectorAll("br").forEach((br) => {
					br.remove();
				});
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
							width: Math.max(0, rect.width + marginLeft + marginRight),
							text: el.textContent ?? "",
							isSpace: false,
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
						this.mainElement.insertBefore(
							document.createElement("br"),
							infoToNode[breakIndex],
						);
					}
				}
			},
		};

		this.executeLineBalance(containerWidth, dynamicAdapter, wordSegmenter);
	}

	private balanceNonDynamicLineBreaks(
		containerWidth: number,
		computedStyle: CSSStyleDeclaration,
		wordSegmenter: Intl.Segmenter,
	): void {
		const fullText = this.mainElement.textContent ?? "";
		if (fullText.trim().length === 0) return;

		const nonDynamicAdapter: LineBalanceAdapter = {
			resetDOM: () => {
				this.mainElement.innerHTML = "";
				this.mainElement.textContent = fullText;
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
				for (const { segment } of wordSegmenter.segment(fullText)) {
					childInfos.push({
						width: ctx.measureText(segment).width,
						text: segment,
						isSpace: segment.trim().length === 0,
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
					fragment.appendChild(document.createTextNode(childInfos[i].text));
				}
				this.mainElement.appendChild(fragment);
			},
		};

		this.executeLineBalance(containerWidth, nonDynamicAdapter, wordSegmenter);
	}
}
