import pluginBabel from "@rolldown/plugin-babel";
import { defineConfig } from "tsdown";
import { baseConfig } from "../../tsdown.base.ts";

export default defineConfig({
	...baseConfig,
	entry: { "amll-vue": "./src/index.ts" },
	dts: {
		tsgo: true,
	},
	plugins: [
		pluginBabel({
			plugins: ["@vue/babel-plugin-jsx"],
		}),
	],
});
