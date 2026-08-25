import { Duration, MediaTime } from "#utils/time.ts";

/**
 * 判定为间奏所需的最小空隙时长
 */
const MIN_INTERLUDE_GAP = Duration.fromMillis(4000);

//#region 类型定义
/**
 * 用于进度计算的最小歌词数据
 */
export interface TimeBounds {
	readonly startTime: MediaTime;
	readonly endTime: MediaTime;
}

/**
 * 当前命中的间奏区间信息
 */
export interface PlayerInterlude {
	/**
	 * 间奏开始时间，即此前全部歌词行中最晚的结束时间
	 */
	readonly startTime: MediaTime;

	/**
	 * 间奏结束时间，即间奏后第一行歌词的开始时间
	 */
	readonly endTime: MediaTime;

	/**
	 * 间奏点应插入的位置基准
	 *
	 * 即显示顺序上间奏前的最后一行歌词的索引，`-1` 表示第一句之前
	 */
	readonly anchorLineIndex: number;
}

/**
 * 当前播放时间线状态的只读快照
 *
 * 用于给 UI 执行排版和计算各种歌词行的效果
 *
 * @remarks
 * 在获取快照后，必须在同一帧内消费完毕，切勿保留其引用，因为下一帧就会被原地覆写
 */
export interface TimelineSnapshot {
	/**
	 * 当前时间推导所依据的绝对播放时间
	 *
	 * 一般用于提供给 UI 层在绘制/排版阶段作为基准时间
	 *
	 * 例如给 InterludeDots 计算播放动画的当前时间戳
	 */
	readonly currentTime: MediaTime;

	/**
	 * 当前进度命中的、正在播放的歌词组
	 */
	readonly playingGroups: ReadonlySet<number>;

	/**
	 * 当前进度命中的、正在高亮的歌词组
	 *
	 * 高亮的歌词组可能会多于正在播放的，例如一行歌词唱完后不会自行熄灭，而是保持高亮直到下一行开始播放
	 *
	 * 因此多行重叠时先唱完的行会陪着后面的行一起亮，句间空隙内上一行也保持高亮以维持可读性
	 */
	readonly highlightedGroups: ReadonlySet<number>;

	/**
	 * 自动滚动应该对齐到哪一行歌词
	 *
	 * 取值始终落在 `[0, 歌词行数 - 1]` 内，没有歌词时为 `0`，因此可以直接用于索引
	 *
	 * @remarks
	 * 仅在 {@link isFocusOnInterlude} 为 `false` 时有效
	 *
	 * 间奏期间此值仍然指向间奏前的那一组歌词，此时应当改为对齐 {@link activeInterlude} 的间奏点
	 */
	readonly scrollToIndex: number;

	/**
	 * 处于高亮状态的歌词行中，最靠后的一行
	 *
	 * 例如，如果当前有高亮行索引 `[1, 2, 3]`，则 `latestHighlightedIndex` 为 `3`
	 *
	 * 如果当前没有任何高亮行，被置为 undefined，如首行开始之前、间奏区间内、
	 * 歌曲播放完毕、或已开始的行均为零时长的情况
	 */
	readonly latestHighlightedIndex?: number;

	/**
	 * 标识歌曲是否播放完毕，即当前时间已经越过全部歌词行中最晚的结束时间
	 *
	 * 此时所有高亮都已被清空，一般用于展示底栏
	 */
	readonly isEndOfSong: boolean;

	/**
	 * 当前命中的间奏区间数据
	 */
	readonly activeInterlude?: PlayerInterlude;

	/**
	 * 当前是否应当聚焦在间奏点上
	 */
	readonly isFocusOnInterlude: boolean;
}

/**
 * 时间线增量变化
 *
 * 主要用于让 UI 层能够以 $O(1)$ 到 $O(K)$ 的开销知道当前这一帧相比上一帧改变了什么，
 * 而不需要去遍历或比对全量状态
 */
export interface TimelineDiff {
	/**
	 * 当前帧是否有任何实质性的状态变更，如播放行更替、高亮行新增/移除、间奏状态切换、焦点切换，或发生了跳转
	 *
	 * UI 层接收到 diff 后，检查此标志即可直接跳过后续所有的布局计算
	 */
	readonly hasChanged: boolean;

	/**
	 * 标识本次同步的时间轴是否发生了跳转
	 *
	 * 在显式跳转 (`sync` 的 `forceSeek`) 或时间倒退 / 停滞（重复推送同一时间）时为 `true`
	 *
	 * 例如跳转时使用更缓慢的弹簧参数 (参见 `spring.ts`)，
	 * 以及在非触摸状态下重置滚动坐标系
	 */
	readonly isTimeJumped: boolean;

