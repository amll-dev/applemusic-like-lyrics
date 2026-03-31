import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: "src/index.ts",
			name: "AppleMusicLikeLyricsReact",
			fileName: "amll-react",
			formats: ["es"],
		},
		rollupOptions: {
			external: [
				"react",
				"react-dom",
				"react/jsx-runtime",
				"@applemusic-like-lyrics/core",
			],
		},
	},
	plugins: [
		react(),
		dts({
			exclude: ["src/test.tsx", "src/test-app.tsx"],
		}),
	],
});
