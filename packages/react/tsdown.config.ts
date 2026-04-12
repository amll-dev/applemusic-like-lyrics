import { defineConfig } from "tsdown";
import { baseConfig } from "../../tsdown.base.ts";

export default defineConfig({
	...baseConfig,
	entry: { "amll-react": "./src/index.ts" },
});
