/**
 * @fileoverview
 * 八叉树量化取色器。
 *
 * 逐行移植自 Storyteller-Studios/Impressionist（MIT）的
 * `Impressionist/Implementations/OctTreePaletteGenerator.cs`，
 * 其本身衍生自 bacowan/cSharpColourQuantization。
 *
 * @see https://github.com/Storyteller-Studios/Impressionist/blob/master/Impressionist/Implementations/OctTreePaletteGenerator.cs
 */

import {
	paletteRgbLStarIsDark,
	paletteRgbLStarIsLight,
} from "./color-utilities.ts";
import { createThemeColor } from "./kmeans.ts";
import type {
	ColorCount,
	ColorVec3,
	PaletteIntent,
	PaletteResult,
	ThemeColorResult,
} from "./types.ts";

const MAX_COLOR_DEPTH = 8;

interface PaletteEntry {
	color: ColorVec3;
	sampleCount: number;
}

class OctreeNode {
	readonly children: (OctreeNode | null)[] = [
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
	];
	childCount = 0;
	leafNodeCount = 0;
	sampleCount = 0;
	private redSum = 0;
	private greenSum = 0;
	private blueSum = 0;

	constructor(
		private readonly owner: OctreePaletteQuantizer,
		readonly parentNode: OctreeNode | null,
		readonly indexInParent: number,
	) {}

	private get averageColor(): ColorVec3 {
		if (this.sampleCount === 0) return [0, 0, 0];
		return [
			this.redSum / this.sampleCount,
			this.greenSum / this.sampleCount,
			this.blueSum / this.sampleCount,
		];
	}

	addColor(
		red: number,
		green: number,
		blue: number,
		depth: number,
		sampleCount: number,
	): void {
		this.sampleCount += sampleCount;
		this.redSum += red * sampleCount;
		this.greenSum += green * sampleCount;
		this.blueSum += blue * sampleCount;

		if (depth === MAX_COLOR_DEPTH) {
			if (this.leafNodeCount === 0) this.leafNodeCount = 1;
			return;
		}

		const bitShift = 7 - depth;
		const childIndex =
			(((red >> bitShift) & 1) << 2) |
			(((green >> bitShift) & 1) << 1) |
			((blue >> bitShift) & 1);
		let childNode = this.children[childIndex];
		if (!childNode) {
			childNode = new OctreeNode(this.owner, this, childIndex);
			this.children[childIndex] = childNode;
			this.childCount++;
			this.owner.registerNodeAtDepth(childNode, depth);
		}

		const previousLeafNodeCount = childNode.leafNodeCount;
		childNode.addColor(red, green, blue, depth + 1, sampleCount);
		this.leafNodeCount += childNode.leafNodeCount - previousLeafNodeCount;
	}

	collectPaletteColors(result: PaletteEntry[]): void {
		if (this.leafNodeCount === 0) return;
		if (this.childCount === 0) {
			result.push({ color: this.averageColor, sampleCount: this.sampleCount });
			return;
		}
		for (const child of this.children) child?.collectPaletteColors(result);
	}

	mergeChildrenIntoThisNode(): void {
		if (this.childCount === 0 || this.leafNodeCount <= 1) return;

		const previousLeafNodeCount = this.leafNodeCount;
		this.children.fill(null);
		this.childCount = 0;
		this.leafNodeCount = this.sampleCount > 0 ? 1 : 0;

		const leafReduction = previousLeafNodeCount - this.leafNodeCount;
		let parentNode = this.parentNode;
		while (parentNode) {
			parentNode.leafNodeCount -= leafReduction;
			parentNode = parentNode.parentNode;
		}
	}

	/** 合并会把整棵子树摘掉，被摘掉的节点仍留在深度索引里，需要显式排除。 */
	isAttachedToRoot(): boolean {
		let currentNode: OctreeNode = this;
		while (currentNode.parentNode) {
			if (
				currentNode.parentNode.children[currentNode.indexInParent] !==
				currentNode
			) {
				return false;
			}
			currentNode = currentNode.parentNode;
		}
		return true;
	}
}

class OctreePaletteQuantizer {
	private readonly rootNode: OctreeNode = new OctreeNode(this, null, -1);
	private readonly nodesByDepth: OctreeNode[][] = Array.from(
		{ length: MAX_COLOR_DEPTH },
		() => [],
	);

	registerNodeAtDepth(node: OctreeNode, depth: number): void {
		this.nodesByDepth[depth].push(node);
	}

	addColor(color: ColorVec3, sampleCount: number): void {
		if (sampleCount <= 0) return;
		this.rootNode.addColor(
			color[0] & 0xff,
			color[1] & 0xff,
			color[2] & 0xff,
			0,
			sampleCount,
		);
	}

