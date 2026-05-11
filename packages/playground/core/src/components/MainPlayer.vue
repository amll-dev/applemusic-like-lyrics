<script setup lang="ts">
import { SidebarTrigger } from "./ui/sidebar";
</script>

<template>
	<SidebarTrigger
		class="z-1 absolute m-3.5 text-white hover:bg-white/25! hover:text-white"
	/>
	<main
		id="player"
		class="absolute top-0 right-0 bottom-0 left-0 bg-black text-white"
	>
		Hello World
	</main>
</template>
