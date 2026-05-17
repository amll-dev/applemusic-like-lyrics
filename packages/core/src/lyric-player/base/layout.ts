import { clamp } from "#utils/clamp.ts";
import type { SpringParams } from "#utils/spring.ts";
import type { LayoutAlignAnchor } from "./consts.ts";
import type { LyricLineGroupBase } from "./group.ts";
import type { PlayerTimelineState } from "./timeline.ts";

/**
 * 播放器布局状态。
 *
 * 这部分状态保存布局计算阶段所需的配置项与缓存值，
 * 例如对齐方式、间奏点尺寸、上一轮布局命中的目标行等。
 * 不描述播放时间线或用户滚动交互，仅记录当前歌词排布。
 */
export interface PlayerLayoutState {
	/** 间奏点元素当前测量得到的尺寸 */
	interludeDotsSize: [number, number];
	/** 上一轮布局实际对齐的目标歌词行索引 */
	targetAlignIndex: number;
	/** 上一轮布局时是否处于间奏区间 */
	lastInterludeState: boolean;
	/** 当前歌词目标行的对齐锚点 */
	alignAnchor: LayoutAlignAnchor;
	/** 当前歌词目标行在播放器高度中的相对对齐位置 */
	alignPosition: number;
	/** 视口上下额外保留的预渲染距离，单位为像素 */
	overscanPx: number;
}

/**
 * 当前命中的间奏区间信息。
 *
 * 当播放器检测到当前时间处于两句歌词之间的较长空档期时，
 * 会生成该结构，用于驱动间奏点动画的显示位置与时间范围。
 */
export interface PlayerInterlude {
	/** 间奏动画的开始时间 */
	startTime: number;
	/** 间奏动画的结束时间 */
	endTime: number;
	/** 间奏点应插入到哪一行之后；`-1` 表示位于第一行之前 */
	anchorLineIndex: number;
	/** 间奏结束后的下一句是否为对唱歌词 */
	isNextDuet: boolean;
}

/** {@link computeCurrentInterlude} 的参数类型 */
export interface ComputeCurrentInterludeInput {
	currentTime: number;
	scrollToIndex: number;
	currentGroups: LyricLineGroupBase[];
}

/**
 * 根据当前时间与当前目标行，计算当前是否处于某个可展示的间奏区间。
 *
 * 仅识别时间轴上的间奏空档，不涉及具体 DOM 元素的创建与摆放。
 * 若当前不应展示间奏动画，则返回 `undefined`。
 */