	/**
	 * 在当前时间进度下，最新被命中的、正在播放的歌词索引列表
	 *
	 * 用于通知 UI 哪些歌词行开始播放了
	 */
	readonly addedPlaying: ReadonlyArray<number>;

	/**
	 * 在当前时间进度下，刚刚脱离正在播放状态的歌词索引列表，
	 * 即上一帧还在播放、但本帧已不再命中其 `[startTime, endTime)` 的歌词行
	 *
	 * 正常播放时是时间越过了 `endTime`，跳转时也可能是跳到了 `startTime` 之前
	 *
	 * 用于通知 UI 侧哪些歌词行已结束，后续可能会转入高亮行以保持高亮状态
	 */
	readonly removedPlaying: ReadonlyArray<number>;

	/**
	 * 在当前帧中，需要变成高亮行的歌词索引列表
	 *
	 * 一般用于 UI 遍历并启用歌词行
	 */
	readonly addedHighlighted: ReadonlyArray<number>;

	/**
	 * 在当前帧中，不再是高亮行的歌词行索引列表
	 *
	 * 一般用于 UI 遍历并停用歌词行
	 */
	readonly removedHighlighted: ReadonlyArray<number>;

	/**
	 * 标识间奏状态是否发生了切换
	 *
	 * 例如：刚刚进入间奏区间、刚刚离开间奏区间、或从一个间奏区间跳到了另一个间奏区间
	 *
	 * 用于通知 UI 是否需要重新计算间奏点的位置和动画
	 */
	readonly isInterludeChanged: boolean;

	/**
	 * 标识自动对齐的目标歌词行索引是否发生了变化
	 *
	 * 用于通知 UI 需要移动到新的歌词行
	 */
	readonly isScrollToChanged: boolean;

	/**
	 * 标识歌曲播放完毕状态是否发生了变化
	 */
	readonly isEndOfSongChanged: boolean;
}

/**
 * 将只读接口转换为可变的实现结构
 */
type Mutable<T> = {
	-readonly [P in keyof T]: T[P];
};
//#endregion

export class TimelineController {
	//#region 内部状态
	private lyricBounds: readonly TimeBounds[] = [];
	/**
	 * 全部歌词行中最晚的结束时间，用于判定歌曲是否播放完毕
	 */
	private maxEndTime: MediaTime = MediaTime.ZERO;

	/**
	 * 预先计算的间奏区域
	 */
	private precalculatedInterludes: PlayerInterlude[] = [];

	/**
	 * 保存上次顺序扫描停止的位置，用于避免每次都从头遍历所有歌词，提高性能
	 */
	private playbackCursor = 0;
	private interludeCursor = 0;

	private playingGroupsSet: Set<number> = new Set();
	private highlightedGroupsSet: Set<number> = new Set();

	private nextPlayingSet: Set<number> = new Set();
	private nextHighlightedSet: Set<number> = new Set();

	private addedPlayingIds: number[] = [];
	private removedPlayingIds: number[] = [];
	private addedHighlightedIds: number[] = [];
	private removedHighlightedIds: number[] = [];
	private expiredHighlightedIds: number[] = [];

	private readonly snapshot: Mutable<TimelineSnapshot> = {
		currentTime: MediaTime.ZERO,
		playingGroups: this.playingGroupsSet,
		highlightedGroups: this.highlightedGroupsSet,
		scrollToIndex: 0,
		latestHighlightedIndex: undefined,
		isEndOfSong: false,
		activeInterlude: undefined,
		isFocusOnInterlude: false,
	};

	private readonly diff: Mutable<TimelineDiff> = {
		hasChanged: false,
		isTimeJumped: false,
		addedPlaying: this.addedPlayingIds,
		removedPlaying: this.removedPlayingIds,
		addedHighlighted: this.addedHighlightedIds,
		removedHighlighted: this.removedHighlightedIds,
		isInterludeChanged: false,
		isScrollToChanged: false,
		isEndOfSongChanged: false,
	};
	//#endregion

