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
		rollupOptions: {
			output: {
				manualChunks(rawId) {
					if (!rawId.includes("node_modules")) return;
					const id = rawId.split("node_modules/.bun/")[1];
					if (
						id.startsWith("vue") ||
						id.startsWith("@vue") ||
						id.startsWith("pinia") ||
						id.startsWith("@vueuse") ||
						id.startsWith("reka-ui") ||
						id.startsWith("@floating-ui") ||
						id.startsWith("tailwind") ||
						id.startsWith("lucide-vue-next")
					)
						return "ui";
					if (id.startsWith("@pixi") || id.startsWith("jss")) return "renderer";
					return "vendor";
				},
			},
		},
	},
});
