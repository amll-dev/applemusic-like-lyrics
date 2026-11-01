import { describe, expect, it } from "vitest";
import { createAutoPalette } from "../src/bg-render/palette/auto.ts";
import {
	paletteRgbLStarIsDark,
	paletteRgbLStarIsLight,
	rgbToLab,
} from "../src/bg-render/palette/color-utilities.ts";
import {
	createKMeansPalette,
	createRandom,
	createThemeColor,
	seedFromHistogram,
} from "../src/bg-render/palette/kmeans.ts";
import { createOctTreePalette } from "../src/bg-render/palette/octtree.ts";
import type {
	ColorCount,
	ColorVec3,
	PaletteIntent,
} from "../src/bg-render/palette/types.ts";

const CLUSTER_COUNT = 4;

function distinct(palette: readonly ColorVec3[]): number {
	return new Set(palette.map((color) => color.join(","))).size;
}

function hex(value: string): ColorVec3 {
	const n = Number.parseInt(value.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * 沿对角线在若干色标之间线性渐变，再统计直方图。
 *
 * 直接手写几条直方图项复现不出问题：真实封面缩到 64×64 之后有上百个相近颜色，
 * 八叉树正是在这种分布上退化的。
 */
function gradientHistogram(stops: string[], size = 64): ColorCount[] {
	const colors = stops.map(hex);
	const counts = new Map<number, number>();
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const t = (x + y) / (2 * (size - 1));
			const seg = Math.min(
				colors.length - 2,
				Math.floor(t * (colors.length - 1)),
			);
			const f = t * (colors.length - 1) - seg;
			const from = colors[seg];
			const to = colors[seg + 1];
			const key =
				(Math.round(from[0] + (to[0] - from[0]) * f) << 16) |
				(Math.round(from[1] + (to[1] - from[1]) * f) << 8) |
				Math.round(from[2] + (to[2] - from[2]) * f);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return Array.from(counts, ([key, count]) => ({
		color: [(key >> 16) & 255, (key >> 8) & 255, key & 255] as ColorVec3,
		count,
	}));
}

/** 按 {@link createAutoPalette} 内部同样的顺序复现两个候选，用来断言它选了哪个。 */
function candidates(
	entries: readonly ColorCount[],
	intent: PaletteIntent = "accent",
) {
	const random = createRandom(seedFromHistogram(entries));
	const themeColor = createThemeColor(entries, false, false, random);
	return {
		kmeans: createKMeansPalette(
			entries,
			CLUSTER_COUNT,
			themeColor,
			false,
			false,
			false,
			intent,
			random,
		),
		octTree: createOctTreePalette(
			entries,
			CLUSTER_COUNT,
			themeColor,
			false,
			intent,
		),
	};
}

/** 调色板在 LAB 空间到自身质心的平均平方距离，与 auto 内部的判据一致。 */
function diversity(palette: readonly ColorVec3[]): number {
	const lab = palette.map(rgbToLab);
	const centroid = [0, 1, 2].map(
		(i) => lab.reduce((sum, v) => sum + v[i], 0) / lab.length,
	);
	return (
		lab.reduce(
			(sum, v) =>
				sum +
				(v[0] - centroid[0]) ** 2 +
				(v[1] - centroid[1]) ** 2 +
				(v[2] - centroid[2]) ** 2,
			0,
		) / lab.length
	);
}

const PASTEL = gradientHistogram(["#ffe8f0", "#ffd9a8", "#cfe9ff", "#e8ffe2"]);
const DARK = gradientHistogram(["#1a1026", "#3b1f2b", "#0d1b2a", "#241a12"]);
/** 红与蓝的 L* 都是 55.9，正好卡在 (40, 60) 这条明暗过滤两头不靠的死区里。 */
const VIVID = gradientHistogram(["#ff2d55", "#ffcc00", "#0a84ff", "#30d158"]);

describe("createAutoPalette", () => {
	it("亮色封面上不会选中被重复填充的调色板", () => {
		const { kmeans, octTree } = candidates(PASTEL);
		// 前提：这张图上八叉树确实凑不满，K-Means 能凑满
		expect(distinct(octTree.palette)).toBeLessThan(CLUSTER_COUNT);
		expect(distinct(kmeans.palette)).toBe(CLUSTER_COUNT);

		const auto = createAutoPalette(PASTEL, CLUSTER_COUNT);
		// 重复色会拉低分散度，原先的亮色分支「偏好更聚拢」正好会选中退化的那支
		expect(distinct(auto.palette)).toBe(CLUSTER_COUNT);
		expect(auto.palette).toEqual(kmeans.palette);
	});

	it("颜色数打平时仍按分散度择优，只做挑选不合成新色", () => {
		const { kmeans, octTree } = candidates(DARK);
		expect(distinct(kmeans.palette)).toBe(distinct(octTree.palette));

		const auto = createAutoPalette(DARK, CLUSTER_COUNT);
		expect([kmeans.palette, octTree.palette]).toContainEqual(auto.palette);
	});

	it("两个候选都凑不满时如实返回重复色", () => {
		const solid: ColorCount[] = [{ color: [200, 180, 160], count: 4096 }];
		const auto = createAutoPalette(solid, CLUSTER_COUNT);
		expect(auto.palette).toHaveLength(CLUSTER_COUNT);
		expect(distinct(auto.palette)).toBe(1);
	});
});

describe("intent", () => {
	/** 蓝到一眼能看出来：蓝通道明显压过另外两个。 */
	const isBluish = (color: ColorVec3) =>
		color[2] > color[0] + 40 && color[2] > color[1];
	const BLUE: ColorVec3 = [10, 132, 255];
	const VIVID_THEME = {
		color: [135, 162, 121] as ColorVec3,
		colorIsDark: false,
	};

	it("默认丢弃中间调，封面里的蓝色整段消失", () => {
		// 前提：这张封面的蓝两头不靠，既不算亮也不算暗
		expect(paletteRgbLStarIsLight(BLUE)).toBe(false);
		expect(paletteRgbLStarIsDark(BLUE)).toBe(false);

		const kept = createAutoPalette(VIVID, CLUSTER_COUNT);
		expect(kept.palette.some(isBluish)).toBe(false);
	});

	it("关掉之后蓝色能进调色板", () => {
		const all = createAutoPalette(
			VIVID,
			CLUSTER_COUNT,
			false,
			false,
			false,
			"dominant",
		);
		expect(all.palette.some(isBluish)).toBe(true);
	});

	it("K-Means 认这个开关", () => {
		const kept = createKMeansPalette(VIVID, CLUSTER_COUNT, VIVID_THEME);
		const all = createKMeansPalette(
			VIVID,
			CLUSTER_COUNT,
			VIVID_THEME,
			false,
			false,
			false,
			"dominant",
		);
		expect(kept.palette.some(isBluish)).toBe(false);
		expect(all.palette.some(isBluish)).toBe(true);
	});

	it("八叉树认这个开关", () => {
		const kept = createOctTreePalette(VIVID, CLUSTER_COUNT, VIVID_THEME);
		const all = createOctTreePalette(
			VIVID,
			CLUSTER_COUNT,
			VIVID_THEME,
			false,
			"dominant",
		);
		expect(kept.palette.some(isBluish)).toBe(false);
		expect(all.palette.some(isBluish)).toBe(true);
	});
});

describe("intent 对择优的影响", () => {
	it("accent 在亮色封面上取更聚拢的一支，dominant 反过来", () => {
		// VIVID 两支的颜色数打平，只能由分散度决定，正好拿来分辨两种取向
		const accent = candidates(VIVID, "accent");
		expect(distinct(accent.kmeans.palette)).toBe(
			distinct(accent.octTree.palette),
		);
		const accentLess =
			diversity(accent.kmeans.palette) <= diversity(accent.octTree.palette)
				? accent.kmeans
				: accent.octTree;
		expect(createAutoPalette(VIVID, CLUSTER_COUNT).palette).toEqual(
			accentLess.palette,
		);

		const dominant = candidates(VIVID, "dominant");
		expect(distinct(dominant.kmeans.palette)).toBe(
			distinct(dominant.octTree.palette),
		);
		const dominantMore =
			diversity(dominant.kmeans.palette) >= diversity(dominant.octTree.palette)
				? dominant.kmeans
				: dominant.octTree;
		expect(
			createAutoPalette(VIVID, CLUSTER_COUNT, false, false, false, "dominant")
				.palette,
		).toEqual(dominantMore.palette);
	});

	it("dominant 下暗色封面同样取更分散的一支", () => {
		const { kmeans, octTree } = candidates(DARK, "dominant");
		const more =
			diversity(kmeans.palette) >= diversity(octTree.palette)
				? kmeans
				: octTree;
		expect(
			createAutoPalette(DARK, CLUSTER_COUNT, false, false, false, "dominant")
				.palette,
		).toEqual(more.palette);
	});
});
