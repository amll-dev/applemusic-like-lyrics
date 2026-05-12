<script setup lang="ts">
import {
	ImageIcon,
	MusicIcon,
	PauseIcon,
	PlayIcon,
	TextAlignStartIcon,
} from "lucide-vue-next";
import { computed } from "vue";
import { extractCoverBlob } from "@/lib/extract-cover";
import { usePlayerStore } from "@/stores/player";
import ModeToggle from "./ModeToggle.vue";
import Button from "./ui/button/Button.vue";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import SidebarFooter from "./ui/sidebar/SidebarFooter.vue";
import Slider from "./ui/slider/Slider.vue";

const player = usePlayerStore();

const currentTime = computed({
	get: () => [player.audio.currentTime],
	set: (value) => player.seek(value[0] ?? 0),
});

const maxTime = computed(() =>
	Math.max(1, player.audio.duration, player.audio.currentTime),
);

const currentTimeLabel = computed(() => formatTime(player.audio.currentTime));
const durationLabel = computed(() => formatTime(player.audio.duration));

function formatTime(time: number): string {
	const normalizedTime = Math.max(0, Number.isFinite(time) ? time : 0);
	const minutes = Math.floor(normalizedTime / 60);
	const seconds = Math.floor(normalizedTime % 60);
	return `${minutes.toString().padStart(2, "0")}:${seconds
		.toString()
		.padStart(2, "0")}`;
}

function openFile(accept: string, onFile: (file: File) => void): void {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = accept;
	input.onchange = () => {
		const file = input.files?.[0];
		if (file) onFile(file);
	};
	input.click();
}

async function openLocalMusicFile(file: File): Promise<void> {
	player.setLocalMusicFile(file);
	try {
		const cover = await extractCoverBlob(file);
		if (cover) {
			player.setExtractedAlbumBlob(cover, `${file.name} cover`);
		} else {
			player.clearExtractedAlbum();
		}
	} catch {
		player.clearExtractedAlbum();
	}
}
</script>

<template>
	<SidebarFooter class="border-t border-sidebar-border bg-sidebar p-3 gap-2">
		<div
			class="flex items-center justify-between px-1 text-xs text-muted-foreground"
		>
			<span>{{ currentTimeLabel }}</span>
			<span>{{ durationLabel }}</span>
		</div>
		<Slider
			v-model="currentTime"
			class="mt-1 mb-2"
			:max="maxTime"
			:step="1"
			:disabled="!player.source.musicUrl"
		/>
		<div class="flex gap-2 justify-between">
			<div class="flex gap-2">
				<Button
					size="icon"
					:aria-label="player.audio.playing ? '暂停' : '播放'"
					@click="player.togglePlayback"
					:disabled="!player.source.musicUrl"
				>
					<PauseIcon v-if="player.audio.playing" />
					<PlayIcon v-else />
				</Button>
				<ButtonGroup>
					<Button
						variant="outline"
						size="icon"
						aria-label="打开歌词"
						@click="openFile('.ttml,.lrc,.alrc,.yrc,.lys,.lyl,.lqe,.qrc,.eslrc', player.setLocalLyricFile)"
					>
						<TextAlignStartIcon />
					</Button>
					<Button
						variant="outline"
						size="icon"
						aria-label="打开歌曲"
						@click="openFile('audio/*', openLocalMusicFile)"
					>
						<MusicIcon />
					</Button>
					<Button
						variant="outline"
						size="icon"
						aria-label="打开专辑图"
						@click="openFile('image/*,video/*', player.setLocalAlbumFile)"
					>
						<ImageIcon />
					</Button>
				</ButtonGroup>
			</div>
			<ModeToggle />
		</div>
	</SidebarFooter>
</template>
