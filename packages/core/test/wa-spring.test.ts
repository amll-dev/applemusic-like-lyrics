import { describe, expect, it } from "vitest";
import type { SpringParams } from "#utils/spring.ts";
import { Spring as FrameSpring } from "#utils/spring.ts";
import { Duration } from "#utils/time.ts";
import { Spring as WASpring } from "#utils/wa-spring.ts";

interface Step {
	params?: Partial<SpringParams>;
	paramsDelayMs?: number;
	target?: number;
	delayMs?: number;
	deltas?: number[];
}

/** 使用同一段驱动脚本回放弹簧，记录每一步之后的位置 */
function replay(spring: FrameSpring, steps: Step[]): number[] {
	const positions: number[] = [];
	for (const step of steps) {
		if (step.params) {
			spring.updateParams(
				step.params,
				Duration.fromMillis(step.paramsDelayMs ?? 0),
			);
		}
		if (step.target !== undefined) {
			spring.setTargetPosition(
				step.target,
				Duration.fromMillis(step.delayMs ?? 0),
			);
		}
		for (const delta of step.deltas ?? []) {
			spring.update(Duration.fromMillis(delta));
			positions.push(spring.getCurrentPosition());
		}
	}
	return positions;
}

const PARAM_SETS: Array<{ name: string; params?: Partial<SpringParams> }> = [
	{ name: "默认参数（欠阻尼）" },
	{
		name: "歌词纵向滚动参数（欠阻尼）",
		params: { mass: 0.9, damping: 15, stiffness: 90 },
	},
	{ name: "过阻尼", params: { mass: 1, damping: 30, stiffness: 100 } },
	{
		name: "soft 分支",
		params: { mass: 1, damping: 10, stiffness: 100, soft: true },
	},
	{
		name: "缩放参数（大质量）",
		params: { mass: 2, damping: 25, stiffness: 100 },
	},
];

const STEPS: Step[] = [
	{ target: 120, deltas: [16, 16, 16, 16, 16] },
	{ target: 40, deltas: [16, 16, 16] },
	{ target: -200, deltas: [8, 8, 8, 8, 8, 8] },
	{ target: 0, deltas: [16, 16, 16, 16, 16, 16, 16, 16] },
];

const DELAYED_STEPS: Step[] = [
	{ target: 300, delayMs: 60, deltas: [16, 16, 16, 16, 16, 16, 16, 16] },
	{ target: 100, delayMs: 20, deltas: [16, 16, 16, 16, 16] },
	{ params: { stiffness: 150 }, paramsDelayMs: 40, deltas: [16, 16, 16] },
];

interface StubElement {
	style: Record<string, string>;
	styleWrites: number;
	animateCallCount: number;
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions | undefined;
	cancelCount: number;
	animate?(
		keyframes: Keyframe[],
		options?: KeyframeAnimationOptions,
	): Animation;
}

function createStubElement(withAnimate = true): StubElement {
	const stub: StubElement = {
		style: {},
		styleWrites: 0,
		animateCallCount: 0,
		keyframes: [],
		options: undefined,
		cancelCount: 0,
	};

	// 统计样式写入次数，用于验证是否真的没有逐帧样式变更
	stub.style = new Proxy({} as Record<string, string>, {
		set(target, key, value) {
			stub.styleWrites++;
			target[key as string] = value;
			return true;
		},
	});

	if (withAnimate) {
		stub.animate = (keyframes, options) => {
			stub.animateCallCount++;
			stub.keyframes = keyframes;
			stub.options = options;
			return {
				cancel() {
					stub.cancelCount++;
				},
			} as unknown as Animation;
		};
	}

	return stub;
}

function attachStub(spring: WASpring, stub: StubElement): void {
	spring.attach({
		element: stub as unknown as HTMLElement,
		frame: (position) => ({ transform: `translateY(${position}px)` }),
	});
}

function keyframePosition(frame: Keyframe): number {
	const transform = frame.transform;
	if (typeof transform !== "string") {
		throw new Error(`关键帧缺少 transform: ${JSON.stringify(frame)}`);
	}
	const match = /translateY\((-?[\d.]+)px\)/.exec(transform);
	if (!match) throw new Error(`无法解析的关键帧: ${transform}`);
	return Number(match[1]);
}

