import { eqSet } from "#utils/eq-set.ts";
import type { LyricLineGroupBase } from "./group.ts";

/**
 * 播放时间线状态。
 *
 * 描述播放器在时间轴上的当前位置，当前处于激活状态的歌词组信息
 */
export interface PlayerTimelineState {
	/** 当前播放时间，单位为毫秒 */
	currentTime: number;
	/** 上一次提交到时间线状态的播放时间，单位为毫秒 */
	lastCurrentTime: number;
	/** 热行：当前时间 {@link currentTime} 正在命中的组（含主行+可能的背景行） */
	hotGroups: Set<number>;
	/** 缓冲组：UI 上还保持激活表现的组索引，通常包含热组，和刚结束仍在过渡中的组 */
	bufferedGroups: Set<number>;
	/** 当前应滚动对齐到的歌词组索引 */
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
	currentGroups: LyricLineGroupBase[];
	timelineState: Readonly<PlayerTimelineState>;
}

/** {@link computePlayerTimeState} 的返回类型 */
export interface ComputePlayerTimeStateResult {
	/** 计算后的新热组集合 */
	nextHotGroups: Set<number>;
	/** 需要新加入热组集合的组索引 */
	addedIds: Set<number>;
	/** 需要从热组集合中移除的组索引 */
	removedHotIds: Set<number>;
	/** 需要从缓冲组集合中移除的组索引 */
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
		currentGroups,
		timelineState: { hotGroups, bufferedGroups },
	} = input;

	const nextHotGroups = new Set(hotGroups);
	const addedIds = new Set<number>();
	const removedHotIds = new Set<number>();
	const removedBufferedIds = new Set<number>();

	for (const lastHotId of hotGroups) {
		const group = currentGroups[lastHotId];
		if (!group || time < group.startTime || group.endTime <= time) {
			nextHotGroups.delete(lastHotId);
			removedHotIds.add(lastHotId);
		}
	}

	for (let id = 0; id < currentGroups.length; id++) {
		const group = currentGroups[id];
		if (!group) continue;

		if (
			group.startTime <= time &&
			group.endTime > time &&
			!nextHotGroups.has(id)
		) {
			nextHotGroups.add(id);
			addedIds.add(id);
		}
	}

	for (const id of bufferedGroups) {
		if (!nextHotGroups.has(id)) {
			removedBufferedIds.add(id);
		}
	}

	return {
		nextHotGroups,
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
	currentGroups: LyricLineGroupBase[],
	bufferedGroups: ReadonlySet<number>,
): number {
	if (bufferedGroups.size > 0) {
		return Math.min(...bufferedGroups);
	}
	const foundIndex = currentGroups.findIndex(
		(group) => group.startTime >= time,
	);
	return foundIndex === -1 ? currentGroups.length : foundIndex;
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
	currentGroups: LyricLineGroupBase[];
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
	/** 需要启用的歌词组索引列表 */
	groupsToEnable: number[];
	/** 需要禁用的歌词组索引列表 */
	groupsToDisable: number[];
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
	const { timelineState, time, currentGroups, hasBottomContent, stateResult } =
		input;
	const { addedIds, removedHotIds, removedBufferedIds } = stateResult;
	const { isSeeking } = timelineState;

	timelineState.currentTime = time;
	timelineState.hotGroups = stateResult.nextHotGroups;

	let shouldLayout = false;
	let shouldResetScroll = false;
	const groupsToEnable: number[] = [];
	const groupsToDisable = new Set<number>();

	if (isSeeking) {
		timelineState.bufferedGroups = new Set([...timelineState.hotGroups]);
		timelineState.scrollToIndex = pickScrollToIndexForSeek(
			time,
			currentGroups,
			timelineState.bufferedGroups,
		);
		for (const id of removedHotIds) groupsToDisable.add(id);
		for (const id of timelineState.hotGroups) groupsToEnable.push(id);
		for (const id of removedBufferedIds) groupsToDisable.add(id);

		shouldResetScroll = true;
		shouldLayout = true;
	} else if (addedIds.size > 0) {
		for (const id of addedIds) {
			timelineState.bufferedGroups.add(id);
			groupsToEnable.push(id);
		}
		for (const id of removedBufferedIds) {
			timelineState.bufferedGroups.delete(id);
			groupsToDisable.add(id);
		}
		if (timelineState.bufferedGroups.size > 0) {
			timelineState.scrollToIndex = Math.min(...timelineState.bufferedGroups);
		}
		shouldLayout = true;
	} else if (
		removedBufferedIds.size > 0 &&
		eqSet(removedBufferedIds, timelineState.bufferedGroups)
	) {
		for (const id of timelineState.bufferedGroups) {
			if (timelineState.hotGroups.has(id)) continue;
			timelineState.bufferedGroups.delete(id);
			groupsToDisable.add(id);
		}
		shouldLayout = true;
	}

	if (timelineState.bufferedGroups.size === 0 && currentGroups.length > 0) {
		const lastGroup = currentGroups[currentGroups.length - 1];
		if (time >= lastGroup.endTime) {
			const targetIndex = hasBottomContent
				? currentGroups.length
				: currentGroups.length - 1;
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
		groupsToEnable,
		groupsToDisable: [...groupsToDisable],
	};
}
