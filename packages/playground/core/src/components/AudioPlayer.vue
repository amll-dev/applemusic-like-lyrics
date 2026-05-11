<script setup lang="ts">
import { ListIndentIncreaseIcon, MusicIcon, PlayIcon } from "lucide-vue-next";
import ModeToggle from "./ModeToggle.vue";
import Button from "./ui/button/Button.vue";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import SidebarFooter from "./ui/sidebar/SidebarFooter.vue";
</script>

<template>
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
</template>
