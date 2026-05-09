<script setup lang="ts">
import {
	ListIndentIncreaseIcon,
	MusicIcon,
	PackageIcon,
	PlayIcon,
} from "lucide-vue-next";
import type { SidebarProps } from "@/components/ui/sidebar";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	// SidebarMenu,
	// SidebarMenuItem,
} from "@/components/ui/sidebar";
import ModeToggle from "./ModeToggle.vue";
import Button from "./ui/button/Button.vue";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import Slider from "./ui/slider/Slider.vue";

const props = withDefaults(defineProps<SidebarProps>(), {});
</script>

<template>
	<Sidebar v-bind="props">
		<SidebarHeader class="border-b border-sidebar-border p-3">
			<div class="flex gap-2 items-center">
				<div
					class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
				>
					<PackageIcon class="size-4" />
				</div>
				<div class="flex flex-col gap-1 leading-none">
					<span class="font-medium"> AMLL Playground </span>
					<span class="text-xs/3 opacity-75"> Core v0.4.2 </span>
				</div>
			</div>
		</SidebarHeader>
		<SidebarContent> </SidebarContent>
		<SidebarFooter class="p-3 gap-2">
			<Slider class="mt-2 mb-2" :default-value="[50]" :max="100" :step="1" />
			<div class="flex gap-2 justify-between">
				<div class="flex gap-2">
					<Button> <PlayIcon /> </Button>
					<ButtonGroup>
						<Button variant="outline"> <MusicIcon /> </Button>
						<Button variant="outline"> <ListIndentIncreaseIcon /> </Button>
					</ButtonGroup>
				</div>
				<ModeToggle />
			</div>
		</SidebarFooter>
	</Sidebar>
</template>

<style>
[data-slot="sidebar-container"],
[data-slot="sidebar-gap"] {
	transition-timing-function: cubic-bezier(0, 0.8, 0.2, 1);
}

[data-slot="sidebar-inset"] {
	transition:
		margin 0.1s linear,
		padding 0.1s linear,
		border-radius 0.1s linear;

	[data-slot="sidebar"][data-collapsible="offcanvas"] + & {
		margin: 0;
		padding: calc(var(--spacing) * 2);
		border-radius: 0;
	}
}
</style>
