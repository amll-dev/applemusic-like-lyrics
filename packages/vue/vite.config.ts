import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import wasm from "vite-plugin-wasm";

export default defineConfig({
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: "src/index.ts",
			name: "AppleMusicLikeLyricsVue",
			fileName: "amll-vue",
			formats: ["es"],
		},
		rollupOptions: {
			external: ["vue", "@applemusic-like-lyrics/core"],
		},
	},
	plugins: [
		vue(),
		wasm(),
		vueJsx(),
		dts({
			exclude: ["src/test.ts", "src/test-app.vue"],
		}),
	],
});