	//#region 外部 API
	/**
	 * 提前设置好歌词的时间数据，内部会根据此数据来进行时间线推导，同时预计算间奏区间
	 *
	 * @param bounds 歌词行的时间边界，**必须按 `startTime` 升序排列**，不按 `startTime`
	 * 排列可能会导致时间推导出现意外情况
	 */
	public setTimeBounds(bounds: readonly TimeBounds[]): void {
		this.lyricBounds = bounds;
		this.precalculatedInterludes = this.calculateInterludes(bounds);

		// 歌词行按开始时间排序，末行的结束时间不一定是最大值
		// 例如末尾存在时间上被前一行包住的重叠行，因此单独预计算一次
		let maxEnd = MediaTime.ZERO;
		for (const bound of bounds) {
			maxEnd = MediaTime.max(maxEnd, bound.endTime);
		}
		this.maxEndTime = maxEnd;

		this.reset();
	}

	/**
	 * 获取当前播放时间线状态的只读快照
	 *
	 * 用于给 UI 执行排版和计算各种歌词行的效果
	 *
	 * @remarks 在获取快照后，必须在同一帧内消费完毕，切勿保留其引用，因为下一帧就会被原地覆写
	 * @returns 时间线快照
	 */
	public getSnapshot(): TimelineSnapshot {
		return this.snapshot;
	}

	/**
	 * 将播放进度推进到指定时间，并返回相对上一帧的增量变化
	 *
	 * @remarks
	 * 歌词行的高亮生命周期为：
	 * * 命中 `[startTime, endTime)` 时高亮
	 * * 唱完后不会自行熄灭，而是继续保持高亮
	 *
	 * 直到出现下列任一情况：
	 *
	 * 1. 有新的歌词行开始播放，此时已唱完的行被一起熄灭
	 * 2. 进入间奏区间，此时清空全部高亮并把焦点交给间奏点
	 * 3. 歌曲播放完毕，此时清空全部高亮并设置 {@link TimelineSnapshot.isEndOfSong} 为 true
	 * 4. 发生跳转，此时按跳转后的时间重新推导
	 *
	 * @param time 当前播放时间
	 * @param forceSeek 这次时间变化是否由跳转触发
	 * @returns 相对上一帧的增量变化
	 */
	public sync(time: MediaTime, forceSeek = false): TimelineDiff {
		this.addedPlayingIds.length = 0;
		this.removedPlayingIds.length = 0;
		this.addedHighlightedIds.length = 0;
		this.removedHighlightedIds.length = 0;

		const prevInterlude = this.snapshot.activeInterlude;
		const prevFocusOnInterlude = this.snapshot.isFocusOnInterlude;
		const prevScrollToIndex = this.snapshot.scrollToIndex;
		const prevEndOfSong = this.snapshot.isEndOfSong;

		// 时间不再前进时一律按跳转处理，这里有两个各自独立的理由
		//
		// 倒退是机制上的必需：performPlayback 会保存上次扫描停止的位置，下次从该位置
		// 继续扫描以提高性能，若时间倒退，倒退到的行可能位于扫描位置之前，只能重新推导
		//
		// 停滞则是语义上的约定：正常播放不会让进度停在原地，推送同一个时间表达的是把
		// 逐字遮罩这类自行推进的动画重新对齐到该时间的意图，因此也走跳转路径
		const isTimeNotAdvancing = time <= this.snapshot.currentTime;
		const isJump = forceSeek || isTimeNotAdvancing;

		// 间奏命中情况需要先于歌词状态确定
		// Seek 时要按同样的规则决定是否保留已经唱完的行，需要提前知道结果
		const activeInterlude = this.resolveActiveInterlude(time, isJump);
		this.snapshot.activeInterlude = activeInterlude;

		const isPastLastLine =
			this.lyricBounds.length > 0 && time >= this.maxEndTime;

		if (isJump) {
			this.performSeek(time, !!activeInterlude || isPastLastLine);
		} else {
			this.performPlayback(time);
		}

		// 高亮行本身不会因为唱完而熄灭，这里处理两个需要清空的场景
		// 1. 进入间奏区间：间奏点接过焦点，不应该再有亮着的旧歌词
		// 2. 歌曲播放完毕：不会再有新歌词接续，需要主动熄灭并把焦点交给底栏
		if (activeInterlude && this.playingGroupsSet.size === 0) {
			this.flushAllHighlighted();
		}
		if (isPastLastLine) {
			this.flushAllHighlighted();
		}

		this.updateInterludeFocus(activeInterlude);

		const isInterludeChanged = prevInterlude !== activeInterlude;
		const isFocusChanged =
			prevFocusOnInterlude !== this.snapshot.isFocusOnInterlude;
		const isScrollToChanged = prevScrollToIndex !== this.snapshot.scrollToIndex;
		const isEndOfSongChanged = isPastLastLine !== prevEndOfSong;

		const hasChanged =
			isJump ||
			this.addedPlayingIds.length > 0 ||
			this.removedPlayingIds.length > 0 ||
			this.addedHighlightedIds.length > 0 ||
			this.removedHighlightedIds.length > 0 ||
			isInterludeChanged ||
			isFocusChanged ||
			isScrollToChanged ||
			isEndOfSongChanged;

		this.snapshot.currentTime = time;

		if (this.highlightedGroupsSet.size > 0) {
			let maxIndex = -1;
			for (const id of this.highlightedGroupsSet) {
				if (id > maxIndex) maxIndex = id;
			}
			this.snapshot.latestHighlightedIndex = maxIndex;
		} else {
			this.snapshot.latestHighlightedIndex = undefined;
		}

		this.snapshot.isEndOfSong = isPastLastLine;

		this.diff.hasChanged = hasChanged;
		this.diff.isTimeJumped = isJump;
		this.diff.isInterludeChanged = isInterludeChanged;
		this.diff.isScrollToChanged = isScrollToChanged;
		this.diff.isEndOfSongChanged = isEndOfSongChanged;

		return this.diff;
	}
	//#endregion

