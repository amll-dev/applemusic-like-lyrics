import { describe, expect, it } from "vitest";
import type { TimeBounds } from "#lyric/base/timeline.ts";
import { TimelineController } from "#lyric/base/timeline.ts";
import { MediaTime } from "#utils/time.ts";

function bounds(...ranges: [number, number][]): TimeBounds[] {
	return ranges.map(([startTime, endTime]) => ({
		startTime: MediaTime.fromMillis(startTime),
		endTime: MediaTime.fromMillis(endTime),
	}));
}

function makeController(...ranges: [number, number][]): TimelineController {
	const controller = new TimelineController();
	controller.setTimeBounds(bounds(...ranges));
	return controller;
}

function tick(controller: TimelineController, ms: number, forceSeek = false) {
	return controller.sync(MediaTime.fromMillis(ms), forceSeek);
}

function highlighted(controller: TimelineController): number[] {
	return [...controller.getSnapshot().highlightedGroups].sort((a, b) => a - b);
}

function playing(controller: TimelineController): number[] {
	return [...controller.getSnapshot().playingGroups].sort((a, b) => a - b);
}

function millis(time: MediaTime | undefined): number | undefined {
	return time === undefined ? undefined : MediaTime.asMillis(time);
}

describe("TimelineController highlight lifecycle", () => {
	it("highlights lyrics when time is within range", () => {
		const c = makeController([0, 1000], [1000, 2000]);

		tick(c, 500);
		expect(highlighted(c)).toEqual([0]);
		expect(playing(c)).toEqual([0]);

		tick(c, 1000);
		expect(highlighted(c)).toEqual([1]);
		expect(playing(c)).toEqual([1]);
	});

	it("keeps finished line highlighted until next line starts", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 500);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 1000);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 2500);
		expect(highlighted(c)).toEqual([0]);

		const diff = tick(c, 3000);
		expect(highlighted(c)).toEqual([1]);
		expect([...diff.removedHighlighted]).toEqual([0]);
		expect([...diff.addedHighlighted]).toEqual([1]);
	});

	it("keeps focus on the last lit group during gaps without jumping ahead to next line", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 500);
		expect(c.getSnapshot().scrollToIndex).toBe(0);

		tick(c, 2500);
		expect(c.getSnapshot().scrollToIndex).toBe(0);

		tick(c, 3000);
		expect(c.getSnapshot().scrollToIndex).toBe(1);
	});

	it("retains finished overlapping lines until next line appears, extinguishing them together", () => {
		const c = makeController(
			[153305, 157180],
			[154743, 156466],
			[156154, 160218],
			[160268, 162974],
		);

		tick(c, 153305);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 154743);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 156154);
		expect(highlighted(c)).toEqual([0, 1, 2]);

		tick(c, 156466);
		expect(playing(c)).toEqual([0, 2]);
		expect(highlighted(c)).toEqual([0, 1, 2]);

		tick(c, 157180);
		expect(playing(c)).toEqual([2]);
		expect(highlighted(c)).toEqual([0, 1, 2]);

		tick(c, 160218);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0, 1, 2]);

		const diff = tick(c, 160268);
		expect(highlighted(c)).toEqual([3]);
		expect([...diff.removedHighlighted].sort((a, b) => a - b)).toEqual([
			0, 1, 2,
		]);
	});

	it("keeps overlapping lines highlighted until next line starts when subsequent line ends later", () => {
		const c = makeController([86358, 90910], [89693, 90968], [90978, 92366]);

		tick(c, 86358);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 89693);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 90910);
		expect(playing(c)).toEqual([1]);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 90968);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 90978);
		expect(highlighted(c)).toEqual([2]);
	});
});

