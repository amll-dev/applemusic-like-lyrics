import type { LyricLine } from "#interfaces";
import type { SpringParams } from "#utils/spring.ts";
import type { LayoutAlignAnchor } from "./fixtures";

export interface PlayerLayoutState {
	interludeDotsSize: [number, number];
	targetAlignIndex: number;
	lastInterludeState: boolean;
	alignAnchor: LayoutAlignAnchor;
	alignPosition: number;
	overscanPx: number;
}

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
