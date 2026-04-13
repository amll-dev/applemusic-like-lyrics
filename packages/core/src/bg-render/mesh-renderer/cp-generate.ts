/**
 * @fileoverview
 * 实验性的随机控制点生成函数算法
 * 目的是取代原先大量的预设控制点代码
 */

import {
	type ControlPointConf,
	type ControlPointPreset,
	p,
	preset,
} from "./cp-presets.ts";

const randomRange = (min: number, max: number): number =>
	Math.random() * (max - min) + min;

function clamp(x: number, min: number, max: number): number {
	return Math.min(Math.max(x, min), max);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

function smoothifyControlPoints(
	conf: ControlPointConf[],
	w: number,
	h: number,
	iterations = 2,
	factor = 0.5,
	factorIterationModifier = 0.1,
): void {
	let grid: ControlPointConf[][] = [];
	let f = factor;

	for (let j = 0; j < h; j++) {
		grid[j] = [];
		for (let i = 0; i < w; i++) {
			grid[j][i] = conf[j * w + i];
		}
	}

	const kernel = [
		[1, 2, 1],
		[2, 4, 2],
		[1, 2, 1],
	];
	const kernelSum = 16;

	for (let iter = 0; iter < iterations; iter++) {
		const newGrid: ControlPointConf[][] = [];
		for (let j = 0; j < h; j++) {
			newGrid[j] = [];
			for (let i = 0; i < w; i++) {
				if (i === 0 || i === w - 1 || j === 0 || j === h - 1) {
					newGrid[j][i] = grid[j][i];
					continue;
				}
				let sumX = 0;
				let sumY = 0;
				let sumUR = 0;
				let sumVR = 0;
				let sumUP = 0;
				let sumVP = 0;
				for (let dj = -1; dj <= 1; dj++) {
					for (let di = -1; di <= 1; di++) {
						const weight = kernel[dj + 1][di + 1];
						const nb = grid[j + dj][i + di];
						sumX += nb.x * weight;
						sumY += nb.y * weight;
						sumUR += nb.ur * weight;
						sumVR += nb.vr * weight;
						sumUP += nb.up * weight;
						sumVP += nb.vp * weight;
					}
				}
				const avgX = sumX / kernelSum;
				const avgY = sumY / kernelSum;
				const avgUR = sumUR / kernelSum;
				const avgVR = sumVR / kernelSum;
				const avgUP = sumUP / kernelSum;
				const avgVP = sumVP / kernelSum;

				const cur = grid[j][i];
				const newX = cur.x * (1 - f) + avgX * f;
				const newY = cur.y * (1 - f) + avgY * f;
				const newUR = cur.ur * (1 - f) + avgUR * f;
				const newVR = cur.vr * (1 - f) + avgVR * f;
				const newUP = cur.up * (1 - f) + avgUP * f;
				const newVP = cur.vp * (1 - f) + avgVP * f;
				newGrid[j][i] = p(i, j, newX, newY, newUR, newVR, newUP, newVP);
			}
		}
		grid = newGrid;
		f = Math.min(1, Math.max(f + factorIterationModifier, 0));
	}

	for (let j = 0; j < h; j++) {
		for (let i = 0; i < w; i++) {
			conf[j * w + i] = grid[j][i];
		}
	}
}

function noise(x: number, y: number): number {
	return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
}

function fract(x: number): number {
	return x - Math.floor(x);
}

function smoothNoise(x: number, y: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = x0 + 1;
	const y1 = y0 + 1;

	const xf = x - x0;
	const yf = y - y0;

	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);

	const n00 = noise(x0, y0);
	const n10 = noise(x1, y0);
	const n01 = noise(x0, y1);
	const n11 = noise(x1, y1);

	const nx0 = n00 * (1 - u) + n10 * u;
	const nx1 = n01 * (1 - u) + n11 * u;

	return nx0 * (1 - v) + nx1 * v;
}

function computeNoiseGradient(
	perlinFn: (x: number, y: number) => number,
	x: number,
	y: number,
	epsilon = 0.001,
): [number, number] {
	const n1 = perlinFn(x + epsilon, y);
	const n2 = perlinFn(x - epsilon, y);
	const n3 = perlinFn(x, y + epsilon);
	const n4 = perlinFn(x, y - epsilon);
	const dx = (n1 - n2) / (2 * epsilon);
	const dy = (n3 - n4) / (2 * epsilon);
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	return [dx / len, dy / len];
}

export function generateControlPoints(
	width: number,
	height: number,
	variationFraction: number = randomRange(0.4, 0.6), // = 0.2,
	normalOffset: number = randomRange(0.3, 0.6), // = 0.3,
	blendFactor = 0.8,
	smoothIters: number = Math.floor(randomRange(3, 5)), // = 3,
	smoothFactor: number = randomRange(0.2, 0.3), // = 0.3,
	smoothModifier: number = randomRange(-0.1, -0.05), // = -0.05,
): ControlPointPreset {
	const w = width ?? Math.floor(randomRange(3, 6));
	const h = height ?? Math.floor(randomRange(3, 6));

	const conf: ControlPointConf[] = [];
	const dx = w === 1 ? 0 : 2 / (w - 1);
	const dy = h === 1 ? 0 : 2 / (h - 1);

	for (let j = 0; j < h; j++) {
		for (let i = 0; i < w; i++) {
			const baseX = (w === 1 ? 0 : i / (w - 1)) * 2 - 1;
			const baseY = (h === 1 ? 0 : j / (h - 1)) * 2 - 1;

			const isBorder = i === 0 || i === w - 1 || j === 0 || j === h - 1;
			const pertX = isBorder
				? 0
				: randomRange(-variationFraction * dx, variationFraction * dx);
			const pertY = isBorder
				? 0
				: randomRange(-variationFraction * dy, variationFraction * dy);
			let x = baseX + pertX;
			let y = baseY + pertY;

			const ur = isBorder ? 0 : randomRange(-60, 60);
			const vr = isBorder ? 0 : randomRange(-60, 60);
			const up = isBorder ? 1 : randomRange(0.8, 1.2);
			const vp = isBorder ? 1 : randomRange(0.8, 1.2);

			if (!isBorder) {
				const uNorm = (baseX + 1) / 2;
				const vNorm = (baseY + 1) / 2;

				const [nx, ny] = computeNoiseGradient(smoothNoise, uNorm, vNorm, 0.001);
				let offsetX = nx * normalOffset;
				let offsetY = ny * normalOffset;

				const distToBorder = Math.min(uNorm, 1 - uNorm, vNorm, 1 - vNorm); // in [0,0.5]

				const weight = smoothstep(0, 1.0, distToBorder);
				offsetX *= weight;
				offsetY *= weight;

				x = x * (1 - blendFactor) + (x + offsetX) * blendFactor;
				y = y * (1 - blendFactor) + (y + offsetY) * blendFactor;
			}
			conf.push(p(i, j, x, y, ur, vr, up, vp));
		}
	}

	smoothifyControlPoints(conf, w, h, smoothIters, smoothFactor, smoothModifier);

	return preset(w, h, conf);
}
