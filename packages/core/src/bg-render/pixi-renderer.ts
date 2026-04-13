import { Application } from "@pixi/app";
import { Texture } from "@pixi/core";
import { Container } from "@pixi/display";
import { BlurFilter } from "@pixi/filter-blur";
import { BulgePinchFilter } from "@pixi/filter-bulge-pinch";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { Sprite } from "@pixi/sprite";
import {
	loadResourceFromElement,
	loadResourceFromUrl,
} from "../utils/resource";
import { BaseRenderer } from "./base";

class TimedContainer extends Container {
	public time = 0;
}

export class PixiRenderer extends BaseRenderer {
	private app: Application;
	private curContainer?: TimedContainer;
	private staticMode = false;
	private lastContainer: Set<TimedContainer> = new Set();
	private onTick = (delta: number): void => {
		for (const lastContainer of this.lastContainer) {
			lastContainer.alpha = Math.max(0, lastContainer.alpha - delta / 60);
			if (lastContainer.alpha <= 0) {
				this.app.stage.removeChild(lastContainer);
				this.lastContainer.delete(lastContainer);
				lastContainer.destroy(true);
			}
		}

		if (this.curContainer) {
			this.curContainer.alpha = Math.min(
				1,
				this.curContainer.alpha + delta / 60,
			);
			const [s1, s2, s3, s4] = this.curContainer.children as Sprite[];
			const maxSize = Math.max(this.app.screen.width, this.app.screen.height);
			s1.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
			s2.position.set(
				this.app.screen.width / 2.5,
				this.app.screen.height / 2.5,
			);
			s3.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
			s4.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
			s1.width = maxSize * Math.sqrt(2);
			s1.height = s1.width;
			s2.width = maxSize * 0.8;
			s2.height = s2.width;
			s3.width = maxSize * 0.5;
			s3.height = s3.width;
			s4.width = maxSize * 0.25;
			s4.height = s4.width;

			this.curContainer.time += delta * this.flowSpeed;

			s1.rotation += (delta / 1000) * this.flowSpeed;
			s2.rotation -= (delta / 500) * this.flowSpeed;
			s3.rotation += (delta / 1000) * this.flowSpeed;
			s4.rotation -= (delta / 750) * this.flowSpeed;

			s3.x =
				this.app.screen.width / 2 +
				(this.app.screen.width / 4) *
					Math.cos((this.curContainer.time / 1000) * 0.75);
			s3.y =
				this.app.screen.height / 2 +
				(this.app.screen.width / 4) *
					Math.cos((this.curContainer.time / 1000) * 0.75);

			s4.x =
				this.app.screen.width / 2 +
				(this.app.screen.width / 4) * 0.1 +
				Math.cos(this.curContainer.time * 0.006 * 0.75);
			s4.y =
				this.app.screen.height / 2 +
				(this.app.screen.width / 4) * 0.1 +
				Math.cos(this.curContainer.time * 0.006 * 0.75);

			if (
				this.curContainer.alpha >= 1 &&
				this.lastContainer.size === 0 &&
				this.staticMode
			) {
				this.app.ticker.stop();
			}
		}
	};
	constructor(protected override canvas: HTMLCanvasElement) {
		super(canvas);
		this.app = new Application({
			view: canvas,
			resizeTo: this.canvas,
			powerPreference: "low-power",
			backgroundAlpha: 1,
		});
		this.rebuildFilters();
		this.app.ticker.maxFPS = 30;
		this.app.ticker.add(this.onTick);
		this.app.ticker.start();
	}

	protected override onResize(width: number, height: number): void {
		super.onResize(width, height);
		this.app.resize();
		this.rebuildFilters();
	}

