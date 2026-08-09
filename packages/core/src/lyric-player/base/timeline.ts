//#region 类型定义
/**
 * 用于进度计算的最小歌词数据
 */
export interface TimeBounds {
	readonly startTime: number;
	readonly endTime: number;
}

/**
 * 当前命中的间奏区间信息
 */
export interface PlayerInterlude {
	readonly startTime: number;
	readonly endTime: number;
	/**
	 * 间奏点应插入的位置基准
	 *
	 * 即间奏前最后一句歌词的索引，-1 表示第一句之前
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
	readonly currentTime: number;

	/**
	 * 标识当前帧是否处于跳转状态
	 *
	 * 例如跳转期间使用更缓慢的弹簧参数 (参见 `spring.ts`)，并关闭各个歌词行的延时递增动画
	 */
	readonly isSeeking: boolean;

	/**
	 * 当前进度命中的、正在播放的歌词组
	 */
	readonly playingGroups: ReadonlySet<number>;

	/**
	 * 当前进度命中的、正在高亮的歌词组
	 *
	 * 高亮的歌词组可能会多于正在播放的，一般用于多行高亮时、保留上一行播放完毕的歌词的高亮状态
	 */
	readonly highlightedGroups: ReadonlySet<number>;

	/**
	 * 自动滚动应该对齐到哪一行歌词
	 */
	readonly scrollToIndex: number;

	/**
	 * 处于高亮状态的歌词行中，最靠后的一行
	 *
	 * 例如，如果当前有高亮行索引 `[1, 2, 3]`，则 `latesthighlightedIndex` 为 `3`
	 *
	 * 如果当前没有任何高亮行，如两行歌词之间的间隙，被置为 undefined
	 */
	readonly latestHighlightedIndex?: number;

	/**
	 * 标识当前是否有任何高亮中的歌词组
	 */
	readonly isTimelineEmpty: boolean;

	/**
	 * 标识歌曲是否播放完毕
	 *
	 * 一般用于展示底栏
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
	 * 当前帧是否有任何实质性的状态变更，如播放行更替、高亮行新增/移除、间奏状态切换、焦点切换，或处于 Seek 状态中
	 *
	 * UI 层接收到 diff 后，检查此标志即可直接跳过后续所有的布局计算
	 */
	readonly hasChanged: boolean;

	/**
	 * 在当前时间进度下，最新被命中的、正在播放的歌词索引列表
	 *
	 * 用于通知 UI 哪些歌词行开始播放了了
	 */
	readonly addedPlaying: ReadonlyArray<number>;

	/**
	 * 在当前时间进度下，刚刚脱离正在播放状态的歌词索引列表，即上一帧还在播放、但本帧时间已超过其 endTime 的歌词行
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
	 * 标识时间轴是否发生了非连续的跳跃，会在时间轴倒退和 Seek 状态下为 true
	 *
	 * 用于通知 UI 层在非触摸状态下重置滚动坐标系
	 */
	readonly isTimeJumped: boolean;
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
	private lyricBounds: TimeBounds[] = [];
	/**
	 * 外部显式传入的持续性 Seek 状态（例如正在拖拽进度条）
	 */
	private isManualSeeking = false;

	/**
	 * 预先计算的间奏区域
	 */
	private precalculatedInterludes: PlayerInterlude[] = [];

	/**
	 * 保存上次检索到的正在播放歌词的位置，用于避免每次都从头遍历所有歌词，提高性能
	 */
	private playbackCursor = 0;
	private interludeCursor = 0;
	private isFocusOnInterludeState = false;

	private playingGroupsSet: Set<number> = new Set();
	private highlightedGroupsSet: Set<number> = new Set();

	private addedPlayingIds: number[] = [];
	private removedPlayingIds: number[] = [];
	private addedHighlightedIds: number[] = [];
	private removedHighlightedIds: number[] = [];
	private expiredHighlightedIds: number[] = [];

