<script setup lang="ts">
import { computed } from "vue";
import { Switch } from "@/components/ui/switch";

const props = defineProps<{
	modelValue: boolean;
	title: string;
	description: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
}>();

const value = computed({
	get: () => props.modelValue,
	set: (nextValue) => emit("update:modelValue", nextValue),
});
</script>

<template>
	<div class="flex items-center justify-between gap-3 rounded-md border p-2">
		<div>
			<div class="text-sm">{{ title }}</div>
			<div class="text-xs text-muted-foreground">{{ description }}</div>
		</div>
		<Switch v-model="value" />
	</div>
</template>
