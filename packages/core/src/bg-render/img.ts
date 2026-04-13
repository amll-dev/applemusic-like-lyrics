export function blurImage(
	imageData: ImageData,
	radius: number,
	quality: number,
): void {
	const pixels = imageData.data;
	const width = imageData.width;
	const height = imageData.height;

	let rsum: number;
	let gsum: number;
	let bsum: number;
	let asum: number;
	let x: number;
	let y: number;
	let i: number;
	let p: number;
	let p1: number;
	let p2: number;
	let yp: number;
	let yi: number;
	let yw: number;
	const wm = width - 1;
	const hm = height - 1;
	const rad1x = radius + 1;
	const divx = radius + rad1x;
	const rad1y = radius + 1;
	const divy = radius + rad1y;
	const div2 = 1 / (divx * divy);

	const r: number[] = [];
	const g: number[] = [];
	const b: number[] = [];
	const a: number[] = [];

	const vmin: number[] = [];
	const vmax: number[] = [];

	while (quality-- > 0) {
		yw = yi = 0;

		for (y = 0; y < height; y++) {
			rsum = pixels[yw] * rad1x;
			gsum = pixels[yw + 1] * rad1x;
			bsum = pixels[yw + 2] * rad1x;
			asum = pixels[yw + 3] * rad1x;

			for (i = 1; i <= radius; i++) {
				p = yw + ((i > wm ? wm : i) << 2);
				rsum += pixels[p++];
				gsum += pixels[p++];
				bsum += pixels[p++];
				asum += pixels[p];
			}

			for (x = 0; x < width; x++) {
				r[yi] = rsum;
				g[yi] = gsum;
				b[yi] = bsum;
				a[yi] = asum;

				if (y === 0) {
					vmin[x] = Math.min(x + rad1x, wm) << 2;
					vmax[x] = Math.max(x - radius, 0) << 2;
				}

				p1 = yw + vmin[x];
				p2 = yw + vmax[x];

				rsum += pixels[p1++] - pixels[p2++];
				gsum += pixels[p1++] - pixels[p2++];
				bsum += pixels[p1++] - pixels[p2++];
				asum += pixels[p1] - pixels[p2];

				yi++;
			}
			yw += width << 2;
		}

		for (x = 0; x < width; x++) {
			yp = x;
			rsum = r[yp] * rad1y;
			gsum = g[yp] * rad1y;
			bsum = b[yp] * rad1y;
			asum = a[yp] * rad1y;

			for (i = 1; i <= radius; i++) {
				yp += i > hm ? 0 : width;
				rsum += r[yp];
				gsum += g[yp];
				bsum += b[yp];
				asum += a[yp];
			}

			yi = x << 2;
			for (y = 0; y < height; y++) {
				pixels[yi] = (rsum * div2 + 0.5) | 0;
				pixels[yi + 1] = (gsum * div2 + 0.5) | 0;
				pixels[yi + 2] = (bsum * div2 + 0.5) | 0;
				pixels[yi + 3] = (asum * div2 + 0.5) | 0;

				if (x === 0) {
					vmin[y] = Math.min(y + rad1y, hm) * width;
					vmax[y] = Math.max(y - radius, 0) * width;
				}

				p1 = x + vmin[y];
				p2 = x + vmax[y];

				rsum += r[p1] - r[p2];
				gsum += g[p1] - g[p2];
				bsum += b[p1] - b[p2];
				asum += a[p1] - a[p2];

				yi += width << 2;
			}
		}
	}
}

export function saturateImage(imageData: ImageData, saturation: number): void {
	const pixels = imageData.data;

	for (let i = 0; i < pixels.length; i += 4) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const a = pixels[i + 3];
		const gray = r * 0.3 + g * 0.59 + b * 0.11;
		pixels[i] = gray * (1 - saturation) + r * saturation;
		pixels[i + 1] = gray * (1 - saturation) + g * saturation;
		pixels[i + 2] = gray * (1 - saturation) + b * saturation;
		pixels[i + 3] = a;
	}
}

export function brightnessImage(
	imageData: ImageData,
	brightness: number,
): void {
	const pixels = imageData.data;

	for (let i = 0; i < pixels.length; i += 4) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const a = pixels[i + 3];
		pixels[i] = r * brightness;
		pixels[i + 1] = g * brightness;
		pixels[i + 2] = b * brightness;
		pixels[i + 3] = a;
	}
}

export function contrastImage(imageData: ImageData, contrast: number): void {
	const pixels = imageData.data;

	for (let i = 0; i < pixels.length; i += 4) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const a = pixels[i + 3];
		pixels[i] = (r - 128) * contrast + 128;
		pixels[i + 1] = (g - 128) * contrast + 128;
		pixels[i + 2] = (b - 128) * contrast + 128;
		pixels[i + 3] = a;
	}
}
