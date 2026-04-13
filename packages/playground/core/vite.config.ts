import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		alias: {
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
