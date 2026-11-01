import { CalcMaskAnimator } from "./animator-calc.ts";
import { WebMaskAnimator } from "./animator-web.ts";
import type { LineMaskAnimator, MaskContext, MaskTargetWord } from "./types.ts";

export * from "./types.ts";

export function createLineMaskAnimator(
	words: ReadonlyArray<MaskTargetWord>,
	context: MaskContext,
): LineMaskAnimator {
	if (context.supportMaskImage) {
		return new WebMaskAnimator(words, context);
	} else {
		return new CalcMaskAnimator(words, context);
	}
}