	//#region 时间线推导
	/**
	 * 处理正常播放时的时间线推导
	 */
	private performPlayback(time: MediaTime): void {
		// 我在这里定义了歌词的不同状态：
		// 播放行：只要当前时间落在 [startTime, endTime) 内，就是在播放行，播放行是高亮行的子集
		// 高亮行：UI 层真正看到的高亮状态
		//
		// 一行歌词播放完毕后会立刻退出播放状态，但会继续保持高亮，直到下一行开始播放才熄灭
		// 这样多行重叠时先唱完的行会陪着后面的行一起亮，句间空隙内上一行也不会提前变暗
		// 空隙长到构成间奏、以及歌曲已经播完这两种没有下一行接续的情况，由 sync 统一清空

		// 清理不再播放的行
		for (const lastPlayingId of this.playingGroupsSet) {
			const bound = this.lyricBounds[lastPlayingId];
			if (!bound || time < bound.startTime || bound.endTime <= time) {
				this.playingGroupsSet.delete(lastPlayingId);
				this.removedPlayingIds.push(lastPlayingId);
			}
		}

		// 顺序查找并激活新的播放中的行
		// 从 playbackCursor 开始往下找，跳过已经唱完的歌词，提高性能
		let cursor = Math.max(0, this.playbackCursor);
		const len = this.lyricBounds.length;

		while (cursor < len) {
			const bound = this.lyricBounds[cursor];
			if (bound.startTime > time) {
				break; // 已经排序过
			}

			if (
				bound.startTime <= time &&
				bound.endTime > time &&
				!this.playingGroupsSet.has(cursor)
			) {
				this.playingGroupsSet.add(cursor);
				this.addedPlayingIds.push(cursor);
			}
			cursor++;
		}

		// 更新 this.playbackCursor 指针
		this.playbackCursor = cursor;

		// 找出那些已经唱完但仍处于高亮状态的歌词行
		// 它们会保持高亮，直到有新歌词开始播放才被一起熄灭
		this.expiredHighlightedIds.length = 0;
		for (const id of this.highlightedGroupsSet) {
			if (!this.playingGroupsSet.has(id)) {
				this.expiredHighlightedIds.push(id);
			}
		}

		const addedPlayingCount = this.addedPlayingIds.length;
		const expiredCount = this.expiredHighlightedIds.length;

		// 只要有新歌词开始播放，将其存入 highlightedGroupsSet，并向 addedHighlightedIds 压入 Diff
		// UI 将会启用这些歌词
		for (let i = 0; i < addedPlayingCount; i++) {
			const id = this.addedPlayingIds[i];
			this.highlightedGroupsSet.add(id);
			this.addedHighlightedIds.push(id);
		}

		// 清理旧高亮的唯一条件是「有新歌词进入播放状态」
		//
		// 注意 expiredCount > 0 不作为清理条件，一行歌词唱完时若没有新行接续，
		// 它会继续保持高亮，这样多行高亮时先唱完的行和句间空隙的上一行不会失去可读性
		if (addedPlayingCount > 0) {
			for (let i = 0; i < expiredCount; i++) {
				const id = this.expiredHighlightedIds[i];
				this.highlightedGroupsSet.delete(id);
				this.removedHighlightedIds.push(id);
			}

			let minHighlighted = Number.POSITIVE_INFINITY;
			for (const id of this.highlightedGroupsSet) {
				if (id < minHighlighted) minHighlighted = id;
			}

			// 只在歌词更替时更新，以便在播放完毕后保持聚焦在这一组歌词
			this.snapshot.scrollToIndex = minHighlighted;
		}
	}

