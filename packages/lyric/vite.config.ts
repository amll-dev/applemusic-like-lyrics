import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import wasm from "vite-plugin-wasm";

export default defineConfig({
	build: {
		lib: {
			entry: "./src/index.ts",
			name: "AppleMusicLikeLyricsLyric",
			fileName: "amll-lyric",
		},
		rollupOptions: {
			external: [
				"@applemusic-like-lyrics/core",
				"../../pkg/amll_lyric.js",
				"../pkg/amll_lyric.js",
				"./pkg/amll_lyric.js",
			],
		},
	},
	plugins: [wasm(), dts()],
});
