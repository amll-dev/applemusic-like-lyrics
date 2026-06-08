import { describe, expect, it } from "vitest";
import type { LyricLineGroupBase } from "../src/lyric-player/base/group.ts";
import {
	commitPlayerTimeState,
	computePlayerTimeState,
	type PlayerTimelineState,
} from "../src/lyric-player/base/timeline.ts";

function group(startTime: number, endTime: number): LyricLineGroupBase {
	return {
		get startTime() {
			return startTime;
		},
		get endTime() {
			return endTime;
		},
	} as unknown as LyricLineGroupBase;
}

function timelineState(
	overrides: Partial<PlayerTimelineState>,
): PlayerTimelineState {
	return {
		currentTime: 0,
		lastCurrentTime: 0,
		hotGroups: new Set(),
		bufferedGroups: new Set(),
		scrollToIndex: 0,
		isSeeking: false,
		isPlaying: true,
		initialLayoutFinished: true,
		...overrides,
	};
}

describe("lyric timeline", () => {
	it("disables the previous buffered group when the next group becomes active", () => {
		const currentGroups = [group(0, 1000), group(1000, 2000)];
		const state = timelineState({
			currentTime: 999,
			lastCurrentTime: 999,
			hotGroups: new Set([0]),
			bufferedGroups: new Set([0]),
		});

		const stateResult = computePlayerTimeState({
			time: 1000,
			currentGroups,
			timelineState: state,
		});

		expect([...stateResult.nextHotGroups]).toEqual([1]);
		expect([...stateResult.addedIds]).toEqual([1]);
		expect([...stateResult.removedHotIds]).toEqual([0]);
		expect([...stateResult.removedBufferedIds]).toEqual([0]);

		const commitResult = commitPlayerTimeState({
			timelineState: state,
			time: 1000,
			currentGroups,
			hasBottomContent: false,
			stateResult,
		});

		expect([...state.bufferedGroups]).toEqual([1]);
		expect(commitResult.groupsToEnable).toEqual([1]);
		expect(commitResult.groupsToDisable).toEqual([0]);
		expect(state.scrollToIndex).toBe(1);
	});
});
