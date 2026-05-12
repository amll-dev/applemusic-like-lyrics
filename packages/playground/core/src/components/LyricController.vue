<script setup lang="ts">
import {
	ArrowDownUpIcon,
	ExpandIcon,
	TypeIcon,
	WandIcon,
} from "lucide-vue-next";
import { Separator } from "@/components/ui/separator";
import { usePlayerStore } from "@/stores/player";
import ControllerSlider from "./ControllerSlider.vue";
import ControllerSliderGroup from "./ControllerSliderGroup.vue";
import ControllerSwitch from "./ControllerSwitch.vue";
import Input from "./ui/input/Input.vue";

const player = usePlayerStore();

const springFields = [
	{ key: "mass", label: "质量", min: 0.1, max: 5, step: 0.1 },
	{ key: "damping", label: "阻力", min: 0, max: 40, step: 0.5 },
	{ key: "stiffness", label: "弹性", min: 1, max: 300, step: 1 },
] as const;
</script>

<template>
	<div class="space-y-4 py-1">
		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<TypeIcon :size="16" />
				歌词字体
			</h3>
			<Input
				id="font-family"
				v-model="player.lyric.fontFamily"
				placeholder="Inter, sans-serif"
			/>
			<ControllerSliderGroup>
				<ControllerSlider
					v-model="player.lyric.fontWeight"
					title="字重"
					:min="100"
					:max="900"
					:step="100"
					:precision="0"
				/>
			</ControllerSliderGroup>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<WandIcon :size="16" />
				歌词行效果
			</h3>
			<ControllerSliderGroup>
				<ControllerSlider
					v-model="player.lyric.fadeWidth"
					title="歌词渐变宽度"
					:min="0"
					:max="3"
					:step="0.01"
					:precision="2"
				/>
			</ControllerSliderGroup>
			<ControllerSwitch
				v-model="player.lyric.enableBlur"
				title="歌词模糊"
				description="为非焦点行启用模糊效果"
			/>
			<ControllerSwitch
				v-model="player.lyric.enableSpring"
				title="使用弹簧动画"
				description="使用物理弹簧替代 CSS transition"
			/>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<ArrowDownUpIcon :size="16" />
				垂直位移弹簧
			</h3>
			<ControllerSliderGroup>
				<ControllerSlider
					v-for="field in springFields"
					:key="field.key"
					:title="field.label"
					:min="field.min"
					:max="field.max"
					:step="field.step"
					v-model="player.lyric.verticalSpring[field.key]"
				/>
			</ControllerSliderGroup>
			<ControllerSwitch
				v-model="player.lyric.verticalSpring.soft"
				title="强制软弹簧"
				description="阻力小于 1 时可用"
			/>
		</section>

		<Separator />

		<section class="space-y-2.5">
			<h3 class="text-sm font-bold flex items-center gap-1">
				<ExpandIcon :size="16" />
				缩放弹簧
			</h3>
			<ControllerSliderGroup>
				<ControllerSlider
					v-for="field in springFields"
					:key="field.key"
					:title="field.label"
					:min="field.min"
					:max="field.max"
					:step="field.step"
					v-model="player.lyric.scaleSpring[field.key]"
				/>
			</ControllerSliderGroup>
			<ControllerSwitch
				v-model="player.lyric.scaleSpring.soft"
				title="强制软弹簧"
				description="阻力小于 1 时可用"
			/>
		</section>
	</div>
</template>
