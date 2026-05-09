<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { ContrastIcon, MoonIcon, SunIcon } from "lucide-vue-next";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const { store } = useColorMode();
const switchToLight = () => (store.value = "light");
const switchToDark = () => (store.value = "dark");
const switchToSystem = () => (store.value = "auto");

const isLight = computed(() => store.value === "light");
const isDark = computed(() => store.value === "dark");
</script>

<template>
	<DropdownMenu>
		<DropdownMenuTrigger as-child>
			<Button variant="outline">
				<SunIcon v-if="isLight" />
				<MoonIcon v-else-if="isDark" />
				<ContrastIcon v-else />
				<span class="sr-only">Toggle theme</span>
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			<DropdownMenuItem @click="switchToLight"> 亮色 </DropdownMenuItem>
			<DropdownMenuItem @click="switchToDark"> 暗色 </DropdownMenuItem>
			<DropdownMenuItem @click="switchToSystem"> 跟随系统 </DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</template>
