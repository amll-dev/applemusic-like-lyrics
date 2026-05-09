<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { MoonIcon, SunIcon, SunMoonIcon } from "lucide-vue-next";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mode = useColorMode({ disableTransition: false });
const switchToLight = () => (mode.value = "light");
const switchToDark = () => (mode.value = "dark");
const switchToSystem = () => (mode.value = "auto");

const isLight = computed(() => mode.value === "light");
const isDark = computed(() => mode.value === "dark");
</script>

<template>
	<DropdownMenu>
		<DropdownMenuTrigger as-child>
			<Button variant="outline">
				<SunIcon v-if="isLight" />
				<MoonIcon v-else-if="isDark" />
				<SunMoonIcon v-else />
				<span class="sr-only">Toggle theme</span>
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			<DropdownMenuItem @click="switchToLight"> Light </DropdownMenuItem>
			<DropdownMenuItem @click="switchToDark"> Dark </DropdownMenuItem>
			<DropdownMenuItem @click="switchToSystem"> System </DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</template>