describe("WASpring 与 Spring 的算法一致性", () => {
	for (const { name, params } of PARAM_SETS) {
		it(`在「${name}」下逐帧位置完全一致`, () => {
			const steps: Step[] = [{ params }, ...STEPS];
			const framePositions = replay(new FrameSpring(0), steps);
			const waPositions = replay(new WASpring(0), steps);

			expect(waPositions).toEqual(framePositions);
		});
	}

	it("在带延迟的队列语义下逐帧位置完全一致", () => {
		const steps: Step[] = [
			{ params: { mass: 0.9, damping: 15, stiffness: 90 } },
			...DELAYED_STEPS,
		];
		const framePositions = replay(new FrameSpring(0), steps);
		const waPositions = replay(new WASpring(0), steps);

		expect(waPositions).toEqual(framePositions);
	});

	it("arrived 的判定时刻一致", () => {
		const frameSpring = new FrameSpring(0);
		const waSpring = new WASpring(0);

		frameSpring.setTargetPosition(200);
		waSpring.setTargetPosition(200);

		for (let i = 0; i < 200; i++) {
			frameSpring.update(Duration.fromMillis(16));
			waSpring.update(Duration.fromMillis(16));
			expect(waSpring.arrived()).toBe(frameSpring.arrived());
		}
	});
});

