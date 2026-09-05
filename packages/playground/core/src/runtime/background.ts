import {
	BackgroundRender,
	type BaseRenderer,
	IsolationRenderer,
	MeshGradientRenderer,
	PixiRenderer,
} from "@applemusic-like-lyrics/core";
import type { BackgroundRendererMode, usePlayerStore } from "@/stores/player";

type PlayerStore = ReturnType<typeof usePlayerStore>;
type RendererConstructor = new (canvas: HTMLCanvasElement) => BaseRenderer;

const RENDERERS: Record<BackgroundRendererMode, RendererConstructor> = {
	mg: MeshGradientRenderer,
	pixi: PixiRenderer,
	isolation: IsolationRenderer,
};

class BackgroundRuntime {
	private background: BackgroundRender<BaseRenderer> | undefined;
	private renderer: BackgroundRendererMode | undefined;
	private albumKey = "";
	private albumLoadRevision = 0;

	mount(
		host: HTMLElement,
		renderer: BackgroundRendererMode,
		before?: HTMLElement | null,
	): void {
		this.ensureRenderer(renderer);
		const element = this.background?.getElement();
		if (!element) return;
		if (element.parentElement !== host || element.nextSibling !== before) {
			host.insertBefore(element, before ?? null);
		}
	}

	ensureRenderer(renderer: BackgroundRendererMode): void {
		if (this.background && this.renderer === renderer) return;

		this.background?.dispose();
		this.background = BackgroundRender.new(RENDERERS[renderer]);
		this.renderer = renderer;
		this.albumKey = "";

		const element = this.background.getElement();
		Object.assign(element.style, {
			position: "absolute",
			inset: "0",
			width: "100%",
			height: "100%",
			zIndex: "0",
			pointerEvents: "none",
		});
	}

	applySettings(store: PlayerStore): void {
		const background = this.background;
		if (!background) return;

		background.setFPS(store.background.fps);
		background.setRenderScale(store.background.scale);
		background.setFlowSpeed(store.background.flowSpeed);
		background.setStaticMode(store.background.staticMode);
		if (store.background.playing) background.resume();
		else background.pause();

		// 渲染器专属选项走实例本体，统一接口里没有对应的方法
		const renderer = background.getRenderer();
		if (renderer instanceof IsolationRenderer) {
			renderer.setOptions(store.background.isolation);
		}
	}

	setHasLyric(hasLyric: boolean): void {
		this.background?.setHasLyric(hasLyric);
	}

	async loadAlbum(store: PlayerStore): Promise<void> {
		const background = this.background;
		const source = store.source.albumUrl.trim();
		const key = `${source}\0${store.source.albumName}\0${store.source.albumRevision}`;

		if (!background || !source) {
			this.albumKey = key;
			store.setBackgroundError("");
			return;
		}

		if (this.albumKey === key) return;

		this.albumKey = key;
		const revision = ++this.albumLoadRevision;
		store.setBackgroundError("");

		try {
			const sourceName = store.source.albumName || source;
			await background.setAlbum(source, isVideoAlbumSource(sourceName));
		} catch (error) {
			if (revision !== this.albumLoadRevision) return;
			store.setBackgroundError(
				error instanceof Error ? error.message : String(error),
			);
		}
	}
}

function isVideoAlbumSource(source: string): boolean {
	return /\.(mp4|webm|ogg|ogv|mov|m4v)(?:[?#].*)?$/i.test(source);
}

type HotData = {
	backgroundRuntime?: BackgroundRuntime;
};

const hotData = import.meta.hot?.data as HotData | undefined;

export const backgroundRuntime =
	hotData?.backgroundRuntime ?? new BackgroundRuntime();

if (hotData?.backgroundRuntime) {
	Object.setPrototypeOf(backgroundRuntime, BackgroundRuntime.prototype);
}

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose((data: HotData) => {
		data.backgroundRuntime = backgroundRuntime;
	});
}
