import { describe, expect, it } from "vitest";
import { Duration, MediaTime } from "../src/utils/time.ts";

describe("Duration", () => {
	it("converts between millis and seconds correctly", () => {
		const d1 = Duration.fromMillis(1500);
		expect(Duration.asMillis(d1)).toBe(1500);
		expect(Duration.asSecsF64(d1)).toBe(1.5);

		const d2 = Duration.fromSecs(2.5);
		expect(Duration.asMillis(d2)).toBe(2500);
		expect(Duration.asSecsF64(d2)).toBe(2.5);

		expect(Duration.isZero(Duration.ZERO)).toBe(true);
		expect(Duration.isZero(Duration.fromMillis(10))).toBe(false);
	});

	it("handles arithmetic operations", () => {
		const a = Duration.fromMillis(300);
		const b = Duration.fromMillis(200);

		const sum = Duration.add(a, b);
		expect(Duration.asMillis(sum)).toBe(500);

		const diff = Duration.sub(a, b);
		expect(Duration.asMillis(diff)).toBe(100);

		const scaled = Duration.mulF64(a, 2.5);
		expect(Duration.asMillis(scaled)).toBe(750);

		const ratio = Duration.divDuration(a, b);
		expect(ratio).toBe(1.5);
	});

	it("handles saturatingSub, min, max, clampPositive, isFinite", () => {
		const small = Duration.fromMillis(100);
		const big = Duration.fromMillis(500);

		expect(Duration.asMillis(Duration.saturatingSub(small, big))).toBe(0);
		expect(Duration.asMillis(Duration.saturatingSub(big, small))).toBe(400);

		expect(Duration.asMillis(Duration.min(small, big))).toBe(100);
		expect(Duration.asMillis(Duration.max(small, big))).toBe(500);

		const neg = Duration.fromMillis(-50);
		expect(Duration.asMillis(Duration.clampPositive(neg))).toBe(0);
		expect(Duration.asMillis(Duration.clampPositive(small))).toBe(100);

		expect(Duration.isFinite(Duration.fromMillis(100))).toBe(true);
		expect(
			Duration.isFinite(Duration.fromMillis(Number.POSITIVE_INFINITY)),
		).toBe(false);
	});
});

describe("MediaTime", () => {
	it("converts millis and handles affine algebra", () => {
		const t1 = MediaTime.fromMillis(1000);
		const t2 = MediaTime.fromMillis(2500);

		expect(MediaTime.asMillis(t1)).toBe(1000);
		expect(MediaTime.asMillis(t2)).toBe(2500);

		const span = MediaTime.since(t2, t1);
		expect(Duration.asMillis(span)).toBe(1500);

		const satSpan = MediaTime.saturatingSince(t1, t2);
		expect(Duration.asMillis(satSpan)).toBe(0);

		const d = Duration.fromMillis(500);
		const added = MediaTime.add(t1, d);
		expect(MediaTime.asMillis(added)).toBe(1500);

		const subbed = MediaTime.sub(t2, d);
		expect(MediaTime.asMillis(subbed)).toBe(2000);
	});

	it("handles min, max, cmp, round", () => {
		const t1 = MediaTime.fromMillis(1000.4);
		const t2 = MediaTime.fromMillis(2000.8);

		expect(MediaTime.asMillis(MediaTime.min(t1, t2))).toBe(1000.4);
		expect(MediaTime.asMillis(MediaTime.max(t1, t2))).toBe(2000.8);

		expect(MediaTime.cmp(t1, t2)).toBeLessThan(0);
		expect(MediaTime.cmp(t2, t1)).toBeGreaterThan(0);
		expect(MediaTime.cmp(t1, t1)).toBe(0);

		expect(MediaTime.asMillis(MediaTime.round(t1))).toBe(1000);
		expect(MediaTime.asMillis(MediaTime.round(t2))).toBe(2001);
	});
});
