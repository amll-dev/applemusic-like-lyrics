import {
	type FC,
	type HTMLProps,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";

export const AudioFFTVisualizer: FC<
	{
		fftData: number[];
	} & HTMLProps<HTMLCanvasElement>
> = ({ fftData, ...props }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fftDataRef = useRef<number[]>(undefined);
	if (fftDataRef.current === undefined) {
		fftDataRef.current = fftData;
	}

	useEffect(() => {
		fftDataRef.current = fftData;
	}, [fftData]);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;

		if (canvas) {
			const ctx = canvas.getContext("2d");
			if (ctx) {
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

				let maxValue = 100;
				let stopped = false;

				let buf: number[] = [];

				// 线性重采样，将 src 重采样为指定长度
				function resampleLinear(src: number[], dstLen: number): number[] {
					const n = src.length;
					if (dstLen <= 0 || n === 0) return [];
					if (n === dstLen) return src.slice();
					const out = new Array(dstLen);
					const scale = (n - 1) / Math.max(1, dstLen - 1);
					for (let i = 0; i < dstLen; i++) {
						const x = i * scale;
						const x0 = Math.floor(x);
						const x1 = Math.min(n - 1, x0 + 1);
						const t = x - x0;
						out[i] = src[x0] * (1 - t) + src[x1] * t;
					}
					return out;
				}

				function onFrame() {
					if (!(canvas && ctx) || stopped) return;
					const width = canvas.width;
					const height = canvas.height;
					if (targetSize.width !== width || targetSize.height !== height) {
						canvas.width = targetSize.width;
						canvas.height = targetSize.height;
					}

					const processed = fftDataRef.current ?? [];
					if (buf.length !== processed.length) {
						buf = [...processed];
					} else {
						for (let i = 0; i < buf.length; i++) {
							let t = processed[i];
							t = t * Math.min(((i + 5) / buf.length) * 4, 1);
							buf[i] += t * 2;
							buf[i] /= 3;
						}
					}

					ctx.clearRect(0, 0, width, height);
					{
						ctx.beginPath();

						// 根据画布宽度与 DPR 计算目标绘制条数
						const dpr = window.devicePixelRatio || 1;
						const desiredSpacing = 8 * dpr; // 目标线间距（设备像素）
						let desiredCount = Math.floor(width / Math.max(1, desiredSpacing));
						desiredCount = Math.max(8, desiredCount);
						const lineCount =
							buf.length > 0 ? Math.min(buf.length, desiredCount) : 0;

						const display = lineCount > 0 ? resampleLinear(buf, lineCount) : [];

						const targetMaxValue =
							display.length > 0 ? Math.max.apply(Math, display) : 0;
						maxValue = Math.max(targetMaxValue * 0.1 + maxValue * 0.9, 100);

						const len = Math.max(1, display.length);
						const barWidth = width / len; // 步长（中心点间距）

						ctx.strokeStyle = "white";
						ctx.lineWidth = 4 * dpr;
						ctx.lineCap = "round";
						ctx.lineJoin = "round";

						const barBeginY = height - barWidth;

						for (let i = 0; i < display.length; i++) {
							const x = barWidth * (i + 0.5);
							ctx.moveTo(x, barBeginY);
							const norm = Math.min(1, Math.max(0, display[i] / maxValue));
							ctx.lineTo(x, barBeginY - norm ** 2 * (height - barWidth * 2));
						}

						ctx.stroke();
					}

					requestAnimationFrame(onFrame);
				}

				onFrame();

				return () => {
					obs.disconnect();
					stopped = true;
				};
			}
		}

		return;
	}, []);

	return <canvas ref={canvasRef} {...props} />;
};
