<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
</script>
<template>
	<SidebarProvider>
		<AppSidebar variant="inset" />
		<SidebarInset class="relative">
			<SidebarTrigger class="absolute m-3.5" />
		</SidebarInset>
	</SidebarProvider>
</template>
<style>
:root {
	scrollbar-width: thin;
	scrollbar-color: var(--border) transparent;
}
</style>
