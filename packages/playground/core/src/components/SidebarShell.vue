<script setup lang="ts">
import amllLogoSvg from "@/assets/amll-logo.svg";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	type SidebarProps,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AudioPlayer from "./AudioController.vue";
import BackgroundController from "./BackgroundController.vue";
import LyricController from "./LyricController.vue";
import SourceController from "./SourceController.vue";

const props = withDefaults(defineProps<SidebarProps>(), {});
const coreVersion = __AMLL_CORE_VERSION__;
</script>

<template>
	<Sidebar v-bind="props">
		<SidebarHeader class="border-b border-sidebar-border p-3">
			<div class="flex gap-2 items-center">
				<div
					class="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-sidebar-primary-foreground overflow-hidden"
				>
					<img :src="amllLogoSvg">
				</div>
				<div class="flex flex-col gap-1 leading-none">
					<span class="font-medium"> AMLL Playground </span>
					<span class="text-xs/3 opacity-75"> Core v{{ coreVersion }} </span>
				</div>
			</div>
		</SidebarHeader>
		<SidebarContent class="p-3">
			<Tabs default-value="source">
				<TabsList class="flex w-[unset]">
					<TabsTrigger value="source"> 源 </TabsTrigger>
					<TabsTrigger value="lyric"> 歌词 </TabsTrigger>
					<TabsTrigger value="background"> 背景 </TabsTrigger>
				</TabsList>
				<TabsContent value="source"> <SourceController /> </TabsContent>
				<TabsContent value="background"> <BackgroundController /> </TabsContent>
				<TabsContent value="lyric"> <LyricController /> </TabsContent>
			</Tabs>
		</SidebarContent>
		<AudioPlayer />
	</Sidebar>
</template>

<style>
[data-slot="sidebar-container"],
[data-slot="sidebar-gap"] {
	transition: none;
}

[data-slot="sidebar"][data-collapsible="offcanvas"]
	+ [data-slot="sidebar-inset"] {
	margin: 0;
	padding: calc(var(--spacing) * 2);
	border-radius: 0;
}
</style>
