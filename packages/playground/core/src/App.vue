<script setup lang="ts">
import SidebarShell from "@/components/SidebarShell.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import LyricPlayer from "./components/MainPlayer.vue";
</script>
<template>
	<SidebarProvider>
		<SidebarShell variant="inset" />
		<SidebarInset class="relative overflow-hidden">
			<LyricPlayer />
		</SidebarInset>
	</SidebarProvider>
</template>
<style>
html,
body,
#app {
	margin: 0;
	min-height: 100%;
	overflow: hidden;
}

:root {
	scrollbar-width: thin;
	scrollbar-color: var(--border) transparent;
}
</style>