export function computeCurrentInterlude(
	input: ComputeCurrentInterludeInput,
): PlayerInterlude | undefined {
	const currentTime = input.currentTime + 20;
	const currentIndex = input.scrollToIndex;
	const groups = input.currentGroups;

	const checkGap = (k: number): PlayerInterlude | undefined => {
		if (k < -1 || k >= groups.length - 1) return undefined;

		const prevGroup = k === -1 ? null : groups[k];
		const nextGroup = groups[k + 1];

		const gapStart = prevGroup ? prevGroup.endTime : 0;
		const gapEnd = Math.max(gapStart, nextGroup.startTime - 250);

		if (gapEnd - gapStart < 4000) return undefined;

		if (gapEnd > currentTime && gapStart < currentTime) {
			return {
				startTime: Math.max(gapStart, currentTime),
				endTime: gapEnd,
				anchorLineIndex: k,
				isNextDuet: nextGroup.mainLine.getLine().isDuet,
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

/**
 * {@link computeLinePosYSpringParams} 的参数类型，
 * 用于决定当前歌词纵向滚动动画的弹簧参数。
 */
export interface ComputeLinePosYSpringParamsInput {
	/** 是否启用弹簧动画 */
	enabled: boolean;
	/** 当前用于布局的歌词数据 */
	currentGroups: LyricLineGroupBase[];
	/** 当前目标对齐行索引 */
	scrollToIndex: number;
	/** 是否处于 seeking 模式 */
	isSeeking: boolean;
	/** 是否处于间奏区间 */
	isInterludeActive: boolean;
}

/** {@link computeLinePosYSpringParams} 的结果类型 */
export interface ComputeLinePosYSpringParamsResult {
	/** 是否需要更新纵向弹簧参数 */
	shouldUpdate: boolean;
	/** 若需要更新，则返回新的参数 */
	params?: Partial<SpringParams>;
}

/**
 * 根据当前播放上下文计算歌词纵向滚动动画的弹簧参数。
 *
 * 其策略为：
 * - seeking 或间奏时使用更稳定的固定参数
 * - 普通播放时根据相邻歌词的时间间隔动态调整 stiffness / damping
 */
export function computeLinePosYSpringParams(
	input: ComputeLinePosYSpringParamsInput,
): ComputeLinePosYSpringParamsResult {
	const {
		enabled,
		currentGroups,
		scrollToIndex,
		isSeeking,
		isInterludeActive,
	} = input;

	if (!enabled || currentGroups.length === 0) {
		return { shouldUpdate: false };
	}

	if (isSeeking || isInterludeActive) {
		return {
			shouldUpdate: true,
			params: { stiffness: 90, damping: 15 },
		};
	}

	const currentGroup = currentGroups[scrollToIndex];
	const prevGroup = currentGroups[scrollToIndex - 1];

	if (!currentGroup || !prevGroup) {
		return { shouldUpdate: false };
	}

	const interval = currentGroup.startTime - prevGroup.startTime;

	const MIN_INTERVAL = 100;
	const MAX_INTERVAL = 800;
	const clampedInterval = clamp(interval, MIN_INTERVAL, MAX_INTERVAL);

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

/**
 * {@link computeGroupPresentation} 的参数类型。
 *
 * 描述一行歌词在当前布局上下文中的全部关键信息，
 * 用于计算其视觉呈现结果。
 */
export interface ComputeGroupPresentationInput {
	/** 当前歌词组索引 */
	groupIndex: number;
	/** 当前目标对齐行索引 */
	scrollToIndex: number;
	/** 当前缓冲区（{@link PlayerTimelineState.bufferedGroups}）中最靠后的歌词行索引 */
	latestIndex: number;
	/** 当前歌词行是否在缓冲集合内 */
	hasBuffered: boolean;
	/** 是否启用隐藏已播放行 */
	hidePassedLines: boolean;
	/** 是否处于播放状态 */
	isPlaying: boolean;
	/** 当前歌词是否为非逐词歌词 */
	isNonDynamic: boolean;
	/** 是否启用模糊效果 */
	enableBlur: boolean;
	/** 是否正在进行滚动交互 */
	isUserScrolling: boolean;
	/** 是否处于紧凑布局环境，例如窄屏 */
	isCompact: boolean;
	/** 当前命中的间奏区间信息 */
	interlude?: PlayerInterlude;
}

/** {@link computeGroupPresentation} 的结果类型 */
export interface ComputeGroupPresentationResult {
	/** 当前歌词行是否应视为活跃行 */
	isActive: boolean;
	/** 当前歌词行的目标不透明度 */
	targetOpacity: number;
	/** 当前歌词行的目标模糊值 */
	blurLevel: number;
}

/**
 * 计算一组歌词在当前布局中的视觉呈现参数。
 *
 * 根据播放状态、缓冲状态、布局模式与间奏信息，
 * 生成一组歌词最终应使用的活跃状态、不透明度与模糊值。
 */
export function computeGroupPresentation(
	input: ComputeGroupPresentationInput,
): ComputeGroupPresentationResult {
	const {
		groupIndex,
		scrollToIndex,
		latestIndex,
		hasBuffered,
		hidePassedLines,
		isPlaying,
		isNonDynamic,
		enableBlur,
		isUserScrolling,
		isCompact,
		interlude,
	} = input;

	const isActive =
		hasBuffered || (groupIndex >= scrollToIndex && groupIndex < latestIndex);

	const blurLevel = computeLineBlur({
		enableBlur,
		isUserScrolling,
		isActive,
		itemIndex: groupIndex,
		scrollToIndex,
		latestIndex,
		isCompact,
	});

	let targetOpacity: number;
	if (hidePassedLines) {
		if (
			groupIndex <
				(interlude ? interlude.anchorLineIndex + 1 : scrollToIndex) &&
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

	return { isActive, targetOpacity, blurLevel };
}

/** {@link computeLineBlur} 的参数类型 */
export interface ComputeLineBlurInput {
	/** 是否启用了模糊效果 */
	enableBlur: boolean;
	/** 用户是否正在滚动 */
	isUserScrolling: boolean;
	/** 当前项是否活跃 */
	isActive: boolean;
	/** 当前项索引 */
	itemIndex: number;
	/** 当前目标对齐行索引 */
	scrollToIndex: number;
	/** 缓冲区中最靠后的歌词行索引 */
	latestIndex: number;
	/** 是否处于紧凑布局环境，例如窄屏 */
	isCompact: boolean;
}

/**
 * 计算一行歌词在当前布局中的模糊等级。
 *
 * 越远离当前对齐区域的歌词会得到更高的模糊值；
 * 活跃行、滚动交互中或关闭模糊效果时返回 `0`。
 */
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
