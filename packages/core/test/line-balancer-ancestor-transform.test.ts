// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LineBalancer } from "#utils/line-balancer.ts";

type BalanceAdapter = {
	resetDOM(): void;
	buildChildInfos(): {
		childInfos: Array<{ width: number; text: string; isSpace: boolean }>;
		fullText: string;
	};
	applyBreaks(breaks: number[]): void;
	needsCalibration: boolean;
};

function fixture(needsCalibration = false) {
	const bg = document.createElement("div");
	bg.style.transform = "translateY(20px) scale(0.8)";
	const line = document.createElement("div");
	line.style.transform = "scale(0.97)";
	const main = document.createElement("div");
	main.style.whiteSpace = "normal";
	bg.append(line);
	line.append(main);
	const width = () =>
		(bg.style.transform === "none" ? 1 : 0.8) *
		(line.style.transform === "none" ? 1 : 0.97) *
		600;
	const applyBreaks = vi.fn();
	const adapter: BalanceAdapter = {
		needsCalibration,
		resetDOM: vi.fn(),
		buildChildInfos: () => ({
			childInfos: [0, 1].map(() => ({
				width: needsCalibration ? 600 : width(),
				text: "lyrics ",
				isSpace: false,
			})),
			fullText: "lyrics lyrics ",
		}),
		applyBreaks,
	};
	const probe = new LineBalancer(main) as unknown as {
		executeLineBalance(
			width: number,
			adapter: BalanceAdapter,
			seg: Intl.Segmenter,
		): void;
	};
	return { bg, line, main, adapter, probe, applyBreaks, width };
}

describe("LineBalancer with scaled background ancestors", () => {
	afterEach(() => vi.restoreAllMocks());
	const segmenter = new Intl.Segmenter("en", { granularity: "word" });

	it.each([false, true])(
		"breaks overlong text under scale(0.8), calibrated=%s",
		(needsCalibration) => {
			const { bg, line, main, adapter, probe, applyBreaks, width } =
				fixture(needsCalibration);
			if (needsCalibration) {
				vi.spyOn(document, "createRange").mockImplementation(
					() =>
						({
							selectNodeContents() {},
							getBoundingClientRect: () => ({ width: 2 * width() }),
						}) as unknown as Range,
				);
			}
			probe.executeLineBalance(1000, adapter, segmenter);
			expect(applyBreaks).toHaveBeenCalledOnce();
			expect(applyBreaks.mock.calls[0]?.[0]).toEqual([1]);
			expect(bg.style.transform).toBe("translateY(20px) scale(0.8)");
			expect(line.style.transform).toBe("scale(0.97)");
			expect(main.style.whiteSpace).toBe("normal");
		},
	);

	it("restores both animation transforms when measurement throws", () => {
		const { bg, line, main, adapter, probe } = fixture();
		adapter.buildChildInfos = () => {
			throw new Error("measurement failure");
		};
		expect(() => probe.executeLineBalance(1000, adapter, segmenter)).toThrow(
			"measurement failure",
		);
		expect(bg.style.transform).toBe("translateY(20px) scale(0.8)");
		expect(line.style.transform).toBe("scale(0.97)");
		expect(main.style.whiteSpace).toBe("normal");
	});
});
