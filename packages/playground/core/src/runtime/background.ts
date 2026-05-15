import {
	BackgroundRender,
	MeshGradientRenderer,
	PixiRenderer,
} from "@applemusic-like-lyrics/core";
import type { BackgroundRendererMode, usePlayerStore } from "@/stores/player";

type PlayerStore = ReturnType<typeof usePlayerStore>;
type PlayerBackground =
	| BackgroundRender<MeshGradientRenderer>
	| BackgroundRender<PixiRenderer>;

class BackgroundRuntime {
	private background: PlayerBackground | undefined;
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
		this.background =
			renderer === "pixi"
				? BackgroundRender.new(PixiRenderer)
				: BackgroundRender.new(MeshGradientRenderer);
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
