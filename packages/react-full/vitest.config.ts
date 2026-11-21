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
		execArgv:
			Number.parseInt(process.versions.node, 10) >= 25
				? ["--no-webstorage"]
				: [],
		// Node 25+ 默认在 globalThis 上声明了 localStorage，但是不额外配置的话是 undefined
		// 这导致 happy-dom 的 localStorage 也无法使用，所以手动关掉
	},
});
