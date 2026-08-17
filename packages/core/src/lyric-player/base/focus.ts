import type { FocalTarget } from "./layout.ts";
import type { TimelineSnapshot } from "./timeline.ts";

/**
 * 焦点推导所依赖的播放器交互状态
 */
export interface FocusResolveFlags {
	/**
	 * 是否处于用户滚动过，尚未回归自动对齐的状态
	 */
	isAutoAlignSuspended: boolean;

	/**
	 * 底栏当前是否有内容
	 */
	hasBottomContent: boolean;
}

/**
 * 对齐焦点状态机
 *
 * 持有跨帧的冻结对齐目标，并在每一帧根据时间线快照与交互状态推导出本帧排版应当对齐的焦点
 *
 * @remarks
 * 规则为：
 * - 用户滚动挂起期间冻结上一帧的焦点，不再跟随播放进度
 * - 若冻结在间奏点上而间奏已经结束，则自动前移至间奏后的第一行歌词
 * - 未挂起时跟随播放状态：间奏中对齐间奏点，曲末对齐底栏或末行，其余对齐 `scrollToIndex`
 * - 任何情况下产出的歌词行索引都被钳制在 `[0, lineCount - 1]` 内
 */
export class FocusController {
	private target: FocalTarget = { type: "line", index: 0 };

	/**
	 * 推导本帧的对齐焦点，并将其记录为新的冻结目标
	 * @param snapshot 当前帧的时间线快照
	 * @param lineCount 当前歌词行总数
	 * @param flags 播放器的交互状态
	 */
	public resolve(
		snapshot: TimelineSnapshot,
		lineCount: number,
		flags: FocusResolveFlags,
	): FocalTarget {
		const nextTarget = flags.isAutoAlignSuspended
			? this.resolveSuspendedTarget(snapshot, lineCount)
			: this.resolveActiveTarget(snapshot, lineCount, flags.hasBottomContent);

		this.target = nextTarget;
		return nextTarget;
	}

	/**
	 * 用户滚动挂起期间的焦点解析（维持上一帧目标或在间奏结束时顺延）
	 */
	private resolveSuspendedTarget(
		snapshot: TimelineSnapshot,
		lineCount: number,
	): FocalTarget {
		const target = this.target;

		switch (target.type) {
			case "line":
				return {
					type: "line",
					index: this.clampLineIndex(target.index, lineCount),
				};

			case "interlude": {
				const isInterludeActive =
					snapshot.isFocusOnInterlude && !!snapshot.activeInterlude;

				// 离开间奏区间时，将冻结目标移动至间奏后的下一行歌词
				if (!isInterludeActive) {
					return {
						type: "line",
						index: this.clampLineIndex(target.anchorIndex + 1, lineCount),
					};
				}
				return target;
			}

			case "bottom":
				return target;
		}
	}

	/**
	 * 正常播放状态下的自动焦点解析
	 */
	private resolveActiveTarget(
		snapshot: TimelineSnapshot,
		lineCount: number,
		hasBottomContent: boolean,
	): FocalTarget {
		// 处于间奏区间且需聚焦间奏点时对焦到间奏点
		if (snapshot.isFocusOnInterlude && snapshot.activeInterlude) {
			return {
				type: "interlude",
				anchorIndex: snapshot.activeInterlude.anchorLineIndex,
			};
		}

		// 播放完了，如果有底栏则对齐底栏，没有则对齐最后一行歌词
		if (snapshot.isEndOfSong) {
			if (hasBottomContent) {
				return { type: "bottom" };
			}
			return {
				type: "line",
				index: this.clampLineIndex(lineCount - 1, lineCount),
			};
		}

		// 常规播放跟随
		return {
			type: "line",
			index: this.clampLineIndex(snapshot.scrollToIndex, lineCount),
		};
	}

	/**
	 * 将歌词行索引钳制到当前歌词范围内
	 */
	private clampLineIndex(index: number, lineCount: number): number {
		if (lineCount <= 0) return 0;
		return Math.min(Math.max(0, index), lineCount - 1);
	}

	/**
	 * 重置焦点至首行
	 *
	 * 一般在载入新歌词、重建歌词视图时调用
	 */
	public reset(): void {
		this.target = { type: "line", index: 0 };
	}
}