	getPalette(maxColorCount: number): ColorVec3[] {
		if (maxColorCount <= 0 || this.rootNode.leafNodeCount === 0) return [];

		const paletteColors: PaletteEntry[] = [];
		this.rootNode.collectPaletteColors(paletteColors);

		if (paletteColors.length <= maxColorCount) {
			return paletteColors.map((entry) => entry.color);
		}

		paletteColors.sort((left, right) => {
			const bySampleCount = right.sampleCount - left.sampleCount;
			if (bySampleCount !== 0) return bySampleCount;
			if (left.color[0] !== right.color[0]) {
				return left.color[0] - right.color[0];
			}
			if (left.color[1] !== right.color[1]) {
				return left.color[1] - right.color[1];
			}
			return left.color[2] - right.color[2];
		});

		return paletteColors
			.slice(0, Math.min(maxColorCount, paletteColors.length))
			.map((entry) => entry.color);
	}

	reduceToColorCount(targetColorCount: number): void {
		if (targetColorCount <= 0) return;

		let remainingLeafReduction = this.rootNode.leafNodeCount - targetColorCount;
		if (remainingLeafReduction <= 0) return;

		for (
			let depth = MAX_COLOR_DEPTH - 2;
			depth >= 0 && remainingLeafReduction > 0;
			depth--
		) {
			const nodesAtDepth = this.nodesByDepth[depth];
			nodesAtDepth.sort((left, right) => {
				const byLeafCount = left.leafNodeCount - right.leafNodeCount;
				if (byLeafCount !== 0) return byLeafCount;
				return left.sampleCount - right.sampleCount;
			});

			for (
				let i = 0;
				i < nodesAtDepth.length && remainingLeafReduction > 0;
				i++
			) {
				const candidate = nodesAtDepth[i];
				if (candidate.childCount === 0) continue;
				const leafReduction = candidate.leafNodeCount - 1;
				if (leafReduction <= 0) continue;
				if (leafReduction > remainingLeafReduction) continue;
				remainingLeafReduction -= leafReduction;
				candidate.mergeChildrenIntoThisNode();
			}
		}

		while (this.rootNode.leafNodeCount > targetColorCount) {
			const candidate = this.findBestMergeCandidate();
			if (!candidate) break;
			candidate.mergeChildrenIntoThisNode();
		}
	}

	private findBestMergeCandidate(): OctreeNode | null {
		let bestCandidate: OctreeNode | null = null;
		let bestLeafReduction = Number.POSITIVE_INFINITY;
		let bestSampleCount = Number.POSITIVE_INFINITY;

		for (let depth = MAX_COLOR_DEPTH - 2; depth >= 0; depth--) {
			for (const candidate of this.nodesByDepth[depth]) {
				if (!candidate.isAttachedToRoot()) continue;
				if (candidate.childCount === 0) continue;
				const leafReduction = candidate.leafNodeCount - 1;
				if (leafReduction <= 0) continue;
				if (
					leafReduction < bestLeafReduction ||
					(leafReduction === bestLeafReduction &&
						candidate.sampleCount < bestSampleCount)
				) {
					bestCandidate = candidate;
					bestLeafReduction = leafReduction;
					bestSampleCount = candidate.sampleCount;
				}
			}
		}

		return bestCandidate;
	}
}

/**
 * 生成调色板，对应 C# 的 `OctTreePaletteGenerator.CreatePalette`。
 *
 * `intent` 见 {@link PaletteIntent}：默认的 `"accent"` 沿用 Impressionist 的行为，
 * 铺满全屏的背景应当传 `"dominant"`。
 */
export function createOctTreePalette(
	sourceColors: readonly ColorCount[],
	clusterCount: number,
	themeColor: ThemeColorResult = createThemeColor(sourceColors, false, true),
	ignoreWhite = false,
	intent: PaletteIntent = "accent",
): PaletteResult {
	const quantizer = new OctreePaletteQuantizer();
	const effectiveIgnoreWhite = sourceColors.length === 1 ? false : ignoreWhite;

	const filteredEntries = sourceColors.filter((entry) => {
		const [r, g, b] = entry.color;
		if (effectiveIgnoreWhite && r > 250 && g > 250 && b > 250) return false;
		// 明暗过滤是强调色的取向，dominant 下只剩上面的忽略纯白
		if (intent === "dominant") return true;
		return themeColor.colorIsDark
			? paletteRgbLStarIsDark(entry.color)
			: paletteRgbLStarIsLight(entry.color);
	});
	const entries = filteredEntries.length > 0 ? filteredEntries : sourceColors;

	for (const entry of entries) quantizer.addColor(entry.color, entry.count);
	quantizer.reduceToColorCount(clusterCount);
	const quantizeResult = quantizer.getPalette(clusterCount);

	let palette: ColorVec3[];
	if (quantizeResult.length < clusterCount) {
		palette = [];
		for (let i = 0; i < clusterCount; i++) {
			palette.push(
				quantizeResult.length > 0
					? [...quantizeResult[i % quantizeResult.length]]
					: [0, 0, 0],
			);
		}
	} else {
		palette = quantizeResult;
	}

	return { palette, paletteIsDark: themeColor.colorIsDark, themeColor };
}
