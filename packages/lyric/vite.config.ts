import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	build: {
		lib: {
			entry: "./src/index.ts",
			name: "AppleMusicLikeLyricsLyric",
			fileName: "amll-lyric",
		},
		rollupOptions: {
			external: ["@applemusic-like-lyrics/core"],
		},
	},
	plugins: [dts()],
});
