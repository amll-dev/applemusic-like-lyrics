import { describe, expect, it } from "vitest";
import {
	InterludeDotsBase,
	type InterludeDotsSnapshot,
} from "#lyric/base/interlude-dots.ts";
import { Duration, MediaTime } from "#utils/time.ts";

interface RenderRecord {
	readonly snapshot: InterludeDotsSnapshot;
	readonly left: number;
	readonly top: number;
}

class TestInterludeDots extends InterludeDotsBase {
	public readonly rendered: RenderRecord[] = [];

	protected override render(
		snapshot: Readonly<InterludeDotsSnapshot>,
		left: number,
		top: number,
	): void {
		this.rendered.push({
			snapshot: {
				isActive: snapshot.isActive,
				scale: snapshot.scale,
				opacity: snapshot.opacity,
				dotOpacities: [...snapshot.dotOpacities],
			},
			left,
			top,
		});
	}

	public lastRender(): RenderRecord | undefined {
		return this.rendered[this.rendered.length - 1];
	}

	public clearRenderHistory(): void {
		this.rendered.length = 0;
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

describe("InterludeDotsBase - Lifecycle and Contract", () => {
	it("does not render before an interlude is configured", () => {
		const dots = new TestInterludeDots();

		dots.update(dur(100));
		dots.update(dur(500));

		expect(dots.rendered).toHaveLength(0);
	});

	it("starts performance and emits active snapshot once a playable interlude is set", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 10000), time(0), false, -1);
		expect(canDisplay).toBe(true);

		dots.update(dur(0));
		expect(dots.rendered).toHaveLength(1);
		expect(dots.lastRender()?.snapshot.isActive).toBe(true);
	});

	it("rejects unplayable short interlude and emits no performance", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 500), time(0), false, -1);
		expect(canDisplay).toBe(false);

		dots.update(dur(100));
		expect(dots.rendered).toHaveLength(0);
	});

	it("automatically completes performance when interlude ends and halts future renders", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 6000), time(0), false, -1);
		expect(canDisplay).toBe(true);

		dots.update(dur(6500));

		const completionFrame = dots.lastRender();
		expect(completionFrame?.snapshot.isActive).toBe(false);
		expect(completionFrame?.snapshot.opacity).toBe(0);

		dots.clearRenderHistory();
		dots.update(dur(100));
		dots.update(dur(1000));
		expect(dots.rendered).toHaveLength(0);
	});

	it("emits hidden snapshot and terminates performance when canceled with undefined", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(2000));
		const snapshotBeforeCancel = dots.lastRender()?.snapshot;
		expect(snapshotBeforeCancel?.isActive).toBe(true);

		dots.clearRenderHistory();
		dots.clearInterlude();

		dots.update(dur(75));
		const fadeFrame = dots.lastRender()?.snapshot;
		expect(fadeFrame?.isActive).toBe(true);
		expect(fadeFrame?.opacity).toBeLessThan(snapshotBeforeCancel?.opacity ?? 0);
		expect(fadeFrame?.scale).toBe(snapshotBeforeCancel?.scale);
		expect(fadeFrame?.dotOpacities).toEqual(snapshotBeforeCancel?.dotOpacities);

		dots.update(dur(75));
		expect(dots.rendered).toHaveLength(2);
		expect(dots.lastRender()?.snapshot).toEqual({
			isActive: false,
			dotOpacities: [0, 0, 0],
			scale: 1,
			opacity: 0,
		});

		dots.clearRenderHistory();
		dots.update(dur(100));
		expect(dots.rendered).toHaveLength(0);
	});

	it("does not emit hidden snapshot when canceling if no performance was active", () => {
		const dots = new TestInterludeDots();

		dots.clearInterlude();
		expect(dots.rendered).toHaveLength(0);
	});

	it("preserves playback progress when setting identical interlude without forceReset", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(3000));
		const snapshotAt3s = dots.lastRender()?.snapshot;

		const canDisplay = dots.setInterlude(
			range(0, 10000),
			time(3000),
			false,
			-1,
		);
		expect(canDisplay).toBe(true);

		dots.update(dur(0));

		expect(dots.lastRender()?.snapshot.opacity).toBe(snapshotAt3s?.opacity);
		expect(dots.lastRender()?.snapshot.dotOpacities).toEqual(
			snapshotAt3s?.dotOpacities,
		);
	});

	it("aligns the clock to the pushed media time instead of catching up via delta", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(3000));

		dots.syncClock(time(6000));
		dots.update(dur(100));

		const reference = new TestInterludeDots();
		reference.setInterlude(range(0, 10000), time(0), false, -1);
		reference.update(dur(6100));

		expect(dots.lastRender()?.snapshot).toEqual(
			reference.lastRender()?.snapshot,
		);
	});

	it("advances the clock by delta interpolation between progress pushes", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.syncClock(time(1000));

		dots.update(dur(16));
		dots.update(dur(16));

		const reference = new TestInterludeDots();
		reference.setInterlude(range(0, 10000), time(0), false, -1);
		reference.update(dur(1032));

		expect(dots.lastRender()?.snapshot).toEqual(
			reference.lastRender()?.snapshot,
		);
	});

	it("re-enables playback if the exact same interlude is re-applied after cancellation (single song loop)", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(2000));
		expect(dots.lastRender()?.snapshot.isActive).toBe(true);

		dots.clearInterlude();
		dots.clearRenderHistory();

		const canDisplay = dots.setInterlude(range(0, 10000), time(0), false, -1);
		expect(canDisplay).toBe(true);

		dots.update(dur(0));
		expect(dots.rendered).toHaveLength(1);
		expect(dots.lastRender()?.snapshot.isActive).toBe(true);
	});

	it("plays again when the same interlude is set after being cleared", () => {
		const dots = new TestInterludeDots();

		expect(dots.setInterlude(range(0, 10000), time(2000), false, 0)).toBe(true);
		dots.update(dur(10000));

		dots.clearInterlude();

		expect(dots.setInterlude(range(0, 10000), time(2000), false, 0)).toBe(true);
	});

	it("stays silent when the same interlude is re-entered without clearing", () => {
		const dots = new TestInterludeDots();

		expect(dots.setInterlude(range(0, 10000), time(2000), false, 0)).toBe(true);
		dots.update(dur(10000));

		dots.dismiss(false);

		expect(dots.setInterlude(range(0, 10000), time(2000), false, 0)).toBe(
			false,
		);
	});

	it("halts ongoing performance when disposed", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000));
		dots.update(dur(1000));
		expect(dots.rendered).toHaveLength(1);

		dots.dispose();
		dots.clearRenderHistory();

		dots.update(dur(1000));
		expect(dots.rendered).toHaveLength(0);
	});
});

