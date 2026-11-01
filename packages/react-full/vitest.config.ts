import path from "node:path";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@applemusic-like-lyrics/core": path.resolve(
				import.meta.dirname,
				"../core/src",
			),
			"@applemusic-like-lyrics/react": path.resolve(
				import.meta.dirname,
				"../react/src",
			),
		},
	},
	plugins: [
		svgr({
			svgrOptions: { ref: true },
		}),
	],
	test: {
		environment: "happy-dom",
	},
});
