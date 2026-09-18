<script setup lang="ts">
import {
	DomLyricPlayer,
	type LyricLineMouseEvent,
	setSpringImplementation,
} from "@applemusic-like-lyrics/core";
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { extractSongwriters, parseLyricSource } from "@/lib/parse-lyric";
import { audioRuntime } from "@/runtime/audio";
import { backgroundRuntime } from "@/runtime/background";
import { usePlayerStore } from "@/stores/player";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";

const player = usePlayerStore();
const playerEl = ref<HTMLElement | null>(null);
const lyricPlayerRef = shallowRef<DomLyricPlayer>();
const sidebar = useSidebar();

/**
 * 进度条等 UI 的刷新间隔（毫秒）
 *
 * 歌词需要逐帧精确的播放进度，但 UI 不需要，逐帧写入响应式状态
 * 会带来大量无谓的样式重算，干扰对歌词动画的性能测量
 */
const PROGRESS_SYNC_INTERVAL_MS = 250;

let frameId = 0;
let lastFrameTime = -1;
let lyricLoadRevision = 0;
let lastProgressSyncTime = -Infinity;
let wasPaused = true;

/** 侧边栏及其中的播放进度条当前是否可见 */
function isProgressUiVisible(): boolean {
	return sidebar.isMobile.value ? sidebar.openMobile.value : sidebar.open.value;
}

function applyLyricSettings(): void {
	const lyricPlayer = lyricPlayerRef.value;
	if (!lyricPlayer) return;
	lyricPlayer.setWordFadeWidth(player.lyric.fadeWidth);
	lyricPlayer.setEnableBlur(player.lyric.enableBlur);
	lyricPlayer.setEnableSpring(player.lyric.enableSpring);
	lyricPlayer.setLinePosYSpringParams({ ...player.lyric.verticalSpring });
	lyricPlayer.setLineScaleSpringParams({ ...player.lyric.scaleSpring });
}

function mountBackground(): void {
	const host = playerEl.value;
	if (!host) return;

	const lyricElement = lyricPlayerRef.value?.getElement() ?? null;
	backgroundRuntime.mount(host, player.background.renderer, lyricElement);
	player.setBackgroundError("");
	backgroundRuntime.applySettings(player);
	void backgroundRuntime.loadAlbum(player);
}

function applySongwriters(songwriters: string[]): void {
	const bottomLineElement = lyricPlayerRef.value?.getBottomLineElement();
	if (!bottomLineElement) return;

	bottomLineElement.textContent = "";
	if (songwriters.length === 0) return;

	const b = document.createElement("b");
	b.textContent = "创作者";
	bottomLineElement.append(b, `：${songwriters.join("，")}`);
}

async function loadLyric(): Promise<void> {
	const lyricPlayer = lyricPlayerRef.value;
	if (!lyricPlayer) return;

	const revision = ++lyricLoadRevision;
	player.setLyricLoading(true);
	player.setLyricError("");

	try {
		const { lines, metadata } = await parseLyricSource(
			player.source.lyricUrl,
			player.source.lyricName,
		);
		if (revision !== lyricLoadRevision) return;

		// 直接读音频运行时，避免用到限频后的过期进度值
		const currentTime = Math.round(audioRuntime.currentTime * 1000);
		lyricPlayer.setLyricLines(lines, currentTime);
		lyricPlayer.setCurrentTime(currentTime, true);
		backgroundRuntime.setHasLyric(lines.length > 0);
		applyLyricSettings();

		const songwriters = extractSongwriters(metadata);
		applySongwriters(songwriters);
	} catch (error) {
		if (revision !== lyricLoadRevision) return;
		lyricPlayer.setLyricLines([]);
		applySongwriters([]);
		backgroundRuntime.setHasLyric(false);
		player.setLyricError(
			error instanceof Error ? error.message : String(error),
		);
	} finally {
		if (revision === lyricLoadRevision) player.setLyricLoading(false);
	}
}

function applyMusicSource(): void {
	audioRuntime.setSource(player.source.musicUrl);
}

function applyPlayback(playing: boolean): void {
	const lyricPlayer = lyricPlayerRef.value;
	if (!playing) {
		lyricPlayer?.pause();
		void audioRuntime.setPlaying(false);
		return;
	}

	lyricPlayer?.resume();
	void audioRuntime.setPlaying(true);
}

function seekCoreToStoreTime(): void {
	const currentTime = player.audio.currentTime;
	audioRuntime.seek(currentTime);
	lyricPlayerRef.value?.setCurrentTime(Math.round(currentTime * 1000), true);
}

function startFrameLoop(): void {
	const onFrame = (time: number) => {
		if (lastFrameTime === -1) lastFrameTime = time;
		const delta = time - lastFrameTime;
		const lyricPlayer = lyricPlayerRef.value;
		const isPaused = audioRuntime.isPaused;

		if (!isPaused) {
			const currentTime = audioRuntime.currentTime;

			// 歌词需要逐帧精确的播放进度
			lyricPlayer?.setCurrentTime(Math.round(currentTime * 1000));

			// 播放器状态只用于刷新进度条等 UI，因此需要限频，
			// 且侧边栏不可见时完全不必刷新
			if (
				isProgressUiVisible() &&
				time - lastProgressSyncTime >= PROGRESS_SYNC_INTERVAL_MS
			) {
				lastProgressSyncTime = time;
				player.syncCurrentTime(currentTime);
			}
		} else if (!wasPaused) {
			// 暂停时补齐一次进度，避免 UI 停留在过期位置
			player.syncCurrentTime(audioRuntime.currentTime);
		}

		wasPaused = isPaused;

		lyricPlayer?.update(delta);
		lastFrameTime = time;
		frameId = requestAnimationFrame(onFrame);
	};

	frameId = requestAnimationFrame(onFrame);
}

