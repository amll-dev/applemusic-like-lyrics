import react from "@vitejs/plugin-react";
import jotaiDebugLabel from "jotai-babel/plugin-debug-label";
import jotaiReactRefresh from "jotai-babel/plugin-react-refresh";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import dts from "vite-plugin-dts";
import svgr from "vite-plugin-svgr";
import wasm from "vite-plugin-wasm";

const ReactCompilerConfig = {
	target: "18",
};

export default defineConfig({
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: "src/index.ts",
			name: "AppleMusicLikeLyricsReactFramework",
			fileName: "amll-react-framework",
			formats: ["es"],
		},
		rollupOptions: {
			external: [
				"react",
				"react-dom",
				"react/jsx-runtime",
				"react-compiler-runtime",
				"@applemusic-like-lyrics/core",
				"jotai",
			],
		},
	},
	plugins: [
		wasm(),
		react(),
		babel({
			babelConfig: {
				plugins: [
					["babel-plugin-react-compiler", ReactCompilerConfig],
					jotaiDebugLabel,
					jotaiReactRefresh,
				],
			},
		}),
		dts({
			exclude: ["src/test.tsx", "src/test-app.tsx"],
		}),
		svgr({
			svgrOptions: {
				ref: true,
			},
			include: ["./src/**/*.svg?react"],
		}),
	],
});
