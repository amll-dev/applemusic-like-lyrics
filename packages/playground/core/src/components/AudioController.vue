<script setup lang="ts">
import {
	ImageIcon,
	MusicIcon,
	PauseIcon,
	PlayIcon,
	TextAlignStartIcon,
} from "lucide-vue-next";
import { ref } from "vue";
import ModeToggle from "./ModeToggle.vue";
import Button from "./ui/button/Button.vue";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import SidebarFooter from "./ui/sidebar/SidebarFooter.vue";
import Slider from "./ui/slider/Slider.vue";

const currentTime = ref([0]);
const isPlaying = ref(false);
</script>

<template>
	<SidebarFooter class="border-t border-sidebar-border bg-sidebar p-3 gap-2">
		<div
			class="flex items-center justify-between px-1 text-xs text-muted-foreground"
		>
			<span>{{ currentTime[0] }}s</span>
			<span>00:00</span>
		</div>
		<Slider v-model="currentTime" class="mt-1 mb-2" :max="300" :step="1" />
		<div class="flex gap-2 justify-between">
			<div class="flex gap-2">
				<Button size="icon" @click="isPlaying = !isPlaying">
					<PauseIcon v-if="isPlaying" />
					<PlayIcon v-else />
				</Button>
				<ButtonGroup>
					<Button variant="outline" size="icon" aria-label="打开歌词">
						<TextAlignStartIcon />
					</Button>
					<Button variant="outline" size="icon" aria-label="打开歌曲">
						<MusicIcon />
					</Button>
					<Button variant="outline" size="icon" aria-label="打开专辑图">
						<ImageIcon />
					</Button>
				</ButtonGroup>
			</div>
			<ModeToggle />
		</div>
	</SidebarFooter>
</template>