describe("InterludeDotsBase - Playback Control and Time Progression", () => {
	it("advances visual progression on positive delta updates", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(0));
		const frame0 = dots.lastRender()?.snapshot;

		dots.update(dur(1000));
		const frame1 = dots.lastRender()?.snapshot;

		expect(frame1?.opacity).toBeGreaterThanOrEqual(frame0?.opacity ?? 0);
		expect(frame1?.dotOpacities[0]).toBeGreaterThan(
			frame0?.dotOpacities[0] ?? 0,
		);
	});

	it("re-renders current state on Duration.ZERO without advancing time", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(1500));
		const frame1 = dots.lastRender()?.snapshot;

		dots.update(dur(0));
		const frame2 = dots.lastRender()?.snapshot;

		expect(frame2).toEqual(frame1);
	});

	it("freezes visual progression when paused and resumes when resumed", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(1000));
		const snapshotAtPause = dots.lastRender()?.snapshot;

		dots.pause();
		dots.update(dur(500));
		dots.update(dur(1000));

		expect(dots.lastRender()?.snapshot).toEqual(snapshotAtPause);

		dots.resume();
		dots.update(dur(1000));

		expect(dots.lastRender()?.snapshot).not.toEqual(snapshotAtPause);
	});
});

describe("InterludeDotsBase - Spatial Transform and Positioning", () => {
	it("immediately triggers render with specified transform coordinates during performance", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000));
		dots.clearRenderHistory();

		dots.setTransform(150, 300);

		expect(dots.rendered).toHaveLength(1);
		expect(dots.lastRender()?.left).toBe(150);
		expect(dots.lastRender()?.top).toBe(300);
	});

	it("preserves set transform coordinates across subsequent frame updates", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000));
		dots.setTransform(42, 84);

		dots.update(dur(200));
		dots.update(dur(500));

		expect(dots.lastRender()?.left).toBe(42);
		expect(dots.lastRender()?.top).toBe(84);
	});

	it("does not trigger render when setting transform if performance is inactive", () => {
		const dots = new TestInterludeDots();

		dots.setTransform(100, 200);

		expect(dots.rendered).toHaveLength(0);
	});
});

