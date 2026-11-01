/**
 * @fileoverview
 * 从专辑封面提取主色调色板。
 *
 * 移植自 Storyteller-Studios/Impressionist（MIT），
 * 详见各实现文件顶部的说明。
 *
 * Isolation 渲染器需要四个主色来构造渐变，这个模块就是它的供色来源；
 * 其它需要「封面主色」的场景也可以直接复用。
 */

export { createAutoPalette } from "./auto.ts";
export {
	channelToLinear,
	hsvToRgb,
	labToRgb,
	labToXyz,
	paletteRgbLStarIsDark,
	paletteRgbLStarIsLight,
	rgbLStarIsDark,
	rgbToHsv,
	rgbToLab,
	rgbToXyz,
	srgbToOkLab,
	xyzToLab,
	xyzToRgb,
	yToLStar,
} from "./color-utilities.ts";
export type { HistogramSource } from "./histogram.ts";
export { buildColorHistogram } from "./histogram.ts";
export { createKMeansPalette, createThemeColor } from "./kmeans.ts";
export { createOctTreePalette } from "./octtree.ts";
export type {
	ColorCount,
	ColorVec3,
	HSVColor,
	PaletteIntent,
	PaletteResult,
	ThemeColorResult,
} from "./types.ts";

import { createAutoPalette } from "./auto.ts";
import { buildColorHistogram, type HistogramSource } from "./histogram.ts";
import { createKMeansPalette, createThemeColor } from "./kmeans.ts";
import { createOctTreePalette } from "./octtree.ts";
import type { PaletteIntent, PaletteResult } from "./types.ts";

/** 取色算法。 */
export type PaletteAlgorithm = "auto" | "kmeans" | "octtree";

/** {@link createPaletteFromImage} 的可选项。 */
export interface CreatePaletteOptions {
	/** 取色算法，默认 `"auto"`。 */
	algorithm?: PaletteAlgorithm;
	/** 是否忽略接近纯白的颜色，默认 `false`。 */
	ignoreWhite?: boolean;
	/** K-Means 是否在 LAB 空间聚类，默认 `false`。 */
	toLab?: boolean;
	/** K-Means 是否使用 K-Means++ 初始化，默认 `false`。 */
	useKMeansPP?: boolean;
	/** 调色板的用途，默认 `"accent"`。见 {@link PaletteIntent}。 */
	intent?: PaletteIntent;
	/** 统计直方图前缩放到的最长边像素数，默认 64。 */
	sampleSize?: number;
}

/**
 * 从图像资源提取指定数量的主色。
 *
 * 整个流程是同步的：封面会先被缩到 64×64 再统计，因此在主线程上通常只需要几
 * 毫秒，不值得为它单独开一个 Worker。
 *
 * @param source 图像资源，可以是 img/video 元素、`ImageBitmap` 或 `ImageData`
 * @param clusterCount 需要的颜色数量，返回的调色板长度恒等于该值
 */
export function createPaletteFromImage(
	source: HistogramSource,
	clusterCount: number,
	options: CreatePaletteOptions = {},
): PaletteResult {
	const normalizedClusterCount = Math.max(0, Math.floor(clusterCount));
	const {
		algorithm = "auto",
		ignoreWhite = false,
		toLab = false,
		useKMeansPP = false,
		intent = "accent",
		sampleSize,
	} = options;

	const entries = buildColorHistogram(source, sampleSize);
	if (entries.length === 0) {
		const themeColor = {
			color: [0, 0, 0] as [number, number, number],
			colorIsDark: true,
		};
		return {
			palette: Array.from(
				{ length: normalizedClusterCount },
				() => [0, 0, 0] as [number, number, number],
			),
			paletteIsDark: true,
			themeColor,
		};
	}

	switch (algorithm) {
		case "kmeans": {
			const themeColor = createThemeColor(entries, ignoreWhite, toLab);
			return createKMeansPalette(
				entries,
				normalizedClusterCount,
				themeColor,
				ignoreWhite,
				toLab,
				useKMeansPP,
				intent,
			);
		}
		case "octtree": {
			const themeColor = createThemeColor(entries, ignoreWhite, true);
			return createOctTreePalette(
				entries,
				normalizedClusterCount,
				themeColor,
				ignoreWhite,
				intent,
			);
		}
		default:
			return createAutoPalette(
				entries,
				normalizedClusterCount,
				ignoreWhite,
				toLab,
				useKMeansPP,
				intent,
			);
	}
}
