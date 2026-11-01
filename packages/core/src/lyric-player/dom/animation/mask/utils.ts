const bright = "rgb(0 0 0 / var(--bright-mask-alpha, 1))";
const dark = "rgb(0 0 0 / var(--dark-mask-alpha, 1))";

export function generateFadeGradient(
	width: number,
): readonly [gradient: string, totalAspect: number] {
	const totalAspect = 2 + width;
	const halfFadePercent = (width / totalAspect) * 50;
	const leftPercent = 50 - halfFadePercent;
	const rightPercent = 50 + halfFadePercent;

	return [
		`linear-gradient(to right, ${bright} ${leftPercent}%, ${dark} ${rightPercent}%)`,
		totalAspect,
	] as const;
}