describe("InterludeDotsBase - Start Delay: Intro vs Normal vs Seek", () => {
	it("starts visual appearance immediately for natural intro interludes (anchorLineIndex = -1, forceReset = false)", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(200));

		const snapshot = dots.lastRender()?.snapshot;

		expect(snapshot?.opacity).toBeGreaterThan(0);
		expect(snapshot?.dotOpacities[0]).toBeGreaterThan(0);
	});

	it("holds appearance completely hidden during start delay for natural normal interludes (anchorLineIndex >= 0, forceReset = false)", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, 0);

		dots.update(dur(250));
		expect(dots.lastRender()?.snapshot.opacity).toBe(0);
		expect(dots.lastRender()?.snapshot.dotOpacities).toEqual([0, 0, 0]);

		dots.update(dur(400));
		expect(dots.lastRender()?.snapshot.opacity).toBeGreaterThan(0);
		expect(dots.lastRender()?.snapshot.dotOpacities[0]).toBeGreaterThan(0);
	});

	it("forces 500ms start delay when seeking, even for intro interludes (anchorLineIndex = -1, forceReset = true)", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(2000), true, -1);

		dots.update(dur(300));
		expect(dots.lastRender()?.snapshot.opacity).toBe(0);
		expect(dots.lastRender()?.snapshot.dotOpacities).toEqual([0, 0, 0]);

		dots.update(dur(400));
		expect(dots.lastRender()?.snapshot.opacity).toBeGreaterThan(0);
		expect(dots.lastRender()?.snapshot.dotOpacities[0]).toBeGreaterThan(0);
	});
});

describe("InterludeDotsBase - Phase and Mode Decision", () => {
	it("resolves to breathe when remaining body duration >= 3000ms", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 10000), time(2000), true, 0);
		expect(canDisplay).toBe(true);
	});

	it("resolves to fallback-hold when remaining body duration is in [910ms, 3000ms)", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 10000), time(6500), true, 0);
		expect(canDisplay).toBe(true);
	});

	it("stays idle when remaining body duration < 910ms", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 10000), time(8000), true, 0);
		expect(canDisplay).toBe(false);

		dots.update(dur(100));
		expect(dots.rendered).toHaveLength(0);
	});
});

describe("InterludeDotsBase - Fallback Hold Full Behavior", () => {
	it("executes entry, keeps scale at 1.0 with all dots lit, and exits smoothly", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(6500), true, 0);

		dots.update(dur(200));
		expect(dots.lastRender()?.snapshot.opacity).toBe(0);

		dots.update(dur(1300));
		const holdSnapshot = dots.lastRender()?.snapshot;
		expect(holdSnapshot?.opacity).toBe(1);
		expect(holdSnapshot?.scale).toBe(1.0);

		expect(holdSnapshot?.dotOpacities[0]).toBeCloseTo(0.9, 2);
		expect(holdSnapshot?.dotOpacities[1]).toBeCloseTo(0.9, 2);
		expect(holdSnapshot?.dotOpacities[2]).toBeCloseTo(0.9, 2);

		for (let step = 0; step < 9; step++) {
			dots.update(dur(100));
			const current = dots.lastRender()?.snapshot;
			expect(current?.scale).toBe(1.0);
			expect(current?.dotOpacities[0]).toBeCloseTo(0.9, 2);
			expect(current?.dotOpacities[1]).toBeCloseTo(0.9, 2);
			expect(current?.dotOpacities[2]).toBeCloseTo(0.9, 2);
		}

		dots.update(dur(400));
		const exitPhase1 = dots.lastRender()?.snapshot;
		expect(exitPhase1?.isActive).toBe(true);
		expect(exitPhase1?.scale).toBeGreaterThan(1.0);
		expect(exitPhase1?.opacity).toBe(1);

		expect(exitPhase1?.dotOpacities[0]).toBeCloseTo(0.9, 2);
		expect(exitPhase1?.dotOpacities[2]).toBeCloseTo(0.9, 2);

		dots.update(dur(600));
		const exitPhase2 = dots.lastRender()?.snapshot;
		expect(exitPhase2?.isActive).toBe(true);
		expect(exitPhase2?.opacity).toBeLessThan(1.0);
		expect(exitPhase2?.opacity).toBeGreaterThan(0);

		dots.update(dur(200));
		expect(dots.lastRender()?.snapshot.isActive).toBe(false);
	});
});

describe("InterludeDotsBase - Breath Re-orchestration on Seek", () => {
	it("re-calculates cycles and starts scale smoothly from 1.0", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(4500), true, 0);

		dots.update(dur(500));
		expect(dots.lastRender()?.snapshot.scale).toBeCloseTo(1.0, 2);

		dots.update(dur(2000));
		expect(dots.lastRender()?.snapshot.scale).toBeGreaterThan(1.2);

		dots.update(dur(2000));
		expect(dots.lastRender()?.snapshot.scale).toBeCloseTo(1.0, 2);
	});
});

