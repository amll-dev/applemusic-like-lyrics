/**
 * @fileoverview
 * 一个播放歌词的组件
 * @author SteveXMH
 */

export { AbstractBaseRenderer, BaseRenderer } from "./base.ts";
export type { GLRenderingContext } from "./gl-program.ts";
export { GLProgram } from "./gl-program.ts";
export type { IsolationRendererOptions } from "./isolation/index.ts";
export { IsolationRenderer } from "./isolation/index.ts";
export { MeshGradientRenderer } from "./mesh-renderer/index.ts";
export * from "./palette/index.ts";
export { PixiRenderer } from "./pixi-renderer.ts";
export type { TitaniumRendererOptions } from "./titanium/index.ts";
export { TitaniumRenderer } from "./titanium/index.ts";

import type { AbstractBaseRenderer, BaseRenderer } from "./base.ts";

export class BackgroundRender<Renderer extends BaseRenderer>
	implements AbstractBaseRenderer
{
	private element: HTMLCanvasElement;
	private renderer: Renderer;
	constructor(renderer: Renderer, canvas: HTMLCanvasElement) {
		this.renderer = renderer;

		this.element = canvas;
		canvas.style.pointerEvents = "none";
		canvas.style.zIndex = "-1";
		canvas.style.contain = "strict";
	}

	/**
	 * 获取被包装的渲染器实例。
	 *
	 * 各个渲染器有自己特有的可调项（例如 {@link IsolationRenderer.setOptions}），
	 * 这些项没法通过统一的 `AbstractBaseRenderer` 接口下发，需要拿到实例本体。
	 */
	getRenderer(): Renderer {
		return this.renderer;
	}

	static new<Renderer extends BaseRenderer>(type: {
		new (canvas: HTMLCanvasElement): Renderer;
	}): BackgroundRender<Renderer> {
		const newCanvas = document.createElement("canvas");
		return new BackgroundRender(new type(newCanvas), newCanvas);
	}

	setRenderScale(scale: number): void {
		this.renderer.setRenderScale(scale);
	}

	setFlowSpeed(speed: number): void {
		this.renderer.setFlowSpeed(speed);
	}
	setStaticMode(enable: boolean): void {
		this.renderer.setStaticMode(enable);
	}
	setFPS(fps: number): void {
		this.renderer.setFPS(fps);
	}
	pause(): void {
		this.renderer.pause();
	}
	resume(): void {
		this.renderer.resume();
	}
	setLowFreqVolume(volume: number): void {
		this.renderer.setLowFreqVolume(volume);
	}
	setHasLyric(hasLyric: boolean): void {
		this.renderer.setHasLyric(hasLyric);
	}
	setAlbum(
		albumSource: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void> {
		return this.renderer.setAlbum(albumSource, isVideo);
	}
	getElement(): HTMLCanvasElement {
		return this.element;
	}
	dispose(): void {
		this.renderer.dispose();
		this.element.remove();
	}
}
