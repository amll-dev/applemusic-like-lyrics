import type { LyricLine } from "#interfaces";
import type { SpringParams } from "#utils/spring.ts";
import { type LayoutAlignAnchor, LyricLineRenderMode } from "./fixtures";

/** 播放器布局状态 */
export interface PlayerLayoutState {
	interludeDotsSize: [number, number];
	targetAlignIndex: number;
	lastInterludeState: boolean;
	alignAnchor: LayoutAlignAnchor;
	alignPosition: number;
	overscanPx: number;
}

/** 间奏点动画参数 */
export interface PlayerInterlude {
	startTime: number;
	endTime: number;
	anchorLineIndex: number;
	isNextDuet: boolean;
}

/** {@link computeCurrentInterlude} 的参数类型 */
export interface ComputeCurrentInterludeInput {
	currentTime: number;
	scrollToIndex: number;
	processedLines: LyricLine[];
}

/** 根据当前时间计算当前的间奏点动画参数 */
export function computeCurrentInterlude(
	input: ComputeCurrentInterludeInput,
): PlayerInterlude | undefined {
	const currentTime = input.currentTime + 20;
	const currentIndex = input.scrollToIndex;
	const lines = input.processedLines;

	const checkGap = (k: number): PlayerInterlude | undefined => {
		if (k < -1 || k >= lines.length - 1) return undefined;

		const prevLine = k === -1 ? null : lines[k];
		const nextLine = lines[k + 1];

		const gapStart = prevLine ? prevLine.endTime : 0;
		const gapEnd = Math.max(gapStart, nextLine.startTime - 250);

		if (gapEnd - gapStart < 4000) {
			return undefined;
		}

		if (gapEnd > currentTime && gapStart < currentTime) {
			return {
				startTime: Math.max(gapStart, currentTime),
				endTime: gapEnd,
				anchorLineIndex: k,
				isNextDuet: nextLine.isDuet,
			};
		}
		return undefined;
	};

	return (
		checkGap(currentIndex - 1) ||
		checkGap(currentIndex) ||
		checkGap(currentIndex + 1)
	);
}

/** {@link computeLinePosYSpringParams} 的参数类型 */
export interface ComputeLinePosYSpringParamsInput {
	enabled: boolean;
	processedLines: LyricLine[];
	scrollToIndex: number;
	isSeeking: boolean;
	isInterludeActive: boolean;
}

/** {@link computeLinePosYSpringParams} 的结果类型 */
export interface ComputeLinePosYSpringParamsResult {
	shouldUpdate: boolean;
	params?: Partial<SpringParams>;
}

/** 根据当前歌词行的时间间隔动态计算滚动动画的弹簧参数 */
export function computeLinePosYSpringParams(
	input: ComputeLinePosYSpringParamsInput,
): ComputeLinePosYSpringParamsResult {
	const {
		enabled,
		processedLines,
		scrollToIndex,
		isSeeking,
		isInterludeActive,
	} = input;

	if (!enabled || processedLines.length === 0) {
		return { shouldUpdate: false };
	}

	if (isSeeking || isInterludeActive) {
		return {
			shouldUpdate: true,
			params: { stiffness: 90, damping: 15 },
		};
	}

	const currentLine = processedLines[scrollToIndex];
	const prevLine = processedLines[scrollToIndex - 1];

	if (!currentLine || !prevLine) {
		return { shouldUpdate: false };
	}

	const interval =
		currentLine.startTime -
		(prevLine.words[0]?.startTime ?? prevLine.startTime);

	const MIN_INTERVAL = 100;
	const MAX_INTERVAL = 800;
	const clampedInterval = Math.max(
		MIN_INTERVAL,
		Math.min(MAX_INTERVAL, interval),
	);

	const MAX_STIFFNESS = 220;
	const MIN_STIFFNESS = 170;

	let ratio =
		1 - (clampedInterval - MIN_INTERVAL) / (MAX_INTERVAL - MIN_INTERVAL);

	ratio = ratio ** 0.2;

	const targetStiffness =
		MIN_STIFFNESS + ratio * (MAX_STIFFNESS - MIN_STIFFNESS);

	const dampingMultiplier = 2.2;
	const targetDamping = Math.sqrt(targetStiffness) * dampingMultiplier;

	return {
		shouldUpdate: true,
		params: {
			stiffness: targetStiffness,
			damping: targetDamping,
		},
	};
}

