<script setup lang="ts">
import { ArrowDownUpIcon, ExpandIcon, WandIcon } from "lucide-vue-next";
import { ref } from "vue";
import { Separator } from "@/components/ui/separator";
import ControllerSlider from "./ControllerSlider.vue";
import ControllerSliderGroup from "./ControllerSliderGroup.vue";
import ControllerSwitch from "./ControllerSwitch.vue";

interface SpringParams {
	mass: number[];
	damping: number[];
	stiffness: number[];
	soft: boolean;
}

const fadeWidth = ref([0.5]);
const enableBlur = ref(true);
const enableSpring = ref(true);

const verticalSpring = ref<SpringParams>({
	mass: [1],
	damping: [15],
	stiffness: [100],
	soft: false,
});

const scaleSpring = ref<SpringParams>({
	mass: [1],
	damping: [20],
	stiffness: [100],
	soft: false,
});

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
				<WandIcon :size="16" />
				歌词行效果
			</h3>
			<ControllerSliderGroup>
				<ControllerSlider
					v-model="fadeWidth"
					title="歌词渐变宽度"
					:min="0"
					:max="10"
					:step="0.01"
					:precision="2"
				/>
			</ControllerSliderGroup>
			<ControllerSwitch
				v-model="enableBlur"
				title="歌词模糊"
				description="为非焦点行启用模糊效果"
			/>
			<ControllerSwitch
				v-model="enableSpring"
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
					v-model="verticalSpring[field.key]"
				/>
			</ControllerSliderGroup>
			<ControllerSwitch
				v-model="verticalSpring.soft"
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
					v-model="scaleSpring[field.key]"
				/>
			</ControllerSliderGroup>
			<ControllerSwitch
				v-model="scaleSpring.soft"
				title="强制软弹簧"
				description="阻力小于 1 时可用"
			/>
		</section>
	</div>
</template>
