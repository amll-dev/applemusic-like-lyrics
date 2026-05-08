import type { LyricLine } from "#interfaces";
import { eqSet } from "#utils/eq-set.ts";

/**
 * 播放时间线状态。
 *
 * 描述播放器在时间轴上的当前位置，当前处于激活状态的歌词行信息
 */
export interface PlayerTimelineState {
	/** 当前播放时间，单位为毫秒 */
	currentTime: number;
	/** 上一次提交到时间线状态的播放时间，单位为毫秒 */
	lastCurrentTime: number;
	/** 热行：当前时间 {@link currentTime} 正在命中的行（含主行+可能的背景行） */
	hotLines: Set<number>;
	/** 缓冲行：UI 上还保持激活表现的行，通常包含热行，并包含刚结束仍在过渡中的行 */
	bufferedLines: Set<number>;
	/** 当前应滚动对齐到的歌词行索引 */
	scrollToIndex: number;
	/** 是否正在拖拽进度条。若是，更新时丢弃缓冲行，并根据当前时间直接计算热行 */
	isSeeking: boolean;
	/** 是否处于播放状态 */
	isPlaying: boolean;
	/** 是否已经完成至少一次初始布局 */
	initialLayoutFinished: boolean;
}

/** {@link computePlayerTimeState} 的参数类型 */
export interface ComputePlayerTimeStateInput {
	time: number;
	processedLines: LyricLine[];
	timelineState: Readonly<PlayerTimelineState>;
}

/** {@link computePlayerTimeState} 的返回类型 */
export interface ComputePlayerTimeStateResult {
	/** 计算后的新热行集合 */
	nextHotLines: Set<number>;
	/** 需要新加入热行集合的行索引 */
	addedIds: Set<number>;
	/** 需要从热行集合中移除的行索引 */
	removedHotIds: Set<number>;
	/** 需要从缓冲行集合中移除的行索引 */
	removedBufferedIds: Set<number>;
}

/**
 * 计算指定时间点的热行/缓冲行状态转移的纯函数。其行为包括：
 *
 * - 根据当前时间和已有的热行状态，计算出新的热行状态，并返回应新增的热行 ID 和应移除的热行 ID
 * - 根据新的热行状态和已有的缓冲行状态，计算出应移除的缓冲行 ID
 */
export function computePlayerTimeState(
	input: ComputePlayerTimeStateInput,
): ComputePlayerTimeStateResult {
	const {
		time,
		processedLines,
		timelineState: { hotLines, bufferedLines },
	} = input;
	const nextHotLines = new Set(hotLines);
	const addedIds = new Set<number>();
	const removedHotIds = new Set<number>();
	const removedBufferedIds = new Set<number>();

	for (const lastHotId of hotLines) {
		const line = processedLines[lastHotId];
		if (!line) {
			nextHotLines.delete(lastHotId);
			removedHotIds.add(lastHotId);
			continue;
		}
		if (line.isBG) continue;
		const nextLine = processedLines[lastHotId + 1];
		if (nextLine?.isBG) {
			const nextMainLine = processedLines[lastHotId + 2];
			const startTime = Math.min(line.startTime, nextLine.startTime);
			const endTime = Math.min(
				Math.max(line.endTime, nextMainLine?.startTime ?? Number.MAX_VALUE),
				Math.max(line.endTime, nextLine.endTime),
			);
			if (time < startTime || endTime <= time) {
				nextHotLines.delete(lastHotId);
				removedHotIds.add(lastHotId);
				nextHotLines.delete(lastHotId + 1);
				removedHotIds.add(lastHotId + 1);
			}
		} else if (time < line.startTime || line.endTime <= time) {
			nextHotLines.delete(lastHotId);
			removedHotIds.add(lastHotId);
		}
	}

	for (let id = 0; id < processedLines.length; id++) {
		const line = processedLines[id];
		if (!line || line.isBG) continue;
		if (
			line.startTime <= time &&
			line.endTime > time &&
			!nextHotLines.has(id)
		) {
			nextHotLines.add(id);
			addedIds.add(id);
			if (processedLines[id + 1]?.isBG) {
				nextHotLines.add(id + 1);
				addedIds.add(id + 1);
			}
		}
	}

	for (const id of bufferedLines) {
		if (!nextHotLines.has(id)) {
			removedBufferedIds.add(id);
		}
	}

	return {
		nextHotLines,
		addedIds,
		removedHotIds,
		removedBufferedIds,
	};
}

/**
 * 在 seeking 场景下，根据当前时间选出应对齐滚动到的目标行索引。
 *
 * 若当前仍存在缓冲行，则优先对齐到最靠前的缓冲行；
 * 否则对齐到第一条开始时间不小于当前时间的歌词行。
 */