function stopFrameLoop(): void {
	if (frameId) cancelAnimationFrame(frameId);
	frameId = 0;
	lastFrameTime = -1;
	lastProgressSyncTime = -Infinity;
}

function createLyricPlayer(): void {
	const host = playerEl.value;
	const lyricPlayer = new DomLyricPlayer();
	lyricPlayer.addEventListener("line-click", onLineClick);
	host?.appendChild(lyricPlayer.getElement());
	lyricPlayerRef.value = lyricPlayer;
}

function disposeLyricPlayer(): void {
	const lyricPlayer = lyricPlayerRef.value;
	if (!lyricPlayer) return;
	lyricPlayer.removeEventListener("line-click", onLineClick);
	lyricPlayer.dispose();
	lyricPlayerRef.value = undefined;
}

/**
 * 弹簧实现只在创建弹簧时生效，所以切换后需要连同底栏一起重建整个播放器
 */
function recreateLyricPlayer(): void {
	disposeLyricPlayer();
	createLyricPlayer();
	mountBackground();
	applyLyricSettings();
	applyPlayback(player.audio.playing);
	void loadLyric();
}

function onLineClick(event: Event): void {
	const lineEvent = event as LyricLineMouseEvent;
	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();
	player.seek(lineEvent.line.getLine().startTime / 1000);
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tagName = target.tagName.toLowerCase();
	return (
		tagName === "input" ||
		tagName === "textarea" ||
		tagName === "select" ||
		target.isContentEditable
	);
}

function onGlobalKeyDown(event: KeyboardEvent): void {
	if (event.defaultPrevented || isEditableTarget(event.target)) return;

	if (event.code === "Space") {
		event.preventDefault();
		player.togglePlayback();
		return;
	}

	if (event.code === "ArrowLeft") {
		event.preventDefault();
		player.seek(audioRuntime.currentTime - 5);
		return;
	}

	if (event.code === "ArrowRight") {
		event.preventDefault();
		player.seek(audioRuntime.currentTime + 5);
	}
}

onMounted(() => {
	const host = playerEl.value;
	if (!host) return;

	audioRuntime.attachStore(player);
	audioRuntime.mount(host);

	setSpringImplementation(player.lyric.springImplementation);
	createLyricPlayer();

	mountBackground();
	applyLyricSettings();
	applyMusicSource();
	applyPlayback(player.audio.playing);
	void loadLyric();
	startFrameLoop();
	window.addEventListener("keydown", onGlobalKeyDown);
});

onBeforeUnmount(() => {
	stopFrameLoop();
	window.removeEventListener("keydown", onGlobalKeyDown);

	disposeLyricPlayer();
});

watch(
	() => player.source.musicUrl,
	() => applyMusicSource(),
);

watch(
	() => [
		player.source.lyricUrl,
		player.source.lyricName,
		player.source.lyricRevision,
	],
	() => void loadLyric(),
);

watch(
	() => [
		player.source.albumUrl,
		player.source.albumName,
		player.source.albumRevision,
	],
	() => void backgroundRuntime.loadAlbum(player),
);

watch(
	() => player.audio.playing,
	(playing) => applyPlayback(playing),
);

watch(
	() => player.audio.seekRevision,
	() => seekCoreToStoreTime(),
);

watch(
	() => player.lyric.springImplementation,
	(impl) => {
		setSpringImplementation(impl);
		recreateLyricPlayer();
	},
);

watch(
	() => player.background.renderer,
	() => mountBackground(),
);

watch(
	() => [
		player.background.fps,
		player.background.scale,
		player.background.flowSpeed,
		player.background.staticMode,
		player.background.playing,
		player.background.isolation.lightWave,
		player.background.isolation.dithering,
		player.background.isolation.paletteAlgorithm,
	],
	() => backgroundRuntime.applySettings(player),
);

watch(
	() => [
		player.lyric.fadeWidth,
		player.lyric.enableBlur,
		player.lyric.enableSpring,
		player.lyric.verticalSpring.mass,
		player.lyric.verticalSpring.damping,
		player.lyric.verticalSpring.stiffness,
		player.lyric.verticalSpring.soft,
		player.lyric.scaleSpring.mass,
		player.lyric.scaleSpring.damping,
		player.lyric.scaleSpring.stiffness,
		player.lyric.scaleSpring.soft,
	],
	() => applyLyricSettings(),
);
</script>

<template>
	<SidebarTrigger
		class="z-1 absolute m-3.5 text-white hover:bg-white/25! hover:text-white"
	/>
	<main
		ref="playerEl"
		id="player"
		class="absolute top-0 right-0 bottom-0 left-0 overflow-hidden bg-black text-white"
		:style="{
			fontFamily: player.lyric.fontFamily || undefined,
			fontWeight: player.lyric.fontWeight
		}"
	/>
</template>
