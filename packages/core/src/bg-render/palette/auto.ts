/**
 * @fileoverview
 * 自动在 K-Means 与八叉树两种取色结果之间择优。
 *
 * 逐行移植自 Storyteller-Studios/Impressionist（MIT）的
 * `Impressionist/Implementations/AutoPaletteGenerator.cs`。
 *
 * @see https://github.com/Storyteller-Studios/Impressionist/blob/master/Impressionist/Implementations/AutoPaletteGenerator.cs
 */

import { rgbToLab } from "./color-utilities.ts";
import {
	createKMeansPalette,
	createRandom,
	createThemeColor,
	seedFromHistogram,
} from "./kmeans.ts";
import { createOctTreePalette } from "./octtree.ts";
import type {
	ColorCount,
	ColorVec3,
	PaletteIntent,
	PaletteResult,
} from "./types.ts";

/** 调色板在 LAB 空间里到自身质心的平均平方距离，用来衡量色彩分散程度。 */
function calculateSpatialDiversity(palette: readonly ColorVec3[]): number {
	if (palette.length === 0) return 0;

	const labVectors = palette.map(rgbToLab);
	let centroidL = 0;
	let centroidA = 0;
	let centroidB = 0;
	for (const [l, a, b] of labVectors) {
		centroidL += l;
		centroidA += a;
		centroidB += b;
	}
	centroidL /= labVectors.length;
	centroidA /= labVectors.length;
	centroidB /= labVectors.length;

	let sumSquaredDistances = 0;
	for (const [l, a, b] of labVectors) {
		const dl = l - centroidL;
		const da = a - centroidA;
		const db = b - centroidB;
		sumSquaredDistances += dl * dl + da * da + db * db;
	}
	return sumSquaredDistances / labVectors.length;
}

/**
 * 调色板里互不相同的颜色数量。
 *
 * 两个生成器在候选颜色凑不满 `clusterCount` 时都会用 `i % length` 重复填充，
 * 重复的是精确副本，所以按精确相等去重即可。
 */
function countDistinctColors(palette: readonly ColorVec3[]): number {
	return new Set(palette.map((color) => color.join(","))).size;
}

/**
 * 同时跑两种取色算法并择优：暗色调色板偏好更分散的结果，亮色调色板反之偏好
 * 更聚拢的结果（八叉树在亮色上容易退化成一片惨白，所以 0 分散度直接判负）。
 *
 * 但分散度只在两者给出同样多的颜色时才有可比性。调用方要几个色就是几个色，被
 * 重复填充凑满的结果对任何按数量取色的用法都是退化的 —— 拿去做多点渐变会直接
 * 塌成两色平铺 —— 而重复恰恰会拉低分散度，于是在亮色分支里被当成「更聚拢」选
 * 中。所以先比互不相同的颜色数，同数时才轮到原本的分散度规则。
 *
 * 「亮色偏好更聚拢」同样是强调色的取向：强调色散得没有章法不好用，但背景要的正
 * 是封面的颜色跨度，更分散才更像那张封面。所以 `intent` 为 `"dominant"` 时一律
 * 取更分散的一支，不再分明暗两套。见 {@link PaletteIntent}。
 */
export function createAutoPalette(
	sourceColors: readonly ColorCount[],
	clusterCount: number,
	ignoreWhite = false,
	toLab = false,
	useKMeansPP = false,
	intent: PaletteIntent = "accent",
): PaletteResult {
	const random = createRandom(seedFromHistogram(sourceColors));
	const themeColor = createThemeColor(sourceColors, ignoreWhite, toLab, random);
	const kmeansResult = createKMeansPalette(
		sourceColors,
		clusterCount,
		themeColor,
		ignoreWhite,
		toLab,
		useKMeansPP,
		intent,
		random,
	);
	const octTreeResult = createOctTreePalette(
		sourceColors,
		clusterCount,
		themeColor,
		ignoreWhite,
		intent,
	);

	const kMeansDistinct = countDistinctColors(kmeansResult.palette);
	const octTreeDistinct = countDistinctColors(octTreeResult.palette);
	if (kMeansDistinct !== octTreeDistinct) {
		return kMeansDistinct > octTreeDistinct ? kmeansResult : octTreeResult;
	}

	const kMeansDiversity = calculateSpatialDiversity(kmeansResult.palette);
	const octTreeDiversity = calculateSpatialDiversity(octTreeResult.palette);

	if (intent === "dominant" || kmeansResult.paletteIsDark) {
		return kMeansDiversity >= octTreeDiversity ? kmeansResult : octTreeResult;
	}
	return kMeansDiversity <= octTreeDiversity || octTreeDiversity === 0
		? kmeansResult
		: octTreeResult;
}