	/**
	 * 处理 Seek 时的时间线推导
	 *
	 * 直接按目标时间重建播放与高亮行集合，结果与正常播放到该时刻时一致
	 *
	 * @param time 跳转到的时间
	 * @param dropLingeringWhenIdle 在没有任何行正在播放时，是否丢弃那些已经唱完、
	 * 但在正常播放中仍会保持高亮的行，用于在间奏和播放完时清空高亮行
	 */
	private performSeek(time: MediaTime, dropLingeringWhenIdle: boolean): void {
		const nextPlaying = this.nextPlayingSet;
		const nextHighlighted = this.nextHighlightedSet;
		nextPlaying.clear();
		nextHighlighted.clear();

		// 二分法找出第一个开始时间晚于目标时间的歌词行，排除所有尚未开始唱的歌词
		let left = 0;
		let right = this.lyricBounds.length - 1;
		let firstGreater = this.lyricBounds.length;

		while (left <= right) {
			const mid = (left + right) >> 1;
			if (this.lyricBounds[mid].startTime > time) {
				firstGreater = mid;
				right = mid - 1;
			} else {
				left = mid + 1;
			}
		}

		// 往前找到最后一个真正开始播放过的歌词行作为锚点
		let anchorIndex = -1;
		for (let i = firstGreater - 1; i >= 0; i--) {
			const bound = this.lyricBounds[i];
			// 有意跳过时长为 0 的歌词行
			if (bound.endTime > bound.startTime) {
				anchorIndex = i;
				break;
			}
		}

		if (anchorIndex === -1) {
			// 目标时间在第一行歌词开始之前，或此前所有已开始的行都是零时长
			// 正常播放时尚未有任何歌词行进入播放状态，scrollToIndex 保持为 0
			this.playbackCursor = firstGreater;
			this.snapshot.scrollToIndex = 0;
			this.commitSeekDiff();
			return;
		}

		// 还原「歌词唱完不熄灭，直到下一句开始才更替」的状态
		// 锚点之后的歌词行要么开始时间晚于目标时间、要么时长为零，都不可能命中，无需遍历
		const anchorStart = this.lyricBounds[anchorIndex].startTime;
		let minPlaying = -1;
		let minHighlighted = -1;

		for (let i = anchorIndex; i >= 0; i--) {
			const bound = this.lyricBounds[i];

			// 锚点时刻尚未唱完的行，在正常播放中会一直亮到下一行开始
			// 正在播放的行必然满足此条件，因为其结束时间晚于目标时间，而目标时间不早于锚点
			if (bound.endTime <= anchorStart) continue;

			if (bound.startTime <= time && bound.endTime > time) {
				nextPlaying.add(i);
				minPlaying = i;
			}

			nextHighlighted.add(i);
			minHighlighted = i;
		}

		// 间奏与曲末清空高亮行，如果没有行在播放的话
		if (dropLingeringWhenIdle && nextPlaying.size === 0) {
			nextHighlighted.clear();
		}

		this.playbackCursor = minPlaying === -1 ? firstGreater : minPlaying;
		this.snapshot.scrollToIndex = minHighlighted;

		this.commitSeekDiff();
	}

	/**
	 * 把 Seek 重建出的目标集合与上一帧的集合求对称差，输出发生变化的部分
	 */
	private commitSeekDiff(): void {
		for (const id of this.playingGroupsSet) {
			if (!this.nextPlayingSet.has(id)) {
				this.playingGroupsSet.delete(id);
				this.removedPlayingIds.push(id);
			}
		}
		for (const id of this.nextPlayingSet) {
			if (!this.playingGroupsSet.has(id)) {
				this.playingGroupsSet.add(id);
				this.addedPlayingIds.push(id);
			}
		}

		for (const id of this.highlightedGroupsSet) {
			if (!this.nextHighlightedSet.has(id)) {
				this.highlightedGroupsSet.delete(id);
				this.removedHighlightedIds.push(id);
			}
		}
		for (const id of this.nextHighlightedSet) {
			if (!this.highlightedGroupsSet.has(id)) {
				this.highlightedGroupsSet.add(id);
				this.addedHighlightedIds.push(id);
			}
		}
	}