describe("TimelineController interludes", () => {
	it("clears all highlights and focuses on interlude point when entering interlude range", () => {
		const c = makeController([0, 1000], [6000, 7000]);

		tick(c, 999);
		expect(highlighted(c)).toEqual([0]);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();

		const diff = tick(c, 1000);
		expect(highlighted(c)).toEqual([]);
		expect([...diff.removedHighlighted]).toEqual([0]);
		expect([...diff.addedHighlighted]).toEqual([]);

		const snapshot = c.getSnapshot();
		expect(snapshot.activeInterlude?.anchorLineIndex).toBe(0);
		expect(snapshot.isFocusOnInterlude).toBe(true);
		expect(snapshot.latestHighlightedIndex).toBeUndefined();
	});

	it("calculates interlude start time from the latest end time of all preceding lines", () => {
		const c = makeController([0, 10000], [1000, 2000], [15000, 16000]);

		tick(c, 1000);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 5000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(playing(c)).toEqual([0]);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);

		const diff = tick(c, 10000);
		const interlude = c.getSnapshot().activeInterlude;
		expect(interlude).toBeDefined();
		expect(millis(interlude?.startTime)).toBe(10000);
		expect(millis(interlude?.endTime)).toBe(15000);
		expect(interlude?.anchorLineIndex).toBe(1);
		expect(highlighted(c)).toEqual([]);
		expect([...diff.removedHighlighted].sort((a, b) => a - b)).toEqual([0, 1]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);

		tick(c, 15000);
		expect(highlighted(c)).toEqual([2]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);
	});

	it("does not produce interlude when overlapping lines fill the gap", () => {
		const c = makeController([0, 10000], [1000, 2000], [11000, 12000]);

		tick(c, 1500);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 3000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(playing(c)).toEqual([0]);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 10000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);

		tick(c, 11000);
		expect(highlighted(c)).toEqual([2]);
	});

	it("does not trigger interlude early when preceding enclosing line is still playing", () => {
		const c = makeController([0, 60000], [10000, 12000], [65000, 70000]);

		tick(c, 10000);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 30000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();

		tick(c, 59999);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();

		tick(c, 60000);
		const interlude = c.getSnapshot().activeInterlude;
		expect(millis(interlude?.startTime)).toBe(60000);
		expect(millis(interlude?.endTime)).toBe(65000);
		expect(interlude?.anchorLineIndex).toBe(1);
		expect(highlighted(c)).toEqual([]);
	});
});

describe("TimelineController end of song handling", () => {
	it("clears highlights and sets isEndOfSong when passing all lyrics", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 3500);
		expect(highlighted(c)).toEqual([1]);
		expect(c.getSnapshot().isEndOfSong).toBe(false);

		const diff = tick(c, 4000);
		expect(highlighted(c)).toEqual([]);
		expect([...diff.removedHighlighted]).toEqual([1]);
		expect(c.getSnapshot().isEndOfSong).toBe(true);
		expect(c.getSnapshot().latestHighlightedIndex).toBeUndefined();
	});

	it("determines end of song based on global latest end time for nested overlapping lines", () => {
		const c = makeController([5000, 20000], [6000, 7000]);

		tick(c, 6500);
		expect(highlighted(c)).toEqual([0, 1]);

		tick(c, 7000);
		expect(playing(c)).toEqual([0]);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().isEndOfSong).toBe(false);

		tick(c, 19999);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().isEndOfSong).toBe(false);

		tick(c, 20000);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isEndOfSong).toBe(true);
	});

	it("does not flag end of song when there are no lyrics", () => {
		const c = makeController();

		tick(c, 10000);
		expect(c.getSnapshot().isEndOfSong).toBe(false);
	});

	it("reports hasChanged on end-of-song transition frame even if no lines were ever highlighted", () => {
		const c = makeController([1000, 1000], [2000, 2000]);

		tick(c, 1000);
		expect(c.getSnapshot().isEndOfSong).toBe(false);

		const diff = tick(c, 2000);
		expect(c.getSnapshot().isEndOfSong).toBe(true);
		expect(diff.hasChanged).toBe(true);
	});
});

