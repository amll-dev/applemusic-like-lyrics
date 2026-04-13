import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
	plugins: [
		svgr({
			svgrOptions: { ref: true },
		}),
	],
});
