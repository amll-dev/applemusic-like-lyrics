import { describe, expect, it } from "vitest";
import { SeekDetector } from "#lyric/base/seek-detector.ts";
import { MediaTime } from "#utils/time.ts";

function makeDetector() {
	let wall = 0;
	const detector = new SeekDetector(() => wall);

	return {
		detector,
		push(mediaMs: number, wallDeltaMs: number, isPlaying = true): boolean {
			wall += wallDeltaMs;
			return detector.detect(MediaTime.fromMillis(mediaMs), isPlaying);
		},
	};
}

describe("SeekDetector baseline", () => {
	it("does not report a seek before it has an anchor to compare against", () => {
		const { push } = makeDetector();

		expect(push(0, 0)).toBe(false);
	});

	it("does not report a seek on the first push after a reset", () => {
		const { detector, push } = makeDetector();

		push(0, 0);
		expect(push(16, 16)).toBe(false);

		detector.reset();
		expect(push(32, 16)).toBe(false);
	});

	it("re-anchors on reset instead of comparing against the stale baseline", () => {
		const { detector, push } = makeDetector();

		push(0, 0);
		push(16, 16);

		detector.reset();
		push(60000, 16);

		expect(push(60016, 16)).toBe(false);
	});
});

describe("SeekDetector continuous playback", () => {
	it("does not flag normal playback at animation frame cadence", () => {
		const { push } = makeDetector();

		push(0, 0);
		for (let i = 1; i <= 120; i++) {
			expect(push(i * 16, 16)).toBe(false);
		}
	});

	it("does not flag playback pushed at a coarse cadence", () => {
		const { push } = makeDetector();

		push(0, 0);
		for (let i = 1; i <= 20; i++) {
			expect(push(i * 250, 250)).toBe(false);
		}
	});

	it("does not flag faster than realtime playback at frame cadence", () => {
		for (const rate of [2, 4, 8]) {
			const { push } = makeDetector();
			push(0, 0);
			for (let i = 1; i <= 120; i++) {
				expect(push(i * 16 * rate, 16)).toBe(false);
			}
		}
	});

	it("does not flag slower than realtime playback", () => {
		const { push } = makeDetector();

		push(0, 0);
		for (let i = 1; i <= 120; i++) {
			expect(push(i * 8, 16)).toBe(false);
		}
	});
});

describe("SeekDetector stalled progress", () => {
	it("treats an unchanged progress push as a seek", () => {
		const { push } = makeDetector();

		push(1000, 0);
		push(1016, 16);

		expect(push(1016, 16)).toBe(true);
	});

	it("keeps reporting seeks while the host holds one progress value", () => {
		const { push } = makeDetector();

		push(1000, 0);
		for (let i = 0; i < 10; i++) {
			expect(push(1000, 16)).toBe(true);
		}
	});

	it("reports a coarsely quantized progress source as seeking", () => {
		const { push } = makeDetector();

		push(0, 0);
		let flagged = 0;
		for (let frame = 1; frame <= 240; frame++) {
			if (push(Math.floor((frame * 16) / 250) * 250, 16)) flagged++;
		}

		expect(flagged).toBeGreaterThan(200);
	});

	it("returns to normal derivation once progress advances again", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(1000, 16)).toBe(true);
		expect(push(1016, 16)).toBe(false);
	});
});

describe("SeekDetector regression", () => {
	it("always flags backward progress, however small", () => {
		const { push } = makeDetector();

		push(1000, 0);
		push(1016, 16);
		expect(push(1015, 16)).toBe(true);
	});

	it("flags backward progress even when the wall clock has run far ahead", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(500, 10000)).toBe(true);
	});
});

describe("SeekDetector while paused", () => {
	it("flags a forward change beyond the jitter tolerance", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(1500, 16, false)).toBe(true);
	});

	it("does not flag a forward change within the jitter tolerance", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(1100, 16, false)).toBe(false);
	});

	it("judges by the jitter tolerance alone, regardless of how long the pause lasted", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(1500, 300000, false)).toBe(true);
	});

	it("still flags backward progress", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(999, 16, false)).toBe(true);
	});

	it("does not flag frame cadence playback pushed while marked as paused", () => {
		const { push } = makeDetector();

		push(0, 0);
		for (let i = 1; i <= 120; i++) {
			expect(push(i * 16, 16, false)).toBe(false);
		}
	});
});

describe("SeekDetector forward jumps", () => {
	it("flags a forward jump that outruns the wall clock", () => {
		const { push } = makeDetector();

		push(0, 0);
		push(16, 16);
		expect(push(30016, 16)).toBe(true);
	});

	it("does not flag a forward jump smaller than the jitter tolerance", () => {
		const { push } = makeDetector();

		push(0, 0);
		push(16, 16);
		expect(push(116, 16)).toBe(false);
	});

	it("returns to normal derivation on the frame after a jump", () => {
		const { push } = makeDetector();

		push(0, 0);
		expect(push(30000, 16)).toBe(true);
		expect(push(30016, 16)).toBe(false);
	});
});

describe("SeekDetector gaps in pushes", () => {
	function afterGap(resumeAt: number) {
		const { push } = makeDetector();

		push(0, 0);
		for (let i = 1; i <= 60; i++) {
			push(i * 16, 16);
		}

		return push(resumeAt, 300000);
	}

	it("does not flag a gap whose first push advanced normally", () => {
		expect(afterGap(960 + 16)).toBe(false);
	});

	it("still flags a large forward jump performed during the gap", () => {
		expect(afterGap(240000)).toBe(true);
	});

	it("bounds how much a gap can hide", () => {
		expect(afterGap(960 + 5000)).toBe(true);
	});

	it("misses a jump smaller than the trusted gap", () => {
		expect(afterGap(960 + 500)).toBe(false);
	});

	it("flags a gap that ended on the very same progress value", () => {
		expect(afterGap(960)).toBe(true);
	});
});

describe("SeekDetector degenerate input", () => {
	it("judges by the jitter tolerance alone when no wall time has elapsed", () => {
		const { push } = makeDetector();

		push(1000, 0);
		expect(push(1050, 0)).toBe(false);
		expect(push(5000, 0)).toBe(true);
	});
});