	private readonly snapshot: Mutable<TimelineSnapshot> = {
		currentTime: 0,
		isSeeking: false,
		playingGroups: this.playingGroupsSet,
		highlightedGroups: this.highlightedGroupsSet,
		scrollToIndex: 0,
		latestHighlightedIndex: undefined,
		isTimelineEmpty: true,
		isEndOfSong: false,
		activeInterlude: undefined,
		isFocusOnInterlude: false,
	};

	private readonly diff: Mutable<TimelineDiff> = {
		hasChanged: false,
		addedPlaying: this.addedPlayingIds,
		removedPlaying: this.removedPlayingIds,
		addedHighlighted: this.addedHighlightedIds,
		removedHighlighted: this.removedHighlightedIds,
		isInterludeChanged: false,
		isScrollToChanged: false,
		isTimeJumped: false,
	};
	//#endregion

	//#region 外部 API
	/**
	 * 提前设置好歌词的时间数据，内部会根据此数据来进行时间线推导，同时预计算间奏区间
	 */
	public setTimeBounds(bounds: TimeBounds[]): void {
		this.lyricBounds = bounds;
		this.precalculatedInterludes = this.calculateInterludes(bounds);

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

	public sync(time: number, forceSeek = false): TimelineDiff {
		this.addedPlayingIds.length = 0;
		this.removedPlayingIds.length = 0;
		this.addedHighlightedIds.length = 0;
		this.removedHighlightedIds.length = 0;
		this.expiredHighlightedIds.length = 0;

		const prevInterlude = this.snapshot.activeInterlude;
		const prevFocusOnInterlude = this.snapshot.isFocusOnInterlude;
		const prevScrollToIndex = this.snapshot.scrollToIndex;

		// 将时间倒退视为 seek 是为了避免 performPlayback 顺序查找时失效
		// performPlayback 会保存上次找到的最小的播放行的索引，下次从该索引查找以提高性能
		// 若时间倒退，将会导致倒退到的那行直到 playbackCursor 之间都无法高亮
		const isTimeRegression = time < this.snapshot.currentTime;
		const isJump = forceSeek || isTimeRegression;

		this.snapshot.isSeeking = this.isManualSeeking || isJump;
		if (this.snapshot.isSeeking) {
			this.performSeek(time);
		} else {
			this.performPlayback(time);
		}

		this.updateInterludeState(time, isJump);

		const isInterludeChanged = prevInterlude !== this.snapshot.activeInterlude;
		const isFocusChanged =
			prevFocusOnInterlude !== this.snapshot.isFocusOnInterlude;
		const isScrollToChanged = prevScrollToIndex !== this.snapshot.scrollToIndex;

		const hasChanged =
			isJump ||
			this.addedPlayingIds.length > 0 ||
			this.removedPlayingIds.length > 0 ||
			this.addedHighlightedIds.length > 0 ||
			this.removedHighlightedIds.length > 0 ||
			isInterludeChanged ||
			isFocusChanged ||
			isScrollToChanged;

		this.snapshot.currentTime = time;
		this.snapshot.isTimelineEmpty = this.highlightedGroupsSet.size === 0;

		if (this.highlightedGroupsSet.size > 0) {
			let maxIndex = -1;
			for (const id of this.highlightedGroupsSet) {
				if (id > maxIndex) maxIndex = id;
			}
			this.snapshot.latestHighlightedIndex = maxIndex;
		} else {
			this.snapshot.latestHighlightedIndex = undefined;
		}

		// 判断歌曲是否播放完毕，UI 会根据此标志决定是否聚焦到底栏
		this.snapshot.isEndOfSong = false;
		if (this.highlightedGroupsSet.size === 0 && this.lyricBounds.length > 0) {
			const lastLine = this.lyricBounds[this.lyricBounds.length - 1];
			if (time >= lastLine.endTime) {
				this.snapshot.isEndOfSong = true;
			}
		}

		this.diff.hasChanged = hasChanged;
		this.diff.isInterludeChanged = isInterludeChanged;
		this.diff.isScrollToChanged = isScrollToChanged;
		this.diff.isTimeJumped = isJump;

		return this.diff;
	}

	public setSeekingState(isSeeking: boolean): void {
		this.isManualSeeking = isSeeking;
		this.snapshot.isSeeking = isSeeking;
	}
	//#endregion

	//#region 时间线推导
	/**
	 * 处理正常播放时的时间线推导
	 */
	private performPlayback(time: number): void {
		// 我在这里定义了歌词的不同状态：
		// 播放行：只要当前时间落在 [startTime, endTime) 内，就是在播放行，播放行是高亮行的真子集
		// 高亮行：UI 层真正看到的高亮状态
		//
		// 一行歌词播放完毕后，会立刻退出播放状态，但可以继续高亮，用于多行高亮时保留播放完的歌词继续高亮，
		// 直到所有高亮行全部播放完毕后全部退出高亮

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
		if (this.playingGroupsSet.size > 0) {
			let minPlaying = Number.POSITIVE_INFINITY;
			for (const id of this.playingGroupsSet) {
				if (id < minPlaying) minPlaying = id;
			}
			this.playbackCursor = minPlaying;
		} else {
			this.playbackCursor = cursor;
		}

		// 找出那些已经唱完但仍处于高亮状态的歌词行
		// 稍后会结合下一行的开启来决定什么时候熄灭高亮
		this.expiredHighlightedIds.length = 0;
		for (const id of this.highlightedGroupsSet) {
			if (!this.playingGroupsSet.has(id)) {
				this.expiredHighlightedIds.push(id);
			}
		}

		// 只要有新歌词开始播放，将其存入 highlightedGroupsSet，并向 addedHighlightedIds 压入 Diff
		// UI 将会启用这些歌词
		const addedPlayingCount = this.addedPlayingIds.length;
		const expiredCount = this.expiredHighlightedIds.length;

		if (addedPlayingCount > 0) {
			for (let i = 0; i < addedPlayingCount; i++) {
				const id = this.addedPlayingIds[i];
				this.highlightedGroupsSet.add(id);
				this.addedHighlightedIds.push(id);
			}
		}

		// 定义两个应该清理旧高亮歌词的充分条件，满足其一即可：
		// 1. 有新歌词进入播放状态
		// 2. 当前处于高亮状态的歌词全部播放完了
		//
		// 注意，expiredCount > 0 不作为清理条件，这是为了在多行高亮时，让播放完毕的行保持高亮状态
		const shouldTransitionToNext = addedPlayingCount > 0;

		const isCurrentGroupAllFinished =
			expiredCount > 0 && expiredCount === this.highlightedGroupsSet.size;

		const shouldFlushExpiredLines =
			shouldTransitionToNext || isCurrentGroupAllFinished;

		if (shouldFlushExpiredLines && expiredCount > 0) {
			for (let i = 0; i < expiredCount; i++) {
				const id = this.expiredHighlightedIds[i];
				this.highlightedGroupsSet.delete(id);
				this.removedHighlightedIds.push(id);
			}
		}

		// 不更新 scrollToIndex，以便在播放完毕后保持聚焦在这行歌词
		if (
			(addedPlayingCount > 0 || shouldFlushExpiredLines) &&
			this.highlightedGroupsSet.size > 0
		) {
			let minHighlighted = Number.POSITIVE_INFINITY;
			for (const id of this.highlightedGroupsSet) {
				if (id < minHighlighted) minHighlighted = id;
			}
			this.snapshot.scrollToIndex = minHighlighted;
		}
	}

	/**
	 * 处理 Seek 时的时间线推导
	 *
	 * 将会丢弃所有高亮状态的行，直接根据当前时间重新计算播放状态的行
	 */
	private performSeek(time: number): void {
		for (const id of this.playingGroupsSet) {
			this.removedPlayingIds.push(id);
		}
		for (const id of this.highlightedGroupsSet) {
			this.removedHighlightedIds.push(id);
		}

		this.playingGroupsSet.clear();
		this.highlightedGroupsSet.clear();

		let left = 0;
		let right = this.lyricBounds.length - 1;
		let firstGreaterOrEqual = this.lyricBounds.length;

		while (left <= right) {
			const mid = (left + right) >> 1;
			if (this.lyricBounds[mid].startTime >= time) {
				firstGreaterOrEqual = mid;
				right = mid - 1;
			} else {
				left = mid + 1;
			}
		}

		let minPlayingIndex = Number.POSITIVE_INFINITY;
		const startIndex = Math.min(
			firstGreaterOrEqual,
			this.lyricBounds.length - 1,
		);

		for (let i = startIndex; i >= 0; i--) {
			const bound = this.lyricBounds[i];
			if (bound && bound.startTime <= time && bound.endTime > time) {
				this.playingGroupsSet.add(i);
				this.highlightedGroupsSet.add(i);
				this.addedPlayingIds.push(i);
				this.addedHighlightedIds.push(i);
				if (i < minPlayingIndex) minPlayingIndex = i;
			}
		}

		if (this.highlightedGroupsSet.size > 0) {
			// 聚焦到命中的第一行歌词
			this.snapshot.scrollToIndex = minPlayingIndex;
			this.playbackCursor = minPlayingIndex;
		} else {
			// 如果跳转到了两行歌词间隔里 (不是间奏)，聚焦到即将播放的下一行歌词
			this.snapshot.scrollToIndex = firstGreaterOrEqual;
			this.playbackCursor = firstGreaterOrEqual;
		}
	}
	//#endregion

	//#region 间奏计算
	private calculateInterludes(bounds: TimeBounds[]): PlayerInterlude[] {
		const interludes: PlayerInterlude[] = [];

		for (let i = -1; i < bounds.length - 1; i++) {
			const prevGroup = i === -1 ? null : bounds[i];
			const nextGroup = bounds[i + 1];

			const gapStart = prevGroup ? prevGroup.endTime : 0;
			const gapEnd = Math.max(gapStart, nextGroup.startTime);

			if (gapEnd - gapStart >= 4000) {
				interludes.push({
					startTime: gapStart,
					endTime: gapEnd,
					anchorLineIndex: i,
				});
			}
		}

		return interludes;
	}

	private updateInterludeState(time: number, isSeek: boolean): void {
		let activeInterlude: PlayerInterlude | undefined;

		if (this.precalculatedInterludes.length > 0) {
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
						activeInterlude = inter;
					}
				}
			} else {
				while (this.interludeCursor < this.precalculatedInterludes.length) {
					const inter = this.precalculatedInterludes[this.interludeCursor];
					if (time >= inter.startTime && time < inter.endTime) {
						activeInterlude = inter;
						break;
					} else if (time >= inter.endTime) {
						this.interludeCursor++;
					} else {
						break;
					}
				}
			}
		}

		this.snapshot.activeInterlude = activeInterlude;

		if (activeInterlude && this.highlightedGroupsSet.size === 0) {
			// 处于间奏区域且未高亮任何歌词时，聚焦在间奏区域
			this.isFocusOnInterludeState = true;
		} else if (this.highlightedGroupsSet.size > 0 || !activeInterlude) {
			// 有新歌词高亮或离开间奏区域时，解除聚焦
			this.isFocusOnInterludeState = false;
		}

		this.snapshot.isFocusOnInterlude = this.isFocusOnInterludeState;
	}
	//#endregion

	//#region 重置
	private reset(): void {
		this.playbackCursor = 0;
		this.interludeCursor = 0;
		this.isFocusOnInterludeState = false;

		this.playingGroupsSet.clear();
		this.highlightedGroupsSet.clear();

		this.snapshot.currentTime = 0;
		this.snapshot.isSeeking = false;
		this.snapshot.scrollToIndex = 0;
		this.snapshot.latestHighlightedIndex = undefined;
		this.snapshot.isTimelineEmpty = true;
		this.snapshot.isEndOfSong = false;
		this.snapshot.activeInterlude = undefined;
		this.snapshot.isFocusOnInterlude = false;
	}
	//#endregion
}