describe("InterludeDotsBase - Visual Progression and Invariants", () => {
	it("maintains monotonically non-decreasing container opacity during entry until reaching 1", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);

		let prevOpacity = 0;
		for (let ms = 0; ms <= 300; ms += 20) {
			dots.update(dur(ms === 0 ? 0 : 20));
			const currentOpacity = dots.lastRender()?.snapshot.opacity ?? 0;
			expect(currentOpacity).toBeGreaterThanOrEqual(prevOpacity);
			expect(currentOpacity).toBeLessThanOrEqual(1);
			prevOpacity = currentOpacity;
		}

		expect(prevOpacity).toBe(1);
	});

	it("illuminates dots in strict left-to-right sequential order with valid opacity bounds", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 12000), time(0), false, -1);

		const samples: Array<readonly [number, number, number]> = [];
		for (let ms = 0; ms <= 8000; ms += 500) {
			dots.update(dur(ms === 0 ? 0 : 500));
			const opacities = dots.lastRender()?.snapshot.dotOpacities;
			if (opacities) {
				samples.push(opacities);
				for (const op of opacities) {
					expect(op).toBeGreaterThanOrEqual(0);
					expect(op).toBeLessThanOrEqual(1);
				}
			}
		}

		const phase1Sample = samples[4];
		expect(phase1Sample[0]).toBeGreaterThan(phase1Sample[1]);
		expect(phase1Sample[1]).toBe(phase1Sample[2]);

		const phase2Sample = samples[11];
		expect(phase2Sample[0]).toBeGreaterThan(phase2Sample[1]);
		expect(phase2Sample[1]).toBeGreaterThan(phase2Sample[2]);

		dots.update(dur(3500));
		const phase3 = dots.lastRender()?.snapshot.dotOpacities;
		expect(phase3?.[2]).toBeGreaterThan(phase1Sample[2]);
	});

	it("maintains scale within breathing bounds during main performance and connects smoothly to 1.0 before exit", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);

		let sawUpscale = false;
		for (let ms = 0; ms < 9000; ms += 250) {
			dots.update(dur(ms === 0 ? 0 : 250));
			const scale = dots.lastRender()?.snapshot.scale ?? 0;

			expect(scale).toBeGreaterThanOrEqual(0.999);
			expect(scale).toBeLessThanOrEqual(1.251);

			if (scale > 1.05) sawUpscale = true;
		}

		expect(sawUpscale).toBe(true);

		const transitionScale = dots.lastRender()?.snapshot.scale ?? 0;
		expect(transitionScale).toBeCloseTo(1.0, 2);
	});

	it("performs anticipation expansion followed by shrinkage and opacity fade-out during exit", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(0, 10000), time(0), false, -1);
		dots.update(dur(9000));

		dots.update(dur(500));
		const phase1 = dots.lastRender()?.snapshot;
		expect(phase1?.isActive).toBe(true);
		expect(phase1?.scale).toBeGreaterThan(1.0);
		expect(phase1?.opacity).toBe(1);
		expect(phase1?.dotOpacities[2]).toBeGreaterThan(0.8);

		dots.update(dur(400));
		const phase2 = dots.lastRender()?.snapshot;
		expect(phase2?.isActive).toBe(true);
		expect(phase2?.opacity).toBeLessThan(1.0);
		expect(phase2?.opacity).toBeGreaterThan(0);

		dots.update(dur(150));
		const finalFrame = dots.lastRender()?.snapshot;
		expect(finalFrame?.isActive).toBe(false);
		expect(finalFrame?.opacity).toBe(0);
	});
});

describe("InterludeDotsBase - Edge Cases and Robustness", () => {
	it("prevents ghost resurrection on subsequent normal playback ticks after hide", () => {
		const dots = new TestInterludeDots();

		const canDisplay = dots.setInterlude(range(0, 10000), time(8500), true, 0);
		expect(canDisplay).toBe(false);
		expect(dots.rendered).toHaveLength(0);

		const nextFrameCanDisplay = dots.setInterlude(
			range(0, 10000),
			time(8516),
			false,
			0,
		);

		expect(nextFrameCanDisplay).toBe(false);

		dots.update(dur(16));
		expect(dots.rendered).toHaveLength(0);
	});

	it("safely clamps when currentTime is before startTime", () => {
		const dots = new TestInterludeDots();

		dots.setInterlude(range(2000, 10000), time(500), true, -1);
		dots.update(dur(0));

		const snapshot = dots.lastRender()?.snapshot;
		expect(snapshot?.isActive).toBe(true);
		expect(snapshot?.opacity).toBe(0);
		expect(snapshot?.dotOpacities).toEqual([0, 0, 0]);
	});
});
