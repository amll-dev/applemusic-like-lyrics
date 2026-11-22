import { type FC, useLayoutEffect, useRef } from "react";
import styles from "./dither-scrim.module.css";

/** 与原来的 CSS 渐变对齐：从 60% 高度开始加深，底部不透明度 0x1a / 255。 */
const SCRIM_START = 0.6;
const SCRIM_MAX_ALPHA = 0x1a / 255;

/**
 * 底部的纵向加深遮罩。
 *
 * 原本是一层 CSS `linear-gradient`，但合成器会按 8-bit alpha 光栅化它，把
 * 下面已经抖动过的背景重新量化出一圈圈横带。改成自己往 canvas 里写逐行带
 * 噪声的 alpha，量化就成了随机舍入。渐变是纯纵向的，所以只需要 1px 宽、逐行
 * 不同的 alpha，横向交给 CSS 拉伸，开销只有 height 个像素。
 */
export const DitherScrim: FC = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const draw = () => {
			const { height } = canvas.getBoundingClientRect();
			if (height <= 0) return;

			// 用 CSS 像素高度即可：抖动是高频噪声，没必要跟随 DPR 放大画布。
			const rows = Math.max(1, Math.round(height));
			canvas.width = 1;
			canvas.height = rows;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const image = ctx.createImageData(1, rows);
			for (let y = 0; y < rows; y++) {
				const t = y / Math.max(1, rows - 1);
				const base =
					Math.max(0, (t - SCRIM_START) / (1 - SCRIM_START)) * SCRIM_MAX_ALPHA;

				// 随机舍入：期望值仍是 base，但量化噪点会打散 8-bit 合成
				// 产生的横带。floor(base*255 + rand) 是无偏的。
				const alphaByte = Math.min(
					255,
					Math.max(0, Math.floor(base * 255 + Math.random())),
				);

				const offset = y * 4;
				image.data[offset] = 0;
				image.data[offset + 1] = 0;
				image.data[offset + 2] = 0;
				image.data[offset + 3] = alphaByte;
			}

			ctx.putImageData(image, 0, 0);
		};

		draw();
		const observer = new ResizeObserver(draw);
		observer.observe(canvas);
		return () => observer.disconnect();
	}, []);

	return <canvas ref={canvasRef} className={styles.scrim} aria-hidden />;
};
