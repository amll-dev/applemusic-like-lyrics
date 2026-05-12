<script setup lang="ts">
import {
	FileAudioIcon,
	FileTextIcon,
	ImageIcon,
	MusicIcon,
	RefreshCwIcon,
	TextAlignStartIcon,
} from "lucide-vue-next";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { extractCoverBlob } from "@/lib/extract-cover";
import { usePlayerStore } from "@/stores/player";

const player = usePlayerStore();

const lyric = computed({
	get: () => player.source.lyricUrl,
	set: (value) => player.setLyricUrl(String(value)),
});
const music = computed({
	get: () => player.source.musicUrl,
	set: (value) => player.setMusicUrl(String(value)),
});
const album = computed({
	get: () => player.source.albumUrl,
	set: (value) => player.setAlbumUrl(String(value)),
});

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
	<div class="space-y-4 py-1">
		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<TextAlignStartIcon :size="16" />
				歌词
			</h3>
			<Input id="lyric-url" v-model="lyric" placeholder="歌词文件 URI" />
			<div class="grid grid-cols-2 gap-2">
				<Button
					variant="outline"
					size="sm"
					@click="openFile('.ttml,.lrc,.alrc,.yrc,.lys,.lyl,.lqe,.qrc,.eslrc', player.setLocalLyricFile)"
				>
					<FileTextIcon />
					本地歌词
				</Button>
				<Button variant="outline" size="sm" @click="player.reloadLyric">
					<RefreshCwIcon />
					刷新歌词
				</Button>
			</div>
			<p v-if="player.lyric.error" class="text-xs text-destructive">
				{{ player.lyric.error }}
			</p>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<MusicIcon :size="16" />
				音频
			</h3>
			<Input id="music-url" v-model="music" placeholder="音频文件 URI" />
			<Button
				class="w-full"
				variant="outline"
				size="sm"
				@click="openFile('audio/*', openLocalMusicFile)"
			>
				<FileAudioIcon />
				打开本地歌曲
			</Button>
			<p v-if="player.audio.error" class="text-xs text-destructive">
				{{ player.audio.error }}
			</p>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<ImageIcon :size="16" />
				专辑图
			</h3>
			<Input id="album-url" v-model="album" placeholder="专辑图片 URI" />
			<div class="grid grid-cols-2 gap-2">
				<Button
					variant="outline"
					size="sm"
					@click="openFile('image/*,video/*', player.setLocalAlbumFile)"
				>
					<ImageIcon />
					本地图片
				</Button>
				<Button variant="outline" size="sm" @click="player.reloadAlbum">
					<RefreshCwIcon />
					刷新图片
				</Button>
			</div>
			<p v-if="player.background.error" class="text-xs text-destructive">
				{{ player.background.error }}
			</p>
		</section>
	</div>
</template>
