<script setup lang="ts">
import { BrushIcon, MonitorPlayIcon } from "lucide-vue-next";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePlayerStore } from "@/stores/player";
import ControllerSlider from "./ControllerSlider.vue";
import ControllerSliderGroup from "./ControllerSliderGroup.vue";
import ControllerSwitch from "./ControllerSwitch.vue";

const player = usePlayerStore();
</script>

<template>
	<div class="space-y-4 py-1">
		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<MonitorPlayIcon :size="16" />
				播放状态
			</h3>
			<ControllerSwitch
				v-model="player.background.playing"
				title="播放"
				description="暂停或恢复背景动画"
			/>
			<ControllerSwitch
				v-model="player.background.staticMode"
				title="静态模式"
				description="固定背景流动状态"
			/>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<BrushIcon :size="16" />
				渲染选项
			</h3>
			<Select v-model="player.background.renderer">
				<SelectTrigger class="w-full">
					<SelectValue placeholder="选择渲染器" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="mg">Mesh Gradient 渲染器</SelectItem>
					<SelectItem value="pixi">Pixi 渲染器</SelectItem>
				</SelectContent>
			</Select>

			<ControllerSliderGroup>
				<ControllerSlider
					v-model="player.background.scale"
					title="分辨率比率"
					:min="0.01"
					:max="1"
					:step="0.01"
					:precision="2"
				/>
				<ControllerSlider
					v-model="player.background.fps"
					title="帧率"
					:min="1"
					:max="240"
					:step="1"
					suffix="FPS"
				/>
				<ControllerSlider
					v-model="player.background.flowSpeed"
					title="流动速度"
					:min="0"
					:max="5"
					:step="0.1"
					:precision="1"
				/>
			</ControllerSliderGroup>
		</section>
	</div>
</template>