describe("TimelineController seek", () => {
	it("only highlights matched line when seeking into a lyric range", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 3500, true);
		expect(playing(c)).toEqual([1]);
		expect(highlighted(c)).toEqual([1]);
		expect(c.getSnapshot().scrollToIndex).toBe(1);
	});

	it("backfills previous line and focuses it when seeking into a normal gap", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 2000, true);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
		expect(c.getSnapshot().isEndOfSong).toBe(false);
	});

	it("backfills entire group of overlapping lyrics when seeking into a normal gap", () => {
		const c = makeController([0, 5000], [1000, 4500], [6000, 7000]);

		tick(c, 5500, true);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});

	it("matches normal playback result when backfilling highlight in a gap", () => {
		const ranges: [number, number][] = [
			[0, 5000],
			[1000, 4500],
			[6000, 7000],
		];

		const played = makeController(...ranges);
		tick(played, 1000);
		tick(played, 4500);
		tick(played, 5000);
		tick(played, 5500);

		const seeked = makeController(...ranges);
		tick(seeked, 5500, true);

		expect(highlighted(seeked)).toEqual(highlighted(played));
		expect(seeked.getSnapshot().scrollToIndex).toBe(
			played.getSnapshot().scrollToIndex,
		);
	});

	it("preserves finished lines from the same group when seeking into a still playing line", () => {
		const ranges: [number, number][] = [
			[0, 30000],
			[1000, 2000],
			[35000, 36000],
		];

		const played = makeController(...ranges);
		tick(played, 1000);
		tick(played, 2000);
		tick(played, 20000);
		expect(highlighted(played)).toEqual([0, 1]);

		const seeked = makeController(...ranges);
		tick(seeked, 20000, true);

		expect(highlighted(seeked)).toEqual([0, 1]);
		expect(playing(seeked)).toEqual([0]);
		expect(seeked.getSnapshot().scrollToIndex).toBe(
			played.getSnapshot().scrollToIndex,
		);
	});

	it("does not backfill zero-duration lyric lines", () => {
		const ranges: [number, number][] = [
			[10000, 12000],
			[12000, 12000],
			[15000, 16000],
		];

		const played = makeController(...ranges);
		tick(played, 10000);
		tick(played, 13000);
		expect(highlighted(played)).toEqual([0]);

		const seeked = makeController(...ranges);
		tick(seeked, 13000, true);
		expect(highlighted(seeked)).toEqual([0]);
	});

	it("matches all lines sharing the same start time when seeking", () => {
		const c = makeController([1000, 5000], [1000, 3000], [8000, 9000]);

		tick(c, 1000, true);
		expect(playing(c)).toEqual([0, 1]);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});

	it("does not backfill and focuses on interlude point when seeking into interlude range", () => {
		const c = makeController([0, 1000], [6000, 7000]);

		tick(c, 3000, true);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().activeInterlude?.anchorLineIndex).toBe(0);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});

	it("keeps scrollToIndex consistent with normal playback when seeking into interlude", () => {
		const ranges: [number, number][] = [
			[0, 1000],
			[6000, 7000],
		];

		const played = makeController(...ranges);
		tick(played, 500);
		tick(played, 3000);
		expect(played.getSnapshot().scrollToIndex).toBe(0);

		const seeked = makeController(...ranges);
		tick(seeked, 3000, true);
		expect(seeked.getSnapshot().scrollToIndex).toBe(0);
		expect(seeked.getSnapshot().isFocusOnInterlude).toBe(true);
		expect(highlighted(seeked)).toEqual([]);
	});

	it("keeps scrollToIndex at 0 when seeking into leading silence interlude", () => {
		const c = makeController([5000, 6000]);

		tick(c, 1000, true);
		expect(c.getSnapshot().activeInterlude?.anchorLineIndex).toBe(-1);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});

	it("does not backfill and marks end of song when seeking past the end", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 5000, true);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isEndOfSong).toBe(true);
	});

	it("does not highlight anything when seeking before first line", () => {
		const c = makeController([1000, 2000], [3000, 4000]);

		tick(c, 500, true);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});

	it("transitions to next line normally when playback resumes after seek backfill", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 2000, true);
		expect(highlighted(c)).toEqual([0]);

		const diff = tick(c, 3000);
		expect(highlighted(c)).toEqual([1]);
		expect([...diff.removedHighlighted]).toEqual([0]);
		expect(c.getSnapshot().scrollToIndex).toBe(1);
	});

	it("treats time regression as a seek jump", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 3500);
		expect(highlighted(c)).toEqual([1]);

		const diff = tick(c, 500);
		expect(diff.isTimeJumped).toBe(true);
		expect(highlighted(c)).toEqual([0]);
	});
});

