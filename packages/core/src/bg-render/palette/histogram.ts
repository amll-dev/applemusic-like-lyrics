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

/** 直方图比调色板结果大，只缓存最近几张封面。 */
const HISTOGRAM_CACHE_LIMIT = 8;

const histogramCache = new Map<string, ColorCount[]>();
const histogramInFlight = new Map<string, Promise<ColorCount[]>>();

/**
 * 复用的采样画布：重复新建 OffscreenCanvas 会重新分配后备存储，随后的
 * `getImageData` 还要等绘制命令落盘。
 *
 * `drawImage` 与 `getImageData` 之间不能 `await`，否则并发取色会互相踩画布。
 */
let scratchCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let scratchContext:
	| OffscreenCanvasRenderingContext2D
	| CanvasRenderingContext2D
	| null = null;

function getScratchContext(width: number, height: number) {
	if (!scratchCanvas) {
		scratchCanvas = createOffscreenCanvas(width, height);
	}
	if (scratchCanvas.width !== width) scratchCanvas.width = width;
	if (scratchCanvas.height !== height) scratchCanvas.height = height;

	if (!scratchContext) {
		scratchContext = scratchCanvas.getContext("2d", {
			willReadFrequently: true,
		}) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
	}
	if (scratchContext) {
		// 调整 canvas.width/height 会重置这些状态，所以每次都要重新设置
		scratchContext.imageSmoothingEnabled = true;
		scratchContext.imageSmoothingQuality = "low";
	}
	return scratchContext;
}

/** 按最长边缩放到 `sampleSize`，返回实际要采样的宽高。 */
function getSampleSize(
	source: HistogramSource,
	sampleSize: number,
): [number, number] | null {
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
	return [
		Math.max(1, Math.round(sourceWidth * scale)),
		Math.max(1, Math.round(sourceHeight * scale)),
	];
}

function toImageData(
	source: HistogramSource,
	sampleSize: number,
): ImageData | null {
	if (source instanceof ImageData) return source;

	const size = getSampleSize(source, sampleSize);
	if (!size) return null;
	const [width, height] = size;

	const ctx = getScratchContext(width, height);
	if (!ctx) return null;
	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(source, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height);
}

/**
 * 优先让解码线程用 `createImageBitmap` 完成缩小，主线程只把位图 1:1 画到采样
 * 画布再读像素，避开同步 `getImageData` 等待绘制落盘的卡顿。
 */
async function toImageDataAsync(
	source: HistogramSource,
	sampleSize: number,
): Promise<ImageData | null> {
	if (source instanceof ImageData) return source;

	const size = getSampleSize(source, sampleSize);
	if (!size) return null;
	const [width, height] = size;

	if (typeof createImageBitmap === "function") {
		let bitmap: ImageBitmap | null = null;
		try {
			bitmap = await createImageBitmap(source, {
				resizeWidth: width,
				resizeHeight: height,
				resizeQuality: "low",
			});
		} catch {
			// 某些浏览器 / 资源不支持 resize 参数，退回同步路径
		}
		if (bitmap) {
			try {
				const ctx = getScratchContext(width, height);
				if (!ctx) return null;
				ctx.clearRect(0, 0, width, height);
				// resize 参数可能被忽略，所以显式给目标宽高，让 drawImage 自己缩放
				ctx.drawImage(bitmap, 0, 0, width, height);
				return ctx.getImageData(0, 0, width, height);
			} finally {
				// ImageBitmap 是显存/系统内存资源，用完立刻释放
				bitmap.close();
			}
		}
	}

	return toImageData(source, sampleSize);
}

function countColors(imageData: ImageData): ColorCount[] {
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

/** 只有图片 URL 是稳定的；视频帧与 ImageBitmap 无从索引。 */
function getCacheKey(
	source: HistogramSource,
	sampleSize: number,
): string | null {
	if (source instanceof HTMLImageElement) {
		const url = source.currentSrc || source.src;
		if (url) return `${sampleSize}|${url}`;
	}
	return null;
}

function getCachedHistogram(key: string): ColorCount[] | null {
	const cached = histogramCache.get(key);
	if (!cached) return null;
	// 命中后移到队尾，实现简易 LRU
	histogramCache.delete(key);
	histogramCache.set(key, cached);
	return cached;
}

function setCachedHistogram(key: string, entries: ColorCount[]): void {
	histogramCache.set(key, entries);
	while (histogramCache.size > HISTOGRAM_CACHE_LIMIT) {
		const oldest = histogramCache.keys().next().value;
		if (oldest === undefined) break;
		histogramCache.delete(oldest);
	}
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
	const key = getCacheKey(source, sampleSize);
	if (key) {
		const cached = getCachedHistogram(key);
		if (cached) return cached;
	}

	const imageData = toImageData(source, sampleSize);
	if (!imageData) return [];

	const entries = countColors(imageData);
	if (key) setCachedHistogram(key, entries);
	return entries;
}

/**
 * {@link buildColorHistogram} 的异步版本。
 *
 * 同一张封面正在计算时，后续调用会共享同一个 Promise，避免多个渲染器
 * 在切换封面时把同一份缩放 + 读像素工作重复做好几遍。
 */
export function buildColorHistogramAsync(
	source: HistogramSource,
	sampleSize: number = DEFAULT_SAMPLE_SIZE,
): Promise<ColorCount[]> {
	const key = getCacheKey(source, sampleSize);
	if (key) {
		const cached = getCachedHistogram(key);
		if (cached) return Promise.resolve(cached);

		const inFlight = histogramInFlight.get(key);
		if (inFlight) return inFlight;
	}

	const task = toImageDataAsync(source, sampleSize).then((imageData) => {
		const entries = imageData ? countColors(imageData) : [];
		if (key && entries.length > 0) setCachedHistogram(key, entries);
		return entries;
	});

	if (key) {
		histogramInFlight.set(key, task);
		// 用 then 的第二个参数而不是 finally，避免派生出一个未处理的拒绝
		task.then(
			() => histogramInFlight.delete(key),
			() => histogramInFlight.delete(key),
		);
	}

	return task;
}
