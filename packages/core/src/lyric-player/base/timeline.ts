import type { LyricLine } from "#src/interfaces.ts";
import { eqSet } from "#utils/eq-set.ts";

/* 播放时间线状态类型 */
export interface PlayerTimelineState {
	currentTime: number;
	lastCurrentTime: number;
	/** 热行：当前时间 {@link currentTime} 正在命中的行（含主行 + 可能跟着的 BG 行） */
	hotLines: Set<number>;
	/** 缓冲行：UI 上还保持激活表现的行，通常包含热行并可能比热行多一点（刚结束的行还在过渡稳定） */
	bufferedLines: Set<number>;
	scrollToIndex: number;
	/**
	 * 是否正在拖拽进度条
	 *
	 * 若是，播放器在更新时丢弃缓冲行，并根据当前时间直接计算热行，以保证在快速移动时迅速响应
	 */
	isSeeking: boolean;
	isPlaying: boolean;
	initialLayoutFinished: boolean;
}

/** {@link computePlayerTimeState} 的参数类型 */
export interface ComputePlayerTimeStateInput {
	time: number;
	processedLines: LyricLine[];
	hotLines: ReadonlySet<number>;
	bufferedLines: ReadonlySet<number>;
}

/** {@link computePlayerTimeState} 的返回类型 */
export interface ComputePlayerTimeStateResult {
	nextHotLines: Set<number>;
	addedIds: Set<number>;
	removedHotIds: Set<number>;
	removedBufferedIds: Set<number>;
}

export interface CommitPlayerTimeStateInput {
	timelineState: PlayerTimelineState;
	time: number;
	isSeek: boolean;
	processedLines: LyricLine[];
	hasBottomContent: boolean;
	stateResult: ComputePlayerTimeStateResult;
}

export interface CommitPlayerTimeStateResult {
	shouldLayout: boolean;
	shouldResetScroll: boolean;
	addedIds: Set<number>;
	removedHotIds: Set<number>;
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
	const { time, processedLines } = input;
	const nextHotLines = new Set(input.hotLines);
	const addedIds = new Set<number>();
	const removedHotIds = new Set<number>();
	const removedBufferedIds = new Set<number>();

	for (const lastHotId of input.hotLines) {
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

	for (const id of input.bufferedLines) {
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
 * 提交时间线状态转移的纯函数。
 * 将状态更改写入 {@link PlayerTimelineState}，
 * 并返回是否需要调整布局和重置滚动位置等信息。
 */
export function commitPlayerTimeState(
	input: CommitPlayerTimeStateInput,
): CommitPlayerTimeStateResult {
	const {
		timelineState,
		time,
		isSeek,
		processedLines,
		hasBottomContent,
		stateResult,
	} = input;
	const { addedIds, removedHotIds, removedBufferedIds } = stateResult;

	timelineState.currentTime = time;
	timelineState.hotLines = stateResult.nextHotLines;

	let shouldLayout = false;
	let shouldResetScroll = false;

	if (isSeek) {
		timelineState.bufferedLines = new Set([...timelineState.hotLines]);
		timelineState.scrollToIndex = pickScrollToIndexForSeek(
			time,
			processedLines,
			timelineState.bufferedLines,
		);
		shouldResetScroll = true;
		shouldLayout = true;
	} else if (addedIds.size > 0) {
		for (const id of addedIds) {
			timelineState.bufferedLines.add(id);
		}
		for (const id of removedBufferedIds) {
			timelineState.bufferedLines.delete(id);
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
			if (!timelineState.hotLines.has(id)) {
				timelineState.bufferedLines.delete(id);
			}
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
		addedIds,
		removedHotIds,
		removedBufferedIds,
	};
}
