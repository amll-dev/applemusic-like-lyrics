import path from "node:path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
	resolve: {
		alias: {
			"@applemusic-like-lyrics/core/style.css": path.resolve(
				__dirname,
				"../../core/src/styles/index.css",
			),
			"@applemusic-like-lyrics/react": path.resolve(
				__dirname,
				"../../react/src",
			),
			"@applemusic-like-lyrics/core": path.resolve(__dirname, "../../core/src"),
			"@applemusic-like-lyrics/lyric": path.resolve(
				__dirname,
				"../../lyric/src",
			),
			"@react-full": path.resolve(__dirname, "../../react-full/src"),
		},
	},
	plugins: [
		svgr({
			svgrOptions: { ref: true },
		}),
	],
});