describe("WASpring 的 Web Animation API 驱动", () => {
	it("绑定样式目标后接管样式并生成关键帧", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);

		expect(spring.managesStyle).toBe(false);

		attachStub(spring, stub);
		expect(spring.managesStyle).toBe(true);

		spring.setTargetPosition(100);

		expect(stub.keyframes.length).toBeGreaterThan(2);
		expect(stub.options?.easing).toBe("linear");
		expect(stub.options?.fill).toBe("both");

		const duration = stub.options?.duration;
		if (typeof duration !== "number") throw new Error("duration 应为数字");
		expect(duration).toBeGreaterThan(0);

		// 关键帧的时间点等距递增
		for (let i = 1; i < stub.keyframes.length; i++) {
			const prev = stub.keyframes[i - 1].offset as number;
			const cur = stub.keyframes[i].offset as number;
			expect(cur).toBeGreaterThan(prev);
		}
		expect(stub.keyframes[0].offset).toBe(0);
		expect(stub.keyframes[stub.keyframes.length - 1].offset).toBe(1);
	});

	it("关键帧取值与解析解逐点一致", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);
		attachStub(spring, stub);
		spring.setTargetPosition(100);

		const duration = stub.options?.duration;
		if (typeof duration !== "number") throw new Error("duration 应为数字");

		// 用逐帧实现按同样的时间点采样，两者应当重合
		const frameSpring = new FrameSpring(0);
		frameSpring.setTargetPosition(100);

		let elapsed = 0;
		for (const frame of stub.keyframes) {
			const time = (frame.offset as number) * duration;
			frameSpring.update(Duration.fromMillis(time - elapsed));
			elapsed = time;
			expect(keyframePosition(frame)).toBeCloseTo(
				frameSpring.getCurrentPosition(),
				6,
			);
		}

		// 最后一个关键帧已经收敛到目标附近
		expect(
			keyframePosition(stub.keyframes[stub.keyframes.length - 1]),
		).toBeCloseTo(100, 1);
	});

	it("参数未变化时不会重建关键帧动画", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);
		attachStub(spring, stub);

		const defaults = { mass: 1, damping: 10, stiffness: 100, soft: false };
		// 第一次应用参数确实是变化，允许重建
		spring.updateParams({ ...defaults });
		spring.setTargetPosition(100);
		const baseline = stub.animateCallCount;
		expect(baseline).toBeGreaterThan(0);

		// 与当前完全相同的参数（歌词播放期间会被反复推送）不应触发重建
		spring.updateParams({ ...defaults });
		spring.updateParams({ mass: 1, damping: 10 });
		expect(stub.animateCallCount).toBe(baseline);

		// 真正发生变化时才重建
		spring.updateParams({ stiffness: 150 });
		expect(stub.animateCallCount).toBe(baseline + 1);
	});

	it("关键帧经过精简且与解析解的偏差在容差内", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);
		attachStub(spring, stub);
		// 纵向滚动的慢速参数，尾段很长且接近平直，冗余采样点最多
		spring.updateParams({ mass: 0.9, damping: 15, stiffness: 90 });
		spring.setTargetPosition(160);

		const duration = stub.options?.duration;
		if (typeof duration !== "number") throw new Error("duration 应为数字");

		// 逐帧实现作为解析解参考
		const reference = new FrameSpring(0);
		reference.updateParams({ mass: 0.9, damping: 15, stiffness: 90 });
		reference.setTargetPosition(160);
		let referenceTime = 0;
		const positionAt = (time: number) => {
			reference.update(Duration.fromMillis(time - referenceTime));
			referenceTime = time;
			return reference.getCurrentPosition();
		};

		const frames = stub.keyframes;
		expect(frames.length).toBeGreaterThan(2);

		// 均匀采样的点数作为对比基准
		const uniformCount = Math.ceil(duration / (1000 / 120)) + 1;
		expect(frames.length).toBeLessThan(uniformCount / 2);

		for (let i = 0; i < frames.length - 1; i++) {
			const from = frames[i];
			const to = frames[i + 1];
			const fromTime = (from.offset as number) * duration;
			const toTime = (to.offset as number) * duration;

			// 保留下来的关键帧本身必须精确落在解析解上
			expect(keyframePosition(from)).toBeCloseTo(positionAt(fromTime), 6);

			// 两点之间的线性插值（即浏览器实际渲染的轨迹）也要贴合解析解
			const midTime = (fromTime + toTime) / 2;
			const mid = (keyframePosition(from) + keyframePosition(to)) / 2;
			expect(Math.abs(mid - positionAt(midTime))).toBeLessThan(0.5);
		}
	});

	it("动画期间与收敛之后都不产生逐帧样式变更", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);
		attachStub(spring, stub);

		// 绑定样式目标时写入一次初始值
		expect(stub.styleWrites).toBe(1);

		spring.setTargetPosition(100);

		// 生成关键帧交给浏览器时不应写入样式
		expect(stub.styleWrites).toBe(1);

		// 动画进行中全部由 Web Animation API 负责，不应有任何样式写入
		for (let i = 0; i < 5; i++) {
			spring.update(Duration.fromMillis(16));
		}
		expect(stub.styleWrites).toBe(1);

		// 收敛时贴合目标位置，只写入一次
		let guard = 0;
		while (!spring.arrived() && guard++ < 600) {
			spring.update(Duration.fromMillis(16));
		}
		expect(spring.arrived()).toBe(true);
		expect(stub.styleWrites).toBe(2);

		// 收敛后继续逐帧推进，不应再产生任何样式写入
		for (let i = 0; i < 60; i++) {
			spring.update(Duration.fromMillis(16));
		}
		expect(stub.styleWrites).toBe(2);
	});

	it("setPosition 会取消动画并立刻写入样式", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);
		attachStub(spring, stub);
		spring.setTargetPosition(100);

		spring.setPosition(42);

		expect(stub.cancelCount).toBeGreaterThan(0);
		expect(stub.style.transform).toBe("translateY(42px)");
	});

	it("解绑样式目标后恢复为纯数值计算", () => {
		const stub = createStubElement();
		const spring = new WASpring(0);
		attachStub(spring, stub);
		spring.attach(undefined);

		expect(spring.managesStyle).toBe(false);
		spring.setTargetPosition(100);
		expect(stub.keyframes).toEqual([]);
	});

	it("样式映射依赖的外部量变化时可刷新关键帧", () => {
		const stub = createStubElement();
		let height = 10;
		const spring = new WASpring(0);
		spring.attach({
			element: stub as unknown as HTMLElement,
			frame: (position) => ({
				transform: `translateY(${position * height}px)`,
			}),
		});

		spring.setTargetPosition(100);
		height = 20;
		spring.refresh();

		expect(
			keyframePosition(stub.keyframes[stub.keyframes.length - 1]),
		).toBeCloseTo(2000, 1);
	});

	it("不支持 Web Animation API 时安全退化为纯数值计算", () => {
		const stub = createStubElement(false);
		const spring = new WASpring(0);

		expect(() => attachStub(spring, stub)).not.toThrow();
		expect(spring.managesStyle).toBe(false);

		spring.setTargetPosition(100);
		spring.update(Duration.fromMillis(16));

		expect(spring.getCurrentPosition()).toBeGreaterThan(0);
	});
});

describe("逐帧实现不做任何样式接管", () => {
	it("managesStyle 恒为 false 且 attach 为空实现", () => {
		const stub = createStubElement();
		const spring = new FrameSpring(0);

		spring.attach({
			element: stub as unknown as HTMLElement,
			frame: () => ({}),
		});

		expect(spring.managesStyle).toBe(false);
		spring.setTargetPosition(100);
		expect(stub.keyframes).toEqual([]);
		expect(() => spring.refresh()).not.toThrow();
	});
});
