import { describe, expect, it } from "vitest";
import { WebMaskAnimator } from "#lyric/dom/animation/mask/animator-web.ts";
import { getFrameChangeWindow } from "#lyric/dom/animation/mask/utils.ts";
import {
	type AnimationInterval,
	syncAnimationPlayback,
} from "#lyric/dom/animation/sync.ts";

interface StubAnimation {
	playState: AnimationPlayState;
	playbackRate: number;
	playCalls: number;
	pauseCalls: number;
	currentTime: number;
	play(): void;
	pause(): void;
	cancel(): void;
	effect?: { getComputedTiming(): { delay: number; endTime: number } };
}

interface StubWordEl {
	style: Record<string, unknown> & { removeProperty(name: string): void };
	animate(keyframes: Keyframe[], options?: KeyframeAnimationOptions): Animation;
	created: StubAnimation[];
}

/** 记录所有调用与 currentTime 写入，用于验证不会产生多余写入 */
function createStubAnimation(): StubAnimation {
	let currentTime = 0;

	const animation: StubAnimation = {
		playState: "paused",
		playbackRate: 1,
		playCalls: 0,
		pauseCalls: 0,
		get currentTime() {
			return currentTime;
		},
		set currentTime(value: number) {
			currentTime = value;
		},
		play() {
			animation.playCalls++;
			animation.playState = "running";
		},
		pause() {
			animation.pauseCalls++;
			animation.playState = "paused";
		},
		cancel() {},
	};

	return animation;
}

function createStubWordEl(): StubWordEl {
	const element: StubWordEl = {
		style: { removeProperty() {} },
		created: [],
		animate() {
			const animation = createStubAnimation();
			element.created.push(animation);
			return animation as unknown as Animation;
		},
	};
	return element;
}

const asAnimation = (animation: StubAnimation): Animation =>
	animation as unknown as Animation;

describe("syncAnimationPlayback", () => {
	const interval: AnimationInterval = { start: 500, end: 1000 };

	it("活动区间内会启动动画并定位到当前进度", () => {
		const animation = createStubAnimation();

		syncAnimationPlayback(asAnimation(animation), 750, true, interval);

		expect(animation.playState).toBe("running");
		expect(animation.currentTime).toBe(750);
		expect(animation.playCalls).toBe(1);
	});

	it("已经在跑的动画不会被重复播放，也不会被改写进度", () => {
		const animation = createStubAnimation();
		syncAnimationPlayback(asAnimation(animation), 750, true, interval);

		// 模拟浏览器自行推进了动画
		animation.currentTime = 800;
		syncAnimationPlayback(asAnimation(animation), 800, true, interval);

		expect(animation.playCalls).toBe(1);
		expect(animation.currentTime).toBe(800);
	});

	it("区间之前停在区间起点，且不重复写入", () => {
		const animation = createStubAnimation();

		syncAnimationPlayback(asAnimation(animation), 100, true, interval);
		expect(animation.playState).toBe("paused");
		expect(animation.currentTime).toBe(500);

		const writes = animation.playCalls + animation.pauseCalls;
		animation.currentTime = 500;
		for (let t = 200; t < 500; t += 50) {
			syncAnimationPlayback(asAnimation(animation), t, true, interval);
		}

		// 进度一直在变，但静止位置不变，因此仍然不应产生新的调用
		expect(animation.playCalls + animation.pauseCalls).toBe(writes);
		expect(animation.currentTime).toBe(500);
	});

	it("区间之后停在区间终点", () => {
		const animation = createStubAnimation();

		syncAnimationPlayback(asAnimation(animation), 5000, true, interval);

		expect(animation.playState).toBe("paused");
		expect(animation.currentTime).toBe(1000);
	});

	it("暂停时冻结在当前进度", () => {
		const animation = createStubAnimation();

		syncAnimationPlayback(asAnimation(animation), 750, false, interval);

		expect(animation.playState).toBe("paused");
		expect(animation.currentTime).toBe(750);
	});

	it("缺省区间时从动画自身读取", () => {
		const animation = createStubAnimation();
		animation.effect = {
			getComputedTiming: () => ({ delay: 100, endTime: 600 }),
		};

		syncAnimationPlayback(asAnimation(animation), 300, true);
		expect(animation.playState).toBe("running");

		syncAnimationPlayback(asAnimation(animation), 700, true);
		expect(animation.playState).toBe("paused");
		expect(animation.currentTime).toBe(600);
	});
});

describe("getFrameChangeWindow", () => {
	it("找出关键帧里真正发生变化的区间", () => {
		const frames: Keyframe[] = [
			{ offset: 0, maskPosition: "-10px 0" },
			{ offset: 0.25, maskPosition: "-10px 0" },
			{ offset: 0.5, maskPosition: "-5px 0" },
			{ offset: 0.75, maskPosition: "0px 0" },
			{ offset: 1, maskPosition: "0px 0" },
		];

		expect(getFrameChangeWindow(frames, 1000)).toEqual({
			start: 250,
			end: 750,
		});
	});

	it("整段都没有变化时返回 undefined", () => {
		const frames: Keyframe[] = [
			{ offset: 0, maskPosition: "0px 0" },
			{ offset: 1, maskPosition: "0px 0" },
		];

		expect(getFrameChangeWindow(frames, 1000)).toBeUndefined();
	});
});

describe("WebMaskAnimator 的播放调度", () => {
	function createAnimator() {
		const words = [
			{ word: "a", startTime: 0, endTime: 400 },
			{ word: "b", startTime: 400, endTime: 800 },
			{ word: "c", startTime: 800, endTime: 1200 },
		].map((word) => ({
			...word,
			mainElement: createStubWordEl() as unknown as HTMLElement,
			width: 50,
			height: 20,
			padding: 0,
		}));

		const animator = new WebMaskAnimator(words, {
			lineStartTime: 0,
			lineEndTime: 1200,
			wordFadeWidth: 0.5,
			supportMaskImage: true,
		});
		animator.apply();

		const animations = words.map(
			(word) => (word.mainElement as unknown as StubWordEl).created[0],
		);

		return { animator, animations };
	}

	const states = (animations: StubAnimation[]) =>
		animations.map((animation) => animation.playState);

	it("只让当前正在扫过的那一个单词保持播放", () => {
		const { animator, animations } = createAnimator();

		animator.setCurrentTime(200, true);
		expect(states(animations)).toEqual(["running", "paused", "paused"]);

		animator.setCurrentTime(600, true);
		expect(states(animations)).toEqual(["paused", "running", "paused"]);

		animator.setCurrentTime(1000, true);
		expect(states(animations)).toEqual(["paused", "paused", "running"]);
	});

	it("整行播放结束后全部停下", () => {
		const { animator, animations } = createAnimator();

		animator.setCurrentTime(600, true);
		animator.setCurrentTime(1200, true);

		expect(states(animations)).toEqual(["paused", "paused", "paused"]);
	});

	it("播放器暂停时全部停下", () => {
		const { animator, animations } = createAnimator();

		animator.setCurrentTime(600, true);
		animator.setCurrentTime(600, false);

		expect(states(animations)).toEqual(["paused", "paused", "paused"]);
		// 冻结在暂停时的进度上，而不是跳回区间端点
		expect(animations[1].currentTime).toBe(600);
	});
});
