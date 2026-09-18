import { describe, expect, it } from "vitest";
import {
	InterludeDotsBase,
	type InterludeDotsFrame,
	type InterludeDotsSnapshot,
} from "#lyric/base/interlude-dots.ts";
import { Duration, MediaTime } from "#utils/time.ts";

interface RenderRecord {
	readonly snapshot: InterludeDotsSnapshot;
	readonly elapsedMs: number;
}

interface StartRecord {
	readonly frames: number;
	readonly elapsedMs: number;
	readonly playing: boolean;
}

class TestInterludeDots extends InterludeDotsBase {
	public readonly rendered: RenderRecord[] = [];
	public readonly events: string[] = [];
	public start?: StartRecord;

	protected override render(
		snapshot: Readonly<InterludeDotsSnapshot>,
		_left: number,
		_top: number,
		elapsedMs: number,
	): void {
		this.rendered.push({
			snapshot: {
				isActive: snapshot.isActive,
				scale: snapshot.scale,
				opacity: snapshot.opacity,
				dotOpacities: [...snapshot.dotOpacities],
			},
			elapsedMs,
		});
	}

	protected override onPerformanceStart(
		timeline: readonly InterludeDotsFrame[],
		elapsedMs: number,
		playing: boolean,
	): void {
		this.events.push("start");
		this.start = { frames: timeline.length, elapsedMs, playing };
	}

	protected override onPerformanceEnd(): void {
		this.events.push("end");
	}

	protected override onPlaybackStateChange(playing: boolean): void {
		this.events.push(`playback:${playing}`);
	}

	protected override onFadeOut(): void {
		this.events.push("fade-out");
	}
}

function range(startMs: number, endMs: number): [MediaTime, MediaTime] {
	return [MediaTime.fromMillis(startMs), MediaTime.fromMillis(endMs)];
}

function time(ms: number): MediaTime {
	return MediaTime.fromMillis(ms);
}

function dur(ms: number): Duration {
	return Duration.fromMillis(ms);
}

describe("InterludeDotsBase - Timeline Sampling", () => {
	it("时间轴覆盖整段演出，时间戳严格递增", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(2000), true, 0);

		const frames = dots.sampleTimeline();

		expect(frames.length).toBeGreaterThan(2);
		expect(frames[0].time).toBe(0);
		// 演出终点为 入场延迟 500 + 主体 6500 + 退场 1000
		expect(frames[frames.length - 1].time).toBe(8000);
		for (let i = 1; i < frames.length; i++) {
			expect(frames[i].time).toBeGreaterThan(frames[i - 1].time);
		}
	});

	it("每一帧的数值都与逐帧演算完全一致", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(2000), true, 0);
		const frames = dots.sampleTimeline();

		// 直接按采样时间点驱动演出时钟，避免逐帧累加 delta 带来浮点漂移
		for (const frame of frames) {
			dots.syncClock(time(2000 + frame.time));
			dots.update();
			const rendered = dots.rendered[dots.rendered.length - 1];

			expect(rendered.elapsedMs).toBeCloseTo(frame.time, 6);
			expect(rendered.snapshot.opacity).toBeCloseTo(frame.opacity, 6);
			expect(rendered.snapshot.scale).toBeCloseTo(frame.scale, 6);
			for (let i = 0; i < 3; i++) {
				expect(rendered.snapshot.dotOpacities[i]).toBeCloseTo(
					frame.dotOpacities[i],
					6,
				);
			}
		}
	});

	it("补入快速过场的转折点", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(2000), true, 0);

		const times = dots.sampleTimeline().map((frame) => frame.time);

		// 入场延迟结束、入场淡入结束、主体结束、退场蓄力结束、退场渐隐起点
		for (const boundary of [500, 680, 7000, 7750, 7750]) {
			expect(times).toContain(boundary);
		}
	});

	it("超长间奏的关键帧数量受到上限约束", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 600000), time(0), true, 0);

		const frames = dots.sampleTimeline();

		expect(frames.length).toBeLessThanOrEqual(620);
		expect(frames[frames.length - 1].time).toBe(600000);
	});

	it("fallback-hold 编排下主体阶段缩放恒为 1", () => {
		const dots = new TestInterludeDots();
		// 入场延迟 500 + 主体 2500，主体时长落在 [910ms, 3000ms) 区间，降级为 fallback-hold
		dots.setInterlude(range(0, 4000), time(0), true, 0);

		const bodyFrames = dots
			.sampleTimeline()
			.filter((frame) => frame.time >= 500 && frame.time < 3000);

		expect(bodyFrames.length).toBeGreaterThan(0);
		for (const frame of bodyFrames) expect(frame.scale).toBe(1);
	});

	it("未配置间奏时返回空时间轴", () => {
		const dots = new TestInterludeDots();

		expect(dots.sampleTimeline()).toEqual([]);
	});
});

describe("InterludeDotsBase - Timeline Lifecycle Hooks", () => {
	it("演出开始时给出时间轴与起始进度", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(3000), false, 0);

		expect(dots.events).toEqual(["start"]);
		// 非 Seek 场景锚定在间奏起点，起始进度就是媒体时间相对间奏起点的偏移
		expect(dots.start?.elapsedMs).toBe(3000);
		expect(dots.start?.playing).toBe(true);
		expect(dots.start?.frames).toBeGreaterThan(2);
	});

	it("暂停与恢复会同步播放状态", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(0), true, 0);

		dots.pause();
		dots.resume();

		expect(dots.events).toEqual(["start", "playback:false", "playback:true"]);
	});

	it("淡出时通知子类收束时间轴", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(0), true, 0);
		dots.update(dur(2000));

		dots.dismiss();

		expect(dots.events).toEqual(["start", "fade-out"]);
	});

	it("演出自然结束时通知子类收束时间轴", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(0), true, 0);
		dots.update(dur(20000));

		expect(dots.events).toEqual(["start", "end"]);
	});

	it("清空间奏区间时通知子类收束时间轴", () => {
		const dots = new TestInterludeDots();
		dots.setInterlude(range(0, 10000), time(0), true, 0);
		dots.clearInterlude(true);

		expect(dots.events).toEqual(["start", "end"]);
	});

	it("间奏时长不足时不启动演出", () => {
		const dots = new TestInterludeDots();
		const canDisplay = dots.setInterlude(range(0, 800), time(0), true, 0);

		expect(canDisplay).toBe(false);
		expect(dots.events).toEqual([]);
	});
});
