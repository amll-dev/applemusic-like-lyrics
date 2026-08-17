import { describe, expect, it } from "vitest";
import { FocusController } from "#lyric/base/focus.ts";
import type {
	PlayerInterlude,
	TimelineSnapshot,
} from "#lyric/base/timeline.ts";
import { MediaTime } from "#utils/time.ts";

function makeSnapshot(over: Partial<TimelineSnapshot> = {}): TimelineSnapshot {
	return {
		currentTime: MediaTime.ZERO,
		isSeeking: false,
		playingGroups: new Set(),
		highlightedGroups: new Set(),
		scrollToIndex: 0,
		isTimelineEmpty: false,
		isEndOfSong: false,
		isFocusOnInterlude: false,
		...over,
	};
}

function makeInterlude(anchorLineIndex: number): PlayerInterlude {
	return {
		startTime: MediaTime.ZERO,
		endTime: MediaTime.ZERO,
		anchorLineIndex,
	};
}

/** 自动跟随，未被用户滚动挂起 */
const FOLLOWING = { isAutoAlignSuspended: false, hasBottomContent: false };
/** 自动跟随，且底栏有内容 */
const FOLLOWING_WITH_BOTTOM = {
	isAutoAlignSuspended: false,
	hasBottomContent: true,
};
/** 用户滚动挂起中 */
const SUSPENDED = { isAutoAlignSuspended: true, hasBottomContent: false };

describe("FocusController", () => {
	describe("auto-align", () => {
		it("aligns with scrollToIndex", () => {
			const focus = new FocusController();
			const snapshot = makeSnapshot({ scrollToIndex: 3 });

			expect(focus.resolve(snapshot, 10, FOLLOWING)).toEqual({
				type: "line",
				index: 3,
			});
		});

		it("clamps out-of-bounds index within lyric line bounds", () => {
			const focus = new FocusController();

			const overflow = focus.resolve(
				makeSnapshot({ scrollToIndex: 99 }),
				10,
				FOLLOWING,
			);
			expect(overflow).toEqual({ type: "line", index: 9 });

			const underflow = focus.resolve(
				makeSnapshot({ scrollToIndex: -5 }),
				10,
				FOLLOWING,
			);
			expect(underflow).toEqual({ type: "line", index: 0 });
		});

		it("falls back to the first line when there are no lyric lines", () => {
			const focus = new FocusController();
			const snapshot = makeSnapshot({ scrollToIndex: 3 });

			expect(focus.resolve(snapshot, 0, FOLLOWING)).toEqual({
				type: "line",
				index: 0,
			});
		});

		it("aligns to interlude when inside active interlude range", () => {
			const focus = new FocusController();
			const snapshot = makeSnapshot({
				scrollToIndex: 5,
				activeInterlude: makeInterlude(4),
				isFocusOnInterlude: true,
			});

			expect(focus.resolve(snapshot, 10, FOLLOWING)).toEqual({
				type: "interlude",
				anchorIndex: 4,
			});
		});

		it("aligns to line when hitting interlude but focus is not on interlude", () => {
			const focus = new FocusController();
			const snapshot = makeSnapshot({
				scrollToIndex: 5,
				activeInterlude: makeInterlude(4),
				isFocusOnInterlude: false,
			});

			expect(focus.resolve(snapshot, 10, FOLLOWING)).toEqual({
				type: "line",
				index: 5,
			});
		});

		it("aligns to bottom line at the end of song if present", () => {
			const focus = new FocusController();
			const snapshot = makeSnapshot({ isEndOfSong: true });

			expect(focus.resolve(snapshot, 10, FOLLOWING_WITH_BOTTOM)).toEqual({
				type: "bottom",
			});
		});

		it("aligns to the last line at the end of song when there is no bottom line", () => {
			const focus = new FocusController();
			const snapshot = makeSnapshot({ isEndOfSong: true });

			expect(focus.resolve(snapshot, 10, FOLLOWING)).toEqual({
				type: "line",
				index: 9,
			});
		});
	});

	describe("user scroll suspended", () => {
		it("freezes focus and stops following scrollToIndex", () => {
			const focus = new FocusController();

			focus.resolve(makeSnapshot({ scrollToIndex: 3 }), 10, FOLLOWING);

			const next = focus.resolve(
				makeSnapshot({ scrollToIndex: 4 }),
				10,
				SUSPENDED,
			);
			expect(next).toEqual({ type: "line", index: 3 });

			const later = focus.resolve(
				makeSnapshot({ scrollToIndex: 7 }),
				10,
				SUSPENDED,
			);
			expect(later).toEqual({ type: "line", index: 3 });
		});

		it("maintains bottom focus when frozen at bottom", () => {
			const focus = new FocusController();

			focus.resolve(
				makeSnapshot({ isEndOfSong: true }),
				10,
				FOLLOWING_WITH_BOTTOM,
			);

			const frozen = focus.resolve(
				makeSnapshot({ scrollToIndex: 2 }),
				10,
				SUSPENDED,
			);
			expect(frozen).toEqual({ type: "bottom" });
		});

		it("clamps frozen index within bounds when line count decreases", () => {
			const focus = new FocusController();

			focus.resolve(makeSnapshot({ scrollToIndex: 9 }), 10, FOLLOWING);

			const clamped = focus.resolve(
				makeSnapshot({ scrollToIndex: 9 }),
				3,
				SUSPENDED,
			);
			expect(clamped).toEqual({ type: "line", index: 2 });
		});

		it("maintains interlude focus when frozen on interlude and it is still active", () => {
			const focus = new FocusController();
			const activeInterlude = makeInterlude(4);

			focus.resolve(
				makeSnapshot({ activeInterlude, isFocusOnInterlude: true }),
				10,
				FOLLOWING,
			);

			const frozen = focus.resolve(
				makeSnapshot({
					scrollToIndex: 5,
					activeInterlude,
					isFocusOnInterlude: true,
				}),
				10,
				SUSPENDED,
			);
			expect(frozen).toEqual({ type: "interlude", anchorIndex: 4 });
		});

		it("advances by one line when frozen interlude ends and remains stable", () => {
			const focus = new FocusController();

			focus.resolve(
				makeSnapshot({
					activeInterlude: makeInterlude(4),
					isFocusOnInterlude: true,
				}),
				10,
				FOLLOWING,
			);

			const promoted = focus.resolve(
				makeSnapshot({ scrollToIndex: 5 }),
				10,
				SUSPENDED,
			);
			expect(promoted).toEqual({ type: "line", index: 5 });

			const stable = focus.resolve(
				makeSnapshot({ scrollToIndex: 8 }),
				10,
				SUSPENDED,
			);
			expect(stable).toEqual({ type: "line", index: 5 });
		});

		it("clamps advanced index within lyric line bounds", () => {
			const focus = new FocusController();

			focus.resolve(
				makeSnapshot({
					activeInterlude: makeInterlude(8),
					isFocusOnInterlude: true,
				}),
				10,
				FOLLOWING,
			);

			const promoted = focus.resolve(
				makeSnapshot({ scrollToIndex: 8 }),
				9,
				SUSPENDED,
			);
			expect(promoted).toEqual({ type: "line", index: 8 });
		});
	});

	describe("reset", () => {
		it("resets frozen focus back to the first line", () => {
			const focus = new FocusController();

			focus.resolve(makeSnapshot({ scrollToIndex: 6 }), 10, FOLLOWING);
			focus.reset();

			const afterReset = focus.resolve(
				makeSnapshot({ scrollToIndex: 6 }),
				10,
				SUSPENDED,
			);
			expect(afterReset).toEqual({ type: "line", index: 0 });
		});
	});
});
