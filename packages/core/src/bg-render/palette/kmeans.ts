/**
 * @fileoverview
 * K-Means 取色器。
 *
 * 逐行移植自 Storyteller-Studios/Impressionist（MIT）的
 * `Impressionist/Implementations/KMeansPaletteGenerator.cs`，
 * 其本身衍生自 wieslawsoltes/PaletteGenerator。
 *
 * 与原实现的唯一差异是随机源：原版用全局 `Random`，这里改用按直方图内容播种的
 * mulberry32，使得同一张封面每次都得到完全相同的调色板，避免重启应用后背景配色
 * 发生肉眼可见的漂移。
 *
 * @see https://github.com/Storyteller-Studios/Impressionist/blob/master/Impressionist/Implementations/KMeansPaletteGenerator.cs
 */

import {
	distanceSquared,
	labToRgb,
	paletteRgbLStarIsDark,
	paletteRgbLStarIsLight,
	rgbLStarIsDark,
	rgbToLab,
} from "./color-utilities.ts";
import type {
	ColorCount,
	ColorVec3,
	PaletteIntent,
	PaletteResult,
	ThemeColorResult,
} from "./types.ts";

/** 一个确定性的伪随机数发生器，返回 [0, 1) 区间的浮点数。 */
export type RandomSource = () => number;

