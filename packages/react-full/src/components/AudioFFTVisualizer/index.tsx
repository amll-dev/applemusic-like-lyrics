import { getDefaultStore, useAtomValue } from "jotai";
import {
	type FC,
	type HTMLProps,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import { fftSymmetricAtom } from "../../states/configAtoms";
import { fftDataAtom } from "../../states/dataAtoms";

/**
 * 音频频谱可视化。
 *
 * 后端输出的已经是按 WebAudio AnalyserNode 观感处理过的 0..1 对数频段
 * （96 段 40Hz–16kHz，含 dB 映射与 0.8 的平滑），所以这里不再做自动增益或
 * 第二层逐帧平滑：只按画布宽度决定画多少根线，数据停了再平滑落到零。
 */
export const AudioFFTVisualizer: FC<
	{
		/** 可选：外部直接传入频谱；不传则订阅默认 store 的 `fftDataAtom`。 */
		fftData?: number[];
	} & HTMLProps<HTMLCanvasElement>
> = ({ fftData, ...props }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fftDataRef = useRef<number[] | null>(fftData ?? null);
	const lastDataAtRef = useRef(0);
	const symmetric = useAtomValue(fftSymmetricAtom);

	useEffect(() => {
		if (fftData !== undefined) {
			fftDataRef.current = fftData;
			lastDataAtRef.current = performance.now();
		}
	}, [fftData]);

	const subscribeToAtom = fftData === undefined;

	useLayoutEffect(() => {
		const canvasEl = canvasRef.current;
		if (!canvasEl) return;
		const canvas: HTMLCanvasElement = canvasEl;
		const ctxOrNull = canvas.getContext("2d");
		if (!ctxOrNull) return;
		const ctx: CanvasRenderingContext2D = ctxOrNull;

		let unsubscribe: (() => void) | undefined;
		if (subscribeToAtom) {
			const store = getDefaultStore();
			fftDataRef.current = store.get(fftDataAtom) ?? [];
			lastDataAtRef.current = performance.now();
			unsubscribe = store.sub(fftDataAtom, () => {
				fftDataRef.current = store.get(fftDataAtom) ?? [];
				lastDataAtRef.current = performance.now();
			});
		}

		let targetSize = { width: 0, height: 0 };
		const obs = new ResizeObserver((sizes) => {
			for (const size of sizes) {
				targetSize = {
					width: size.contentRect.width * window.devicePixelRatio,
					height: size.contentRect.height * window.devicePixelRatio,
				};
			}
		});
		obs.observe(canvas);

		let stopped = false;
		let display: number[] = [];
		let lastFrameAt = performance.now();
		let strokeStyle: string | CanvasGradient = "white";

		/** 只在频段数多于绘制条数时使用；用最大值保留峰值形状。 */
		function resampleMax(src: number[], dstLen: number): number[] {
			if (dstLen <= 0 || src.length === 0) return [];
			if (src.length === dstLen) return src;
			const out = new Array<number>(dstLen);
			for (let i = 0; i < dstLen; i++) {
				const start = Math.floor((i * src.length) / dstLen);
				const end = Math.max(
					start + 1,
					Math.floor(((i + 1) * src.length) / dstLen),
				);
				let max = 0;
				for (let j = start; j < end && j < src.length; j++) {
					if (src[j] > max) max = src[j];
				}
				out[i] = max;
			}
			return out;
		}

		function onFrame(now: number) {
			if (stopped) return;
			requestAnimationFrame(onFrame);

			let width = canvas.width;
			let height = canvas.height;
			if (targetSize.width !== width || targetSize.height !== height) {
				canvas.width = targetSize.width;
				canvas.height = targetSize.height;
				width = canvas.width;
				height = canvas.height;
				const gradient = ctx.createLinearGradient(0, height, 0, 0);
				gradient.addColorStop(0, "rgba(255, 255, 255, 0.35)");
				gradient.addColorStop(1, "rgba(255, 255, 255, 0.95)");
				strokeStyle = gradient;
			}
			if (width === 0 || height === 0) return;

			const data = fftDataRef.current ?? [];
			if (display.length !== data.length) {
				display = new Array<number>(data.length).fill(0);
			}

			const dt = Math.min(now - lastFrameAt, 64);
			lastFrameAt = now;
			const stale = now - lastDataAtRef.current > 180;
			// 只给「没有新数据」的情况做淡出；正常播放时不叠加第二层平滑。
			const decay = Math.exp(-dt / 120);
			for (let i = 0; i < display.length; i++) {
				display[i] = stale
					? display[i] * decay
					: Math.min(1, Math.max(0, data[i] ?? 0));
			}

			ctx.clearRect(0, 0, width, height);

			const dpr = window.devicePixelRatio || 1;
			const desiredSpacing = 8 * dpr;
			let desiredCount = Math.floor(width / Math.max(1, desiredSpacing));
			desiredCount = Math.max(8, desiredCount);
			const lineCount =
				display.length > 0 ? Math.min(display.length, desiredCount) : 0;
			if (lineCount === 0) return;

			const values =
				lineCount === display.length
					? display
					: resampleMax(display, lineCount);

			const barWidth = width / lineCount;
			const barBeginY = height - barWidth;
			const availableHeight = Math.max(0, height - barWidth * 2);
			const lineWidth = Math.min(4 * dpr, barWidth * 0.45);

			ctx.beginPath();
			ctx.strokeStyle = strokeStyle;
			ctx.lineWidth = lineWidth;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			for (let i = 0; i < values.length; i++) {
				const x = barWidth * (i + 0.5);
				// 水平镜像：中心对应最低频，越靠两侧频率越高。
				const distanceFromCenter = symmetric
					? Math.abs(((i + 0.5) / lineCount) * 2 - 1)
					: 0;
				const sourceIndex = symmetric
					? Math.min(
							values.length - 1,
							Math.round(distanceFromCenter * (values.length - 1)),
						)
					: i;
				const norm = Math.min(1, Math.max(0, values[sourceIndex]));
				// 固定的感知对比曲线：不做自动增益，但把常见的高位窄区间拉开，
				// 避免整排谱线看起来像一堵墙。
				const shaped = norm ** 1.8;
				const barHeight = Math.max(shaped * availableHeight, lineWidth * 0.5);
				ctx.moveTo(x, barBeginY);
				ctx.lineTo(x, barBeginY - barHeight);
			}

			ctx.stroke();
		}

		requestAnimationFrame(onFrame);

		return () => {
			stopped = true;
			obs.disconnect();
			unsubscribe?.();
		};
	}, [subscribeToAtom, symmetric]);

	return <canvas ref={canvasRef} {...props} />;
};
