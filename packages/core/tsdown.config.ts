import { defineConfig } from "tsdown";
import { baseConfig } from "../../tsdown.base.ts";

export default defineConfig({
	...baseConfig,
	entry: { "amll-core": "./src/index.ts" },
	inputOptions: {
		moduleTypes: {
			".glsl": "text",
		},
	},
	define: {
		"import.meta.env.DEV": "process.env.NODE_ENV !== 'production'",
	},
});