/** mulberry32，短小且分布足够好。 */
export function createRandom(seed: number): RandomSource {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 由直方图内容派生一个稳定的种子。 */
export function seedFromHistogram(entries: readonly ColorCount[]): number {
	let hash = 0x811c9dc5;
	for (const { color, count } of entries) {
		for (const value of [...color, count]) {
			hash ^= Math.round(value) & 0xffff;
			hash = Math.imul(hash, 0x01000193) >>> 0;
		}
	}
	return hash >>> 0;
}

function isNotNearWhite(color: ColorVec3): boolean {
	return color.some((channel) => channel <= 250);
}

function filterOrFallback(
	entries: readonly ColorCount[],
	predicate: (entry: ColorCount) => boolean,
): ColorCount[] {
	const filtered = entries.filter(predicate);
	return filtered.length > 0 ? filtered : [...entries];
}

function clampRgb(color: ColorVec3): ColorVec3 {
	return color.map((channel) =>
		Math.min(255, Math.max(0, channel)),
	) as ColorVec3;
}

/** 把同色项合并计数，等价于 C# 里的 `GroupBy(...).ToDictionary(...)`。 */
function groupColors(entries: readonly ColorCount[]): ColorCount[] {
	const grouped = new Map<string, ColorCount>();
	for (const entry of entries) {
		const key = `${entry.color[0]},${entry.color[1]},${entry.color[2]}`;
		const existing = grouped.get(key);
		if (existing) existing.count += entry.count;
		else grouped.set(key, { color: [...entry.color], count: entry.count });
	}
	return [...grouped.values()];
}

function toLabEntries(entries: readonly ColorCount[]): ColorCount[] {
	return entries.map((entry) => ({
		color: rgbToLab(entry.color),
		count: entry.count,
	}));
}

function colorsEqual(a: ColorVec3, b: ColorVec3): boolean {
	return a.every((value, i) => value === b[i]);
}

function findNearestCenterIndex(
	color: ColorVec3,
	centers: readonly ColorVec3[],
): number {
	let nearestIndex = 0;
	let minDist = Number.POSITIVE_INFINITY;
	for (let i = 0; i < centers.length; i++) {
		const dist = distanceSquared(color, centers[i]);
		if (dist < minDist) {
			nearestIndex = i;
			minDist = dist;
		}
	}
	return nearestIndex;
}

function findFarthestColor(
	entries: readonly ColorCount[],
	centers: readonly ColorVec3[],
): ColorVec3 {
	let farthest: ColorVec3 = [0, 0, 0];
	let maxDistance = Number.NEGATIVE_INFINITY;
	for (const { color } of entries) {
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (const center of centers) {
			const dist = distanceSquared(color, center);
			if (dist < nearestDistance) nearestDistance = dist;
		}
		if (nearestDistance > maxDistance) {
			maxDistance = nearestDistance;
			farthest = color;
		}
	}
	return farthest;
}

function kMeansPlusPlusCenters(
	entries: readonly ColorCount[],
	clusterCount: number,
	random: RandomSource,
): ColorVec3[] {
	const firstIndex = Math.floor(random() * entries.length);
	const selectedIndices = new Set([firstIndex]);
	const centers: ColorVec3[] = [entries[firstIndex].color];
	for (let i = 1; i < clusterCount; i++) {
		let accumulated = 0;
		const accDistances = new Float64Array(entries.length);
		for (let vectorId = 0; vectorId < entries.length; vectorId++) {
			const target = entries[vectorId].color;
			let minDistanceSquared = distanceSquared(centers[0], target);
			for (let clusterIdx = 1; clusterIdx < i; clusterIdx++) {
				const current = distanceSquared(centers[clusterIdx], target);
				if (current < minDistanceSquared) minDistanceSquared = current;
			}
			accumulated += minDistanceSquared * entries[vectorId].count;
			accDistances[vectorId] = accumulated;
		}
		if (accumulated <= Number.EPSILON) {
			const nextIndex = entries.findIndex(
				(_, index) => !selectedIndices.has(index),
			);
			if (nextIndex < 0) break;
			selectedIndices.add(nextIndex);
			centers.push(entries[nextIndex].color);
			continue;
		}

		const targetPoint = random() * accumulated;
		for (let vectorId = 0; vectorId < entries.length; vectorId++) {
			if (
				!selectedIndices.has(vectorId) &&
				accDistances[vectorId] >= targetPoint
			) {
				selectedIndices.add(vectorId);
				centers.push(entries[vectorId].color);
				break;
			}
		}
		if (centers.length === i) {
			const nextIndex = entries.findIndex(
				(_, index) => !selectedIndices.has(index),
			);
			if (nextIndex < 0) break;
			selectedIndices.add(nextIndex);
			centers.push(entries[nextIndex].color);
		}
	}
	return centers;
}

function kMeansCluster(
	entries: readonly ColorCount[],
	numClusters: number,
	useKMeansPP: boolean,
	random: RandomSource,
): ColorVec3[] {
	const clusterCount = Math.min(numClusters, entries.length);
	if (clusterCount <= 0) return [];

	let centers: ColorVec3[];
	if (useKMeansPP) {
		centers = kMeansPlusPlusCenters(entries, clusterCount, random);
	} else {
		// 等价于 C# 的 OrderByDescending(_ => random.Next()).Take(clusterCount)
		const shuffled = entries.map((entry) => entry.color);
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		centers = shuffled.slice(0, clusterCount);
	}

	const assignments = new Int32Array(entries.length);
	let changed = true;
	let iterations = 0;
	while (changed && iterations < 250) {
		changed = false;
		iterations++;

		for (let i = 0; i < entries.length; i++) {
			assignments[i] = findNearestCenterIndex(entries[i].color, centers);
		}

		for (let i = 0; i < clusterCount; i++) {
			let sumX = 0;
			let sumY = 0;
			let sumZ = 0;
			let weight = 0;
			for (let e = 0; e < entries.length; e++) {
				if (assignments[e] !== i) continue;
				const { color, count } = entries[e];
				sumX += color[0] * count;
				sumY += color[1] * count;
				sumZ += color[2] * count;
				weight += count;
			}
			if (weight === 0) {
				// 空簇：把中心挪到离现有中心最远的颜色上，下一轮重新分配
				centers[i] = findFarthestColor(entries, centers);
				changed = true;
				continue;
			}
			const newCenter: ColorVec3 = [
				sumX / weight,
				sumY / weight,
				sumZ / weight,
			];
			if (!colorsEqual(newCenter, centers[i])) {
				centers[i] = newCenter;
				changed = true;
			}
		}
	}

	return centers;
}

/** 计算主题色，对应 C# 的 `KMeansPaletteGenerator.CreateThemeColor`。 */
export function createThemeColor(
	sourceColors: readonly ColorCount[],
	ignoreWhite = false,
	toLab = false,
	random: RandomSource = createRandom(seedFromHistogram(sourceColors)),
): ThemeColorResult {
	let entries = [...sourceColors];
	if (ignoreWhite && entries.length > 1) {
		entries = filterOrFallback(entries, (entry) => isNotNearWhite(entry.color));
	}
	if (toLab) entries = toLabEntries(entries);
	entries = groupColors(entries);

	const centers = kMeansCluster(entries, 1, false, random);
	const first = centers[0] ?? ([0, 0, 0] as ColorVec3);
	const color = clampRgb(toLab ? labToRgb(first) : first);
	return { color, colorIsDark: rgbLStarIsDark(color) };
}

/**
 * 生成调色板，对应 C# 的 `KMeansPaletteGenerator.CreatePalette`。
 *
 * `intent` 见 {@link PaletteIntent}：默认的 `"accent"` 沿用 Impressionist 的行为，
 * 铺满全屏的背景应当传 `"dominant"`。
 */
export function createKMeansPalette(
	sourceColors: readonly ColorCount[],
	clusterCount: number,
	themeColor: ThemeColorResult,
	ignoreWhite = false,
	toLab = false,
	useKMeansPP = false,
	intent: PaletteIntent = "accent",
	random: RandomSource = createRandom(seedFromHistogram(sourceColors)),
): PaletteResult {
	let effectiveIgnoreWhite = ignoreWhite;
	let effectiveUseKMeansPP = useKMeansPP;
	if (sourceColors.length === 1) {
		effectiveIgnoreWhite = false;
		effectiveUseKMeansPP = false;
	}

	const colorIsDark = themeColor.colorIsDark;
	let entries = filterOrFallback(sourceColors, (entry) => {
		// 明暗过滤是强调色的取向，dominant 下只剩 ignoreWhite 那一层
		if (intent === "dominant") {
			return !effectiveIgnoreWhite || isNotNearWhite(entry.color);
		}
		if (colorIsDark) return paletteRgbLStarIsDark(entry.color);
		if (!effectiveIgnoreWhite) return paletteRgbLStarIsLight(entry.color);
		return paletteRgbLStarIsLight(entry.color) && isNotNearWhite(entry.color);
	});
	if (toLab) entries = toLabEntries(entries);
	entries = groupColors(entries);

	const centers = kMeansCluster(
		entries,
		clusterCount,
		effectiveUseKMeansPP,
		random,
	);
	const dominantColors = centers.map((center) =>
		clampRgb(toLab ? labToRgb(center) : center),
	);

	const palette: ColorVec3[] = [];
	for (let i = 0; i < clusterCount; i++) {
		// 颜色不够时只能重复填充，原实现也是这么处理的
		palette.push(
			dominantColors.length > 0
				? [...dominantColors[i % dominantColors.length]]
				: [0, 0, 0],
		);
	}
	return { palette, paletteIsDark: colorIsDark, themeColor };
}
