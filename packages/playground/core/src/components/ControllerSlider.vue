<script setup lang="ts">
import { computed } from "vue";
import { Slider } from "@/components/ui/slider";

const props = withDefaults(
	defineProps<{
		modelValue: number;
		title: string;
		min: number;
		max: number;
		step: number;
		precision?: number;
		suffix?: string;
	}>(),
	{
		precision: undefined,
		suffix: "",
	},
);

const emit = defineEmits<{
	"update:modelValue": [value: number];
}>();

const value = computed({
	get: () => [props.modelValue],
	set: (nextValue) => emit("update:modelValue", nextValue[0] ?? props.min),
});

const displayValue = computed(() => {
	const currentValue = props.modelValue;
	const formattedValue =
		props.precision === undefined
			? String(currentValue)
			: currentValue.toFixed(props.precision);

	return props.suffix ? `${formattedValue} ${props.suffix}` : formattedValue;
});
</script>

<template>
	<div class="space-y-2">
		<div class="flex items-center justify-between text-xs">
			<span class="font-medium text-muted-foreground">{{ title }}</span>
			<span>{{ displayValue }}</span>
		</div>
		<Slider class="my-1" v-model="value" :min="min" :max="max" :step="step" />
	</div>
</template>
