/**
 * @fileoverview
 * 从图像资源构建颜色直方图，作为取色器的输入。
 */

import { createOffscreenCanvas } from "#utils/canvas.ts";
import type { ColorCount, ColorVec3 } from "./types.ts";

/** 可以用来取色的图像资源。 */
export type HistogramSource =
	| HTMLImageElement
	| HTMLVideoElement
	| ImageBitmap
	| ImageData;

/**
 * 统计前先把图像缩到这个尺寸。
 *
 * 取色只关心整体色彩分布，64×64 已经足够，而且能把直方图规模压到几千项，
 * 让后续的 K-Means 在几毫秒内跑完。
 */
const DEFAULT_SAMPLE_SIZE = 64;

function toImageData(
	source: HistogramSource,
	sampleSize: number,
): ImageData | null {
	if (source instanceof ImageData) return source;

	const [sourceWidth, sourceHeight] =
		source instanceof HTMLVideoElement
			? [source.videoWidth, source.videoHeight]
			: source instanceof HTMLImageElement
				? [source.naturalWidth, source.naturalHeight]
				: [source.width, source.height];
	if (sourceWidth <= 0 || sourceHeight <= 0) return null;

	const normalizedSampleSize = Math.max(1, Math.floor(sampleSize));
	const scale = Math.min(
		1,
		normalizedSampleSize / Math.max(sourceWidth, sourceHeight),
	);
	const width = Math.max(1, Math.round(sourceWidth * scale));
	const height = Math.max(1, Math.round(sourceHeight * scale));

	const canvas = createOffscreenCanvas(width, height);
	const ctx = canvas.getContext("2d", {
		willReadFrequently: true,
	}) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
	if (!ctx) return null;
	ctx.drawImage(source, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height);
}

/**
 * 构建颜色直方图。全透明像素会被跳过，半透明像素按原色计入。
 *
 * @param source 图像资源
 * @param sampleSize 统计前缩放到的最长边像素数，默认 64
 */
export function buildColorHistogram(
	source: HistogramSource,
	sampleSize: number = DEFAULT_SAMPLE_SIZE,
): ColorCount[] {
	const imageData = toImageData(source, sampleSize);
	if (!imageData) return [];

	const { data } = imageData;
	const counts = new Map<number, number>();
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] === 0) continue;
		const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return Array.from(counts, ([key, count]) => {
		const color: ColorVec3 = [
			(key >> 16) & 0xff,
			(key >> 8) & 0xff,
			key & 0xff,
		];
		return { color, count };
	});
}