/** {@link computeLinePresentation} 的参数类型 */
export interface ComputeLinePresentationInput {
	line: LyricLine;
	lineIndex: number;
	scrollToIndex: number;
	latestIndex: number;
	hasBuffered: boolean;
	hidePassedLines: boolean;
	isPlaying: boolean;
	isNonDynamic: boolean;
	enableScale: boolean;
	enableBlur: boolean;
	isUserScrolling: boolean;
	isCompact: boolean;
	interlude?: PlayerInterlude;
}

/** {@link computeLinePresentation} 的结果类型 */
export interface ComputeLinePresentationResult {
	isActive: boolean;
	targetOpacity: number;
	targetScale: number;
	blurLevel: number;
	renderMode: LyricLineRenderMode;
}

/**
 * 计算歌词行的视觉呈现参数
 *
 * 包括是否活跃、目标不透明度、目标缩放、模糊等级和渲染模式
 */
export function computeLinePresentation(
	input: ComputeLinePresentationInput,
): ComputeLinePresentationResult {
	const {
		line,
		lineIndex,
		scrollToIndex,
		latestIndex,
		hasBuffered,
		hidePassedLines,
		isPlaying,
		isNonDynamic,
		enableScale,
		enableBlur,
		isUserScrolling,
		isCompact,
		interlude,
	} = input;

	const isActive =
		hasBuffered || (lineIndex >= scrollToIndex && lineIndex < latestIndex);
	const blurLevel = computeLineBlur({
		enableBlur,
		isUserScrolling,
		isActive,
		itemIndex: lineIndex,
		scrollToIndex,
		latestIndex,
		isCompact,
	});

	let targetOpacity: number;
	if (hidePassedLines) {
		if (
			lineIndex < (interlude ? interlude.anchorLineIndex + 1 : scrollToIndex) &&
			isPlaying
		) {
			// 为了避免浏览器优化，这里使用了一个极小但不为零的值（几乎不可见）
			targetOpacity = 1e-4;
		} else if (hasBuffered) {
			targetOpacity = 0.85;
		} else {
			targetOpacity = isNonDynamic ? 0.2 : 1;
		}
	} else if (hasBuffered) {
		targetOpacity = 0.85;
	} else {
		targetOpacity = isNonDynamic ? 0.2 : 1;
	}

	const SCALE_ASPECT = enableScale ? 97 : 100;
	let targetScale = 100;
	if (!isActive && isPlaying) {
		targetScale = line.isBG ? 75 : SCALE_ASPECT;
	}

	return {
		isActive,
		targetOpacity,
		targetScale,
		blurLevel,
		renderMode: isActive
			? LyricLineRenderMode.GRADIENT
			: LyricLineRenderMode.SOLID,
	};
}

/** {@link computeLineBlur} 的参数类型 */
export interface ComputeLineBlurInput {
	enableBlur: boolean;
	isUserScrolling: boolean;
	isActive: boolean;
	itemIndex: number;
	scrollToIndex: number;
	latestIndex: number;
	isCompact: boolean;
}

/** 计算歌词行的模糊等级 */
export function computeLineBlur(input: ComputeLineBlurInput): number {
	const {
		enableBlur,
		isUserScrolling,
		isActive,
		itemIndex,
		scrollToIndex,
		latestIndex,
		isCompact,
	} = input;

	if (!enableBlur || isUserScrolling || isActive) {
		return 0;
	}

	let blurLevel = 1;

	if (itemIndex < scrollToIndex) {
		blurLevel += Math.abs(scrollToIndex - itemIndex) + 1;
	} else {
		blurLevel += Math.abs(itemIndex - Math.max(scrollToIndex, latestIndex));
	}

	return isCompact ? blurLevel * 0.8 : blurLevel;
}