describe("TimelineController seek diff", () => {
	it("produces true diffs where lines continuing to play across seeks are not re-added", () => {
		const c = makeController([0, 10000], [1000, 2000], [15000, 16000]);

		tick(c, 1500);
		expect(playing(c)).toEqual([0, 1]);

		const diff = tick(c, 5000, true);
		expect(playing(c)).toEqual([0]);
		expect(highlighted(c)).toEqual([0, 1]);

		expect([...diff.addedPlaying]).toEqual([]);
		expect([...diff.removedPlaying]).toEqual([1]);
		expect([...diff.addedHighlighted]).toEqual([]);
		expect([...diff.removedHighlighted]).toEqual([]);
	});

	it("produces no diff on unchanged frames during continuous seeking", () => {
		const c = makeController([0, 1000], [3000, 8000]);

		c.setSeekingState(true);

		const first = tick(c, 4000);
		expect([...first.addedHighlighted]).toEqual([1]);
		expect(first.hasChanged).toBe(true);

		for (const ms of [4500, 5000, 5500]) {
			const diff = tick(c, ms);
			expect([...diff.addedPlaying]).toEqual([]);
			expect([...diff.removedPlaying]).toEqual([]);
			expect([...diff.addedHighlighted]).toEqual([]);
			expect([...diff.removedHighlighted]).toEqual([]);
			expect(diff.hasChanged).toBe(true);
		}

		expect(playing(c)).toEqual([1]);
		expect(highlighted(c)).toEqual([1]);
	});

	it("does not both remove and re-add the same line within the same frame", () => {
		const c = makeController([0, 5000], [1000, 4500], [6000, 7000]);

		tick(c, 2000);
		expect(highlighted(c)).toEqual([0, 1]);

		const diff = tick(c, 3000, true);
		const removed = new Set(diff.removedHighlighted);
		for (const id of diff.addedHighlighted) {
			expect(removed.has(id)).toBe(false);
		}
		expect(highlighted(c)).toEqual([0, 1]);
	});

	it("does not cause scrollToIndex to go out of bounds when seeking past the last line", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 5000, true);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isEndOfSong).toBe(true);
		expect(c.getSnapshot().scrollToIndex).toBe(1);
	});

	it("does not cause scrollToIndex to go out of bounds when all lines have zero duration", () => {
		const c = makeController([1000, 1000], [2000, 2000]);

		tick(c, 3000, true);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});

	it("keeps scrollToIndex consistent between seek and normal playback with leading zero-duration lines", () => {
		const ranges: [number, number][] = [
			[1000, 1000],
			[3000, 4000],
		];

		const played = makeController(...ranges);
		tick(played, 0);
		tick(played, 1000);
		tick(played, 2000);
		expect(played.getSnapshot().scrollToIndex).toBe(0);
		expect(highlighted(played)).toEqual([]);

		const seeked = makeController(...ranges);
		tick(seeked, 2000, true);
		expect(seeked.getSnapshot().scrollToIndex).toBe(0);
		expect(highlighted(seeked)).toEqual([]);
	});
});

