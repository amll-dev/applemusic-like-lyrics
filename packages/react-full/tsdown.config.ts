import pluginBabel from "@rolldown/plugin-babel";
import svgr from "@svgr/rollup";
import { defineConfig } from "tsdown";
import { baseConfig } from "../../tsdown.base.ts";

export default defineConfig({
	...baseConfig,
	entry: { "amll-react-framework": "./src/index.ts" },
	plugins: [
		svgr({
			ref: true,
		}),
		pluginBabel({
			plugins: [
				["babel-plugin-react-compiler", { target: "19" }],
				"jotai-babel/plugin-debug-label",
				"jotai-babel/plugin-react-refresh",
			],
		}),
	],
});