	override setRenderScale(scale: number): void {
		super.setRenderScale(scale);
		this.rebuildFilters();
	}
	private rebuildFilters() {
		const minBorder = Math.min(this.canvas.width, this.canvas.height);
		const maxBorder = Math.max(this.canvas.width, this.canvas.height);
		const c0 = new ColorMatrixFilter();
		c0.saturate(1.2, false);
		const c1 = new ColorMatrixFilter();
		c1.brightness(0.6, false);
		const c2 = new ColorMatrixFilter();
		c2.contrast(0.3, true);
		for (const filter of this.app.stage.filters ?? []) {
			filter.destroy();
		}
		this.app.stage.filters = [];
		this.app.stage.filters.push(new BlurFilter(5, 1));
		this.app.stage.filters.push(new BlurFilter(10, 1));
		this.app.stage.filters.push(new BlurFilter(20, 2));
		this.app.stage.filters.push(new BlurFilter(40, 2));
		this.app.stage.filters.push(new BlurFilter(80, 2));
		if (minBorder > 768) this.app.stage.filters.push(new BlurFilter(160, 4));
		if (minBorder > 768 * 2)
			this.app.stage.filters.push(new BlurFilter(320, 4));

		this.app.stage.filters.push(c0, c1, c2);
		this.app.stage.filters.push(new BlurFilter(5, 1));
		if (Math.random() > 0.5) {
			this.app.stage.filters.push(
				new BulgePinchFilter({
					radius: (maxBorder + minBorder) / 2,
					strength: 1,
					center: [0.25, 1],
				}),
			);
			this.app.stage.filters.push(
				new BulgePinchFilter({
					radius: (maxBorder + minBorder) / 2,
					strength: 1,
					center: [0.75, 0],
				}),
			);
		} else {
			this.app.stage.filters.push(
				new BulgePinchFilter({
					radius: (maxBorder + minBorder) / 2,
					strength: 1,
					center: [0.75, 1],
				}),
			);
			this.app.stage.filters.push(
				new BulgePinchFilter({
					radius: (maxBorder + minBorder) / 2,
					strength: 1,
					center: [0.25, 0],
				}),
			);
		}
	}

	override setStaticMode(enable = false): void {
		this.staticMode = enable;
		this.app.ticker.start();
	}

	override setFPS(fps: number): void {
		this.app.ticker.maxFPS = fps;
	}

	override pause(): void {
		this.app.ticker.stop();
		this.app.render();
	}

	override resume(): void {
		this.app.ticker.start();
	}

	override setLowFreqVolume(_volume: number): void {
		// NOOP
	}

	override setHasLyric(_hasLyric: boolean): void {
		// NOOP
	}

	override async setAlbum(
		albumSource?: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void> {
		if (
			!albumSource ||
			(typeof albumSource === "string" && albumSource.trim().length === 0)
		)
			return;
		let res: HTMLImageElement | HTMLVideoElement | null = null;
		let remainRetryTimes = 5;
		let tex: Texture | null = null;
		while (!tex?.baseTexture?.resource?.valid && remainRetryTimes > 0) {
			try {
				if (typeof albumSource === "string") {
					res = await loadResourceFromUrl(albumSource, isVideo);
				} else {
					res = await loadResourceFromElement(albumSource);
				}
				tex = Texture.from(res, {
					resourceOptions: {
						autoLoad: false,
					},
				});
				await tex.baseTexture.resource.load();
			} catch (error) {
				console.warn(
					`failed on loading album image, retrying (${remainRetryTimes})`,
					albumSource,
					error,
				);
				tex = null;
				remainRetryTimes--;
			}
		}
		if (!tex) return;
		const container = new TimedContainer();
		const s1 = new Sprite(tex);
		const s2 = new Sprite(tex);
		const s3 = new Sprite(tex);
		const s4 = new Sprite(tex);
		s1.anchor.set(0.5, 0.5);
		s2.anchor.set(0.5, 0.5);
		s3.anchor.set(0.5, 0.5);
		s4.anchor.set(0.5, 0.5);
		s1.rotation = Math.random() * Math.PI * 2;
		s2.rotation = Math.random() * Math.PI * 2;
		s3.rotation = Math.random() * Math.PI * 2;
		s4.rotation = Math.random() * Math.PI * 2;
		container.addChild(s1, s2, s3, s4);
		if (this.curContainer) this.lastContainer.add(this.curContainer);
		this.curContainer = container;
		this.app.stage.addChild(container);
		this.curContainer.alpha = 0;
		this.app.ticker.start();
	}

	override dispose(): void {
		super.dispose();
		this.app.ticker.remove(this.onTick);
		this.app.destroy(true);
	}

	override getElement(): HTMLElement {
		return this.canvas;
	}
}