describe("TimelineController diff flags", () => {
	it("produces no diff when progressing within the same line", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 500);
		const diff = tick(c, 800);
		expect(diff.hasChanged).toBe(false);
		expect(diff.isTimeJumped).toBe(false);
		expect(diff.isScrollToChanged).toBe(false);
		expect(diff.isInterludeChanged).toBe(false);
		expect([...diff.addedPlaying]).toEqual([]);
		expect([...diff.removedPlaying]).toEqual([]);
		expect([...diff.addedHighlighted]).toEqual([]);
		expect([...diff.removedHighlighted]).toEqual([]);
	});

	it("reports transition diffs for playing and highlighted lines on line change", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 500);
		const diff = tick(c, 3000);
		expect([...diff.addedPlaying]).toEqual([1]);
		expect([...diff.removedPlaying]).toEqual([0]);
		expect([...diff.addedHighlighted]).toEqual([1]);
		expect([...diff.removedHighlighted]).toEqual([0]);
		expect(diff.isScrollToChanged).toBe(true);
		expect(diff.hasChanged).toBe(true);
	});

	it("only sets isScrollToChanged to true on the exact frame the line changes", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 500);
		expect(tick(c, 1000).isScrollToChanged).toBe(false);
		expect(tick(c, 3000).isScrollToChanged).toBe(true);
		expect(tick(c, 3500).isScrollToChanged).toBe(false);
	});

	it("reflects interlude state transitions in isInterludeChanged", () => {
		const c = makeController([0, 1000], [6000, 7000]);

		tick(c, 500);
		expect(tick(c, 1000).isInterludeChanged).toBe(true);
		expect(tick(c, 3000).isInterludeChanged).toBe(false);
		expect(tick(c, 6000).isInterludeChanged).toBe(true);
	});

	it("sets isTimeJumped and isSeeking on explicit seek, resetting on the next frame", () => {
		const c = makeController([0, 1000], [3000, 4000]);

		tick(c, 500);
		const diff = tick(c, 3500, true);
		expect(diff.isTimeJumped).toBe(true);
		expect(c.getSnapshot().isSeeking).toBe(true);

		const next = tick(c, 3600);
		expect(next.isTimeJumped).toBe(false);
		expect(next.hasChanged).toBe(false);
		expect(c.getSnapshot().isSeeking).toBe(false);
	});
});

describe("TimelineController interlude boundaries and multiple interludes", () => {
	it("forms an interlude when gap reaches exactly 4s", () => {
		const c = makeController([0, 1000], [5000, 6000]);

		tick(c, 1000);
		const interlude = c.getSnapshot().activeInterlude;
		expect(millis(interlude?.startTime)).toBe(1000);
		expect(millis(interlude?.endTime)).toBe(5000);
		expect(interlude?.anchorLineIndex).toBe(0);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);
	});

	it("does not form an interlude when gap is 1ms short of 4s, keeping previous line highlighted", () => {
		const c = makeController([0, 1000], [4999, 5999]);

		tick(c, 500);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 1000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);

		tick(c, 3000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(highlighted(c)).toEqual([0]);
	});

	it("produces an interlude for leading silence over 4s with anchor before first line", () => {
		const c = makeController([5000, 6000]);

		tick(c, 1000);
		const interlude = c.getSnapshot().activeInterlude;
		expect(interlude).toBeDefined();
		expect(interlude?.anchorLineIndex).toBe(-1);
		expect(millis(interlude?.startTime)).toBe(0);
		expect(millis(interlude?.endTime)).toBe(5000);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);
		expect(c.getSnapshot().latestHighlightedIndex).toBeUndefined();

		tick(c, 5000);
		expect(highlighted(c)).toEqual([0]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);
	});

	it("hits multiple interludes sequentially and transitions properly", () => {
		const c = makeController([0, 1000], [6000, 7000], [13000, 14000]);

		tick(c, 500);
		expect(tick(c, 1000).isInterludeChanged).toBe(true);

		tick(c, 3000);
		expect(c.getSnapshot().activeInterlude?.anchorLineIndex).toBe(0);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);
		expect(highlighted(c)).toEqual([]);

		expect(tick(c, 6000).isInterludeChanged).toBe(true);
		expect(highlighted(c)).toEqual([1]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);

		const diff = tick(c, 7000);
		expect(diff.isInterludeChanged).toBe(true);
		expect(c.getSnapshot().activeInterlude?.anchorLineIndex).toBe(1);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);

		tick(c, 10000);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);

		tick(c, 13000);
		expect(highlighted(c)).toEqual([2]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);
	});

	it("resumes lyrics when playback reaches the end of an interlude entered via seek", () => {
		const c = makeController([0, 1000], [6000, 7000]);

		tick(c, 3000, true);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);
		expect(highlighted(c)).toEqual([]);

		tick(c, 6000);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(highlighted(c)).toEqual([1]);
		expect(c.getSnapshot().isFocusOnInterlude).toBe(false);
	});
});

