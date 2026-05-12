import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const corePackageJson = JSON.parse(
	readFileSync(path.resolve(__dirname, "../../core/package.json"), "utf-8"),
) as { version: string };

export default defineConfig({
	base: process.env.PLAYGROUND_BASE_URL || "/",
	define: {
		__AMLL_CORE_VERSION__: JSON.stringify(corePackageJson.version),
	},
	plugins: [vue(), tailwindcss()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@applemusic-like-lyrics/core": path.resolve(__dirname, "../../core/src"),
			"@applemusic-like-lyrics/core/style.css": path.resolve(
				__dirname,
				"../../core/src/styles/index.css",
			),
			"@applemusic-like-lyrics/lyric": path.resolve(
				__dirname,
				"../../lyric/src",
			),
			"@applemusic-like-lyrics/ttml": path.resolve(__dirname, "../../ttml/src"),
			"@amll-core-src": path.resolve(__dirname, "../../core/src"),
		},
	},
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: "ui",
							test: /node_modules[\\/](vue|@vue|pinia|@vueuse|reka-ui|@floating-ui|tailwind|lucide-vue-next)/,
							priority: 20,
						},
						{
							name: "renderer",
							test: /node_modules[\\/](@pixi|jss)/,
							priority: 15,
						},
						{
							name: "vendor",
							test: /node_modules/,
							priority: 10,
						},
						{
							name: "common",
							minShareCount: 2,
							minSize: 10000,
							priority: 5,
						},
					],
				},
			},
		},
	},
});