export function pickScrollToIndexForSeek(
	time: number,
	processedLines: LyricLine[],
	bufferedLines: ReadonlySet<number>,
): number {
	if (bufferedLines.size > 0) {
		return Math.min(...bufferedLines);
	}
	const foundIndex = processedLines.findIndex((line) => line.startTime >= time);
	return foundIndex === -1 ? processedLines.length : foundIndex;
}

/**
 * {@link commitPlayerTimeState} 的参数类型。
 *
 * 用于将一次时间线状态转移提交回 {@link PlayerTimelineState}，
 * 并生成供宿主执行的副作用应用计划。
 */
export interface CommitPlayerTimeStateInput {
	/** 要被更新的时间线状态对象 */
	timelineState: PlayerTimelineState;
	/** 当前播放时间，单位为毫秒 */
	time: number;
	/** 当前用于计算的歌词数据 */
	processedLines: LyricLine[];
	/** 底部附加区域当前是否有可见内容 */
	hasBottomContent: boolean;
	/** 由 {@link computePlayerTimeState} 得到的状态转移结果 */
	stateResult: ComputePlayerTimeStateResult;
}

/** {@link commitPlayerTimeState} 的返回类型 */
export interface CommitPlayerTimeStateResult {
	/** 提交后是否需要重新布局 */
	shouldLayout: boolean;
	/** 提交后是否需要重置用户滚动状态 */
	shouldResetScroll: boolean;
	/** 需要启用的歌词行索引列表 */
	linesToEnable: number[];
	/** 需要禁用的歌词行索引列表 */
	linesToDisable: number[];
}

/**
 * 提交时间线状态转移的纯函数。
 *
 * 把一次时间线状态转移写回 {@link PlayerTimelineState}，
 * 并返回一份供宿主执行的副作用应用计划，例如启用/禁用哪些歌词行、
 * 是否需要重置用户滚动状态、是否需要触发布局。
 */
export function commitPlayerTimeState(
	input: CommitPlayerTimeStateInput,
): CommitPlayerTimeStateResult {
	const { timelineState, time, processedLines, hasBottomContent, stateResult } =
		input;
	const { addedIds, removedHotIds, removedBufferedIds } = stateResult;
	const { isSeeking } = timelineState;

	timelineState.currentTime = time;
	timelineState.hotLines = stateResult.nextHotLines;

	let shouldLayout = false;
	let shouldResetScroll = false;
	const linesToEnable: number[] = [];
	const linesToDisable = new Set<number>();

	if (isSeeking) {
		timelineState.bufferedLines = new Set([...timelineState.hotLines]);
		timelineState.scrollToIndex = pickScrollToIndexForSeek(
			time,
			processedLines,
			timelineState.bufferedLines,
		);
		for (const id of removedHotIds) linesToDisable.add(id);
		for (const id of timelineState.hotLines) linesToEnable.push(id);
		for (const id of removedBufferedIds) linesToDisable.add(id);

		shouldResetScroll = true;
		shouldLayout = true;
	} else if (addedIds.size > 0) {
		for (const id of addedIds) {
			timelineState.bufferedLines.add(id);
			linesToEnable.push(id);
		}
		for (const id of removedBufferedIds) {
			timelineState.bufferedLines.delete(id);
			linesToDisable.add(id);
		}
		if (timelineState.bufferedLines.size > 0) {
			timelineState.scrollToIndex = Math.min(...timelineState.bufferedLines);
		}
		shouldLayout = true;
	} else if (
		removedBufferedIds.size > 0 &&
		eqSet(removedBufferedIds, timelineState.bufferedLines)
	) {
		for (const id of timelineState.bufferedLines) {
			if (timelineState.hotLines.has(id)) continue;
			timelineState.bufferedLines.delete(id);
			linesToDisable.add(id);
		}
		shouldLayout = true;
	}

	if (timelineState.bufferedLines.size === 0 && processedLines.length > 0) {
		const lastLine = processedLines[processedLines.length - 1];
		if (time >= lastLine.endTime) {
			const targetIndex = hasBottomContent
				? processedLines.length
				: processedLines.length - 1;

			if (timelineState.scrollToIndex !== targetIndex) {
				timelineState.scrollToIndex = targetIndex;
				shouldLayout = true;
			}
		}
	}

	timelineState.lastCurrentTime = time;

	return {
		shouldLayout,
		shouldResetScroll,
		linesToEnable,
		linesToDisable: [...linesToDisable],
	};
}