describe("TimelineController snapshot details", () => {
	it("always points latestHighlightedIndex to the maximum index of highlighted lines", () => {
		const c = makeController([0, 5000], [1000, 4500], [6000, 7000]);

		tick(c, 500);
		expect(c.getSnapshot().latestHighlightedIndex).toBe(0);

		tick(c, 1500);
		expect(c.getSnapshot().latestHighlightedIndex).toBe(1);

		tick(c, 4500);
		expect(c.getSnapshot().latestHighlightedIndex).toBe(1);

		tick(c, 6000);
		expect(c.getSnapshot().latestHighlightedIndex).toBe(2);
	});

	it("keeps latestHighlightedIndex undefined before the first line starts", () => {
		const c = makeController([1000, 2000], [3000, 4000]);

		tick(c, 500);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().latestHighlightedIndex).toBeUndefined();
	});

	it("mirrors manual seeking state to snapshot and resets after exit", () => {
		const c = makeController([0, 1000], [3000, 4000]);
		expect(c.getSnapshot().isSeeking).toBe(false);

		c.setSeekingState(true);
		expect(c.getSnapshot().isSeeking).toBe(true);

		const diff = tick(c, 2000);
		expect(diff.isTimeJumped).toBe(false);
		expect(diff.hasChanged).toBe(true);
		expect(highlighted(c)).toEqual([0]);
		expect(c.getSnapshot().isSeeking).toBe(true);

		c.setSeekingState(false);
		tick(c, 3500);
		expect(c.getSnapshot().isSeeking).toBe(false);
		expect(highlighted(c)).toEqual([1]);
	});

	it("produces no diff on sync with empty lyrics, keeping initial snapshot values", () => {
		const c = makeController();

		tick(c, 500);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
		expect(c.getSnapshot().isEndOfSong).toBe(false);
		expect(c.getSnapshot().latestHighlightedIndex).toBeUndefined();

		const diff = tick(c, 1000);
		expect(diff.hasChanged).toBe(false);
	});
});

describe("TimelineController zero-duration and time boundaries", () => {
	it("does not highlight zero-duration lines or block subsequent lines during normal playback", () => {
		const c = makeController([1000, 2000], [2000, 2000], [3000, 4000]);

		tick(c, 1000);
		expect(playing(c)).toEqual([0]);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 2000);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([0]);

		tick(c, 3000);
		expect(highlighted(c)).toEqual([2]);
	});

	it("exits playback exactly at endTime and enters playback exactly at startTime", () => {
		const c = makeController([0, 1000], [1000, 2000]);

		tick(c, 999);
		expect(playing(c)).toEqual([0]);

		tick(c, 1000);
		expect(playing(c)).toEqual([1]);
		expect(highlighted(c)).toEqual([1]);

		tick(c, 1999);
		expect(playing(c)).toEqual([1]);

		tick(c, 2000);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([]);
		expect(c.getSnapshot().isEndOfSong).toBe(true);
	});

	it("enters playback simultaneously for multiple lines sharing the same start time", () => {
		const c = makeController([1000, 5000], [1000, 3000], [8000, 9000]);

		tick(c, 1000);
		expect(playing(c)).toEqual([0, 1]);
		expect(highlighted(c)).toEqual([0, 1]);
		expect(c.getSnapshot().scrollToIndex).toBe(0);
	});
});

describe("TimelineController lyrics reload", () => {
	it("resets all timeline states to origin when time bounds are reset", () => {
		const c = makeController([0, 1000], [6000, 7000]);
		tick(c, 3000);
		expect(c.getSnapshot().activeInterlude).toBeDefined();
		expect(c.getSnapshot().isFocusOnInterlude).toBe(true);

		c.setTimeBounds(bounds([0, 1000], [2000, 3000]));
		const s = c.getSnapshot();
		expect(millis(s.currentTime)).toBe(0);
		expect(s.isEndOfSong).toBe(false);
		expect(s.activeInterlude).toBeUndefined();
		expect(s.isFocusOnInterlude).toBe(false);
		expect(s.latestHighlightedIndex).toBeUndefined();
		expect(s.scrollToIndex).toBe(0);
		expect(playing(c)).toEqual([]);
		expect(highlighted(c)).toEqual([]);

		tick(c, 500);
		expect(highlighted(c)).toEqual([0]);
		tick(c, 1500);
		expect(c.getSnapshot().activeInterlude).toBeUndefined();
		expect(highlighted(c)).toEqual([0]);
		expect(c.getSnapshot().isEndOfSong).toBe(false);
	});
});
