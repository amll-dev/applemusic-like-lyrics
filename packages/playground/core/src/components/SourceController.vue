<script setup lang="ts">
import {
	FileAudioIcon,
	FileTextIcon,
	ImageIcon,
	MusicIcon,
	RefreshCwIcon,
	TextAlignStartIcon,
} from "lucide-vue-next";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const lyric = ref("");
const music = ref("");
const album = ref("");
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
				<Button variant="outline" size="sm">
					<FileTextIcon />
					本地歌词
				</Button>
				<Button variant="outline" size="sm">
					<RefreshCwIcon />
					刷新歌词
				</Button>
			</div>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<MusicIcon :size="16" />
				音频
			</h3>
			<Input id="music-url" v-model="music" placeholder="音频文件 URI" />
			<Button class="w-full" variant="outline" size="sm">
				<FileAudioIcon />
				打开本地歌曲
			</Button>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<ImageIcon :size="16" />
				专辑图
			</h3>
			<Input id="album-url" v-model="album" placeholder="专辑图片 URI" />
			<div class="grid grid-cols-2 gap-2">
				<Button variant="outline" size="sm">
					<ImageIcon />
					本地图片
				</Button>
				<Button variant="outline" size="sm">
					<RefreshCwIcon />
					刷新图片
				</Button>
			</div>
		</section>
	</div>
</template>
