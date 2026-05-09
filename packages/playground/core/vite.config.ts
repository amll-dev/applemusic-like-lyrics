import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
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
});