	/**
	 * 立即熄灭当前全部高亮歌词行
	 *
	 * 用于间奏与曲末这两个没有下一行接续、但必须清空高亮的场景
	 */
	private flushAllHighlighted(): void {
		if (this.highlightedGroupsSet.size === 0) return;

		for (const id of this.highlightedGroupsSet) {
			this.removedHighlightedIds.push(id);
		}
		this.highlightedGroupsSet.clear();
	}
	//#endregion

	//#region 间奏计算
	/**
	 * 预计算全部间奏区间
	 * @param bounds 按 `startTime` 升序排列的歌词时间边界
	 * @returns 按时间升序排列、互不重叠的间奏区间，供二分查找与游标推进使用
	 */
	private calculateInterludes(
		bounds: readonly TimeBounds[],
	): PlayerInterlude[] {
		const interludes: PlayerInterlude[] = [];

		// 已扫描过的歌词行中最晚的结束时间
		let maxEnd = MediaTime.ZERO;

		// 歌词行只保证按 `startTime` 升序，前一行的 `endTime` 并不等于此前
		// 所有行的最晚结束时间 (例如多行高亮的情况)
		//
		// 所以这里按前缀最大结束时间做一次区间并集扫描，保证产出的区间与
		// 任何歌词行都不重叠
		for (let i = -1; i < bounds.length - 1; i++) {
			if (i >= 0) {
				maxEnd = MediaTime.max(maxEnd, bounds[i].endTime);
			}

			const gapEnd = MediaTime.max(maxEnd, bounds[i + 1].startTime);

			if (MediaTime.since(gapEnd, maxEnd) >= MIN_INTERLUDE_GAP) {
				interludes.push({
					startTime: maxEnd,
					endTime: gapEnd,
					anchorLineIndex: i,
				});
			}
		}

		return interludes;
	}

	/**
	 * 查找当前时间命中的间奏区间，并顺带推进或重定位间奏游标
	 * @param time 当前播放时间
	 * @param isSeek 当前帧是否为跳转
	 * @returns 命中的间奏区间，未命中时为 undefined
	 */
	private resolveActiveInterlude(
		time: MediaTime,
		isSeek: boolean,
	): PlayerInterlude | undefined {
		if (this.precalculatedInterludes.length === 0) return undefined;

		if (isSeek) {
			let cursor = this.precalculatedInterludes.length;
			let left = 0;
			let right = this.precalculatedInterludes.length - 1;

			while (left <= right) {
				const mid = (left + right) >> 1;
				const inter = this.precalculatedInterludes[mid];

				if (inter.endTime > time) {
					cursor = mid;
					right = mid - 1;
				} else {
					left = mid + 1;
				}
			}

			this.interludeCursor = cursor;

			if (cursor < this.precalculatedInterludes.length) {
				const inter = this.precalculatedInterludes[cursor];
				if (time >= inter.startTime && time < inter.endTime) {
					return inter;
				}
			}

			return undefined;
		}

		while (this.interludeCursor < this.precalculatedInterludes.length) {
			const inter = this.precalculatedInterludes[this.interludeCursor];
			if (time >= inter.startTime && time < inter.endTime) {
				return inter;
			}
			if (time >= inter.endTime) {
				this.interludeCursor++;
			} else {
				break;
			}
		}

		return undefined;
	}

	/**
	 * 根据间奏命中情况和当前高亮状态推导是否应当聚焦间奏点
	 *
	 * 处于间奏区域且没有任何歌词高亮时聚焦间奏点，否则交还给歌词行
	 *
	 * @param activeInterlude 当前命中的间奏区间
	 */
	private updateInterludeFocus(activeInterlude?: PlayerInterlude): void {
		this.snapshot.isFocusOnInterlude =
			!!activeInterlude && this.highlightedGroupsSet.size === 0;
	}
	//#endregion

	//#region 重置
	/**
	 * 清空全部推导状态，回到时间原点
	 */
	private reset(): void {
		this.playbackCursor = 0;
		this.interludeCursor = 0;

		this.playingGroupsSet.clear();
		this.highlightedGroupsSet.clear();
		this.nextPlayingSet.clear();
		this.nextHighlightedSet.clear();

		this.snapshot.currentTime = MediaTime.ZERO;
		this.snapshot.scrollToIndex = 0;
		this.snapshot.latestHighlightedIndex = undefined;
		this.snapshot.isEndOfSong = false;
		this.snapshot.activeInterlude = undefined;
		this.snapshot.isFocusOnInterlude = false;
	}
	//#endregion
}
