// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { LyricLineGroup } from "#lyric/dom/lyric-group.ts";

type GroupRuntimeState = {
	bgWrapper?: HTMLElement;
	bgLine?: {
		onLineSizeChange(size: [number, number]): void;
	};
	lastBgHeight: number;
	lastBgSlideYNum: number;
	isUiDirty: boolean;
};

function createGroupState() {
	const onLineSizeChange = vi.fn();
	const group = Object.create(LyricLineGroup.prototype) as LyricLineGroup;
	Object.assign(group, {
		bgWrapper: document.createElement("div"),
		bgLine: { onLineSizeChange },
		lastBgHeight: 40,
		lastBgSlideYNum: 12,
		isUiDirty: false,
	});

	return {
		group,
		state: group as unknown as GroupRuntimeState,
		onLineSizeChange,
	};
}

describe("LyricLineGroup background resize", () => {
	it("forwards width-only background-wrapper resizes to the background line", () => {
		const { group, state, onLineSizeChange } = createGroupState();

		group.onBgSizeChange([320, 40]);

		expect(onLineSizeChange).toHaveBeenCalledOnce();
		expect(onLineSizeChange).toHaveBeenCalledWith([320, 40]);
		expect(state.lastBgHeight).toBe(40);
		expect(state.lastBgSlideYNum).toBe(12);
		expect(state.isUiDirty).toBe(false);
	});

	it("preserves background layout invalidation when height changes", () => {
		const { group, state, onLineSizeChange } = createGroupState();

		group.onBgSizeChange([320, 48]);

		expect(onLineSizeChange).toHaveBeenCalledOnce();
		expect(onLineSizeChange).toHaveBeenCalledWith([320, 48]);
		expect(state.lastBgHeight).toBe(48);
		expect(state.lastBgSlideYNum).toBe(-9999);
		expect(state.isUiDirty).toBe(true);
	});

	it("ignores background resize callbacks when no wrapper exists", () => {
		const { group, state, onLineSizeChange } = createGroupState();
		state.bgWrapper = undefined;

		group.onBgSizeChange([320, 48]);

		expect(onLineSizeChange).not.toHaveBeenCalled();
		expect(state.lastBgHeight).toBe(40);
		expect(state.lastBgSlideYNum).toBe(12);
		expect(state.isUiDirty).toBe(false);
	});
});
