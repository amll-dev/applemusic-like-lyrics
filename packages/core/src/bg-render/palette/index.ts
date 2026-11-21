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
import {
	buildColorHistogram,
	buildColorHistogramAsync,
	type HistogramSource,
} from "./histogram.ts";
import { createKMeansPalette, createThemeColor } from "./kmeans.ts";
import { createOctTreePalette } from "./octtree.ts";
import type {
	ColorCount,
	ColorVec3,
	PaletteIntent,
	PaletteResult,
} from "./types.ts";

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

/** 调色板结果是小对象，可以比直方图多留一些。 */
const PALETTE_CACHE_LIMIT = 32;

const paletteCache = new Map<string, PaletteResult>();
const paletteInFlight = new Map<string, Promise<PaletteResult>>();

function getPaletteCacheKey(
	source: HistogramSource,
	clusterCount: number,
	options: CreatePaletteOptions,
): string | null {
	if (!(source instanceof HTMLImageElement)) return null;
	const url = source.currentSrc || source.src;
	if (!url) return null;
	return [
		url,
		clusterCount,
		options.algorithm ?? "auto",
		options.ignoreWhite ? 1 : 0,
		options.toLab ? 1 : 0,
		options.useKMeansPP ? 1 : 0,
		options.intent ?? "accent",
		options.sampleSize ?? 64,
	].join("|");
}

function getCachedPalette(key: string): PaletteResult | null {
	const cached = paletteCache.get(key);
	if (!cached) return null;
	paletteCache.delete(key);
	paletteCache.set(key, cached);
	return cached;
}

function setCachedPalette(key: string, result: PaletteResult): void {
	paletteCache.set(key, result);
	while (paletteCache.size > PALETTE_CACHE_LIMIT) {
		const oldest = paletteCache.keys().next().value;
		if (oldest === undefined) break;
		paletteCache.delete(oldest);
	}
}

/** 返回副本：调用方原地改调色板不应污染缓存。 */
function clonePaletteResult(result: PaletteResult): PaletteResult {
	return {
		palette: result.palette.map(
			([red, green, blue]): ColorVec3 => [red, green, blue],
		),
		paletteIsDark: result.paletteIsDark,
		themeColor: {
			color: [
				result.themeColor.color[0],
				result.themeColor.color[1],
				result.themeColor.color[2],
			],
			colorIsDark: result.themeColor.colorIsDark,
		},
	};
}

/**
 * 从图像资源提取指定数量的主色。
 *
 * 整个流程是同步的：封面会先被缩到 64×64 再统计，因此在主线程上通常只需要几
 * 毫秒。
 *
 * 换歌 / 动画路径上请改用 {@link createPaletteFromImageAsync}，两者的取色
 * 结果一致，但异步版不会卡主线程。
 *
 * @param source 图像资源，可以是 img/video 元素、`ImageBitmap` 或 `ImageData`
 * @param clusterCount 需要的颜色数量，返回的调色板长度恒等于该值
 */
export function createPaletteFromImage(
	source: HistogramSource,
	clusterCount: number,
	options: CreatePaletteOptions = {},
): PaletteResult {
	const key = getPaletteCacheKey(source, clusterCount, options);
	if (key) {
		const cached = getCachedPalette(key);
		if (cached) return clonePaletteResult(cached);
	}

	const entries = buildColorHistogram(source, options.sampleSize);
	const result = createPaletteFromEntries(entries, clusterCount, options);
	if (key) setCachedPalette(key, clonePaletteResult(result));
	return result;
}

/** {@link createPaletteFromImage} 的异步版本，用于换歌等会掉帧的路径。 */
export function createPaletteFromImageAsync(
	source: HistogramSource,
	clusterCount: number,
	options: CreatePaletteOptions = {},
): Promise<PaletteResult> {
	const key = getPaletteCacheKey(source, clusterCount, options);
	if (key) {
		const cached = getCachedPalette(key);
		if (cached) return Promise.resolve(clonePaletteResult(cached));

		const inFlight = paletteInFlight.get(key);
		if (inFlight) return inFlight.then(clonePaletteResult);
	}

	const task = buildColorHistogramAsync(source, options.sampleSize).then(
		(entries) => {
			const result = createPaletteFromEntries(entries, clusterCount, options);
			if (key) setCachedPalette(key, clonePaletteResult(result));
			return result;
		},
	);

	if (key) {
		paletteInFlight.set(key, task);
		task.then(
			() => paletteInFlight.delete(key),
			() => paletteInFlight.delete(key),
		);
		return task.then(clonePaletteResult);
	}

	return task;
}

function createPaletteFromEntries(
	entries: ColorCount[],
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
	} = options;

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
