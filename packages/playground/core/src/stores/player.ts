import { defineStore } from "pinia";

export type BackgroundRendererMode = "mg" | "pixi";

export interface SpringParams {
	mass: number;
	damping: number;
	stiffness: number;
	soft: boolean;
}

const query = new URLSearchParams(globalThis.location?.search ?? "");

function revokeObjectUrl(url: string): void {
	if (url) URL.revokeObjectURL(url);
}

function clampTime(time: number, duration: number): number {
	const safeTime = Number.isFinite(time) ? time : 0;
	const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
	return Math.min(Math.max(0, safeTime), safeDuration);
}

export const usePlayerStore = defineStore("player", {
	state: () => ({
		source: {
			lyricUrl: query.get("lyric") ?? "",
			lyricName: query.get("lyric") ?? "",
			lyricRevision: 0,
			musicUrl: query.get("music") ?? "",
			musicName: query.get("music") ?? "",
			albumUrl: query.get("album") ?? "",
			albumName: query.get("album") ?? "",
			albumRevision: 0,
		},
		localObjectUrls: {
			lyric: "",
			music: "",
			album: "",
			extractedAlbum: "",
		},
		audio: {
			currentTime: 0,
			duration: 0,
			playing: false,
			seekRevision: 0,
			error: "",
		},
		lyric: {
			loading: false,
			error: "",
			fadeWidth: 0.5,
			enableBlur: true,
			enableSpring: true,
			fontFamily: "",
			fontWeight: 600,
			verticalSpring: {
				mass: 1,
				damping: 15,
				stiffness: 100,
				soft: false,
			} satisfies SpringParams,
			scaleSpring: {
				mass: 1,
				damping: 20,
				stiffness: 100,
				soft: false,
			} satisfies SpringParams,
		},
		background: {
			playing: true,
			staticMode: false,
			renderer: (query.get("bg") === "pixi"
				? "pixi"
				: "mg") as BackgroundRendererMode,
			scale: 1,
			fps: 60,
			flowSpeed: 0.2,
			error: "",
		},
	}),
	actions: {
		setLyricUrl(url: string): void {
			if (url !== this.localObjectUrls.lyric) {
				revokeObjectUrl(this.localObjectUrls.lyric);
				this.localObjectUrls.lyric = "";
			}
			this.source.lyricUrl = url;
			this.source.lyricName = url;
		},
		setMusicUrl(url: string): void {
			if (url !== this.localObjectUrls.music) {
				revokeObjectUrl(this.localObjectUrls.music);
				this.localObjectUrls.music = "";
			}
			this.source.musicUrl = url;
			this.source.musicName = url;
		},
		setAlbumUrl(url: string): void {
			if (url !== this.localObjectUrls.album) {
				revokeObjectUrl(this.localObjectUrls.album);
				this.localObjectUrls.album = "";
			}
			if (url !== this.localObjectUrls.extractedAlbum) {
				revokeObjectUrl(this.localObjectUrls.extractedAlbum);
				this.localObjectUrls.extractedAlbum = "";
			}
			this.source.albumUrl = url;
			this.source.albumName = url;
		},
		setLocalLyricFile(file: File): void {
			revokeObjectUrl(this.localObjectUrls.lyric);
			const url = URL.createObjectURL(file);
			this.localObjectUrls.lyric = url;
			this.source.lyricUrl = url;
			this.source.lyricName = file.name;
		},
		setLocalMusicFile(file: File): void {
			revokeObjectUrl(this.localObjectUrls.music);
			const url = URL.createObjectURL(file);
			this.localObjectUrls.music = url;
			this.source.musicUrl = url;
			this.source.musicName = file.name;
		},
		setLocalAlbumFile(file: File): void {
			revokeObjectUrl(this.localObjectUrls.album);
			const url = URL.createObjectURL(file);
			this.localObjectUrls.album = url;
			this.source.albumUrl = url;
			this.source.albumName = file.name;
		},
		setExtractedAlbumBlob(blob: Blob, name: string): void {
			revokeObjectUrl(this.localObjectUrls.extractedAlbum);
			const url = URL.createObjectURL(blob);
			this.localObjectUrls.extractedAlbum = url;
			this.source.albumUrl = url;
			this.source.albumName = name;
		},
		clearExtractedAlbum(): void {
			if (this.source.albumUrl === this.localObjectUrls.extractedAlbum) {
				this.source.albumUrl = "";
				this.source.albumName = "";
			}
			revokeObjectUrl(this.localObjectUrls.extractedAlbum);
			this.localObjectUrls.extractedAlbum = "";
		},
		reloadLyric(): void {
			this.source.lyricRevision += 1;
		},
		reloadAlbum(): void {
			this.source.albumRevision += 1;
		},
		disposeLocalObjectUrls(): void {
			revokeObjectUrl(this.localObjectUrls.lyric);
			revokeObjectUrl(this.localObjectUrls.music);
			revokeObjectUrl(this.localObjectUrls.album);
			revokeObjectUrl(this.localObjectUrls.extractedAlbum);
			this.localObjectUrls.lyric = "";
			this.localObjectUrls.music = "";
			this.localObjectUrls.album = "";
			this.localObjectUrls.extractedAlbum = "";
		},
		togglePlayback(): void {
			this.audio.playing = !this.audio.playing;
		},
		setPlaying(playing: boolean): void {
			this.audio.playing = playing;
		},
		seek(time: number): void {
			this.audio.currentTime = clampTime(time, this.audio.duration);
			this.audio.seekRevision += 1;
		},
		syncCurrentTime(time: number): void {
			this.audio.currentTime = clampTime(time, this.audio.duration);
		},
		setDuration(duration: number): void {
			this.audio.duration =
				Number.isFinite(duration) && duration > 0 ? duration : 0;
		},
		setAudioError(error: string): void {
			this.audio.error = error;
		},
		setLyricLoading(loading: boolean): void {
			this.lyric.loading = loading;
		},
		setLyricError(error: string): void {
			this.lyric.error = error;
		},
		setBackgroundError(error: string): void {
			this.background.error = error;
		},
	},
});
