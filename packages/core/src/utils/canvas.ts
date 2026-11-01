/**
 * 创建一个离屏画板，环境不支持 `OffscreenCanvas` 时回落到普通 canvas 元素。
 */
export function createOffscreenCanvas(
	width: number,
	height: number,
): OffscreenCanvas | HTMLCanvasElement {
	if (typeof OffscreenCanvas !== "undefined") {
		return new OffscreenCanvas(width, height);
	}
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}
