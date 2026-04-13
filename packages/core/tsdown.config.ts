import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";
import { baseConfig } from "../../tsdown.base.ts";

const rawQueryPlugin = {
	name: "raw-query",
	resolveId(id: string, importer: string | undefined) {
		if (id.endsWith("?raw")) {
			const rawPath = id.slice(0, -4);
			const base = importer ? `file://${importer}` : `file://${process.cwd()}/`;
			const resolved = new URL(rawPath, base).pathname.replace(
				/^\/([A-Za-z]:)/,
				"$1",
			);
			return `\0raw:${resolved}`;
		}
	},
	load(id: string) {
		if (id.startsWith("\0raw:")) {
			const file = id.slice(5);
			const content = readFileSync(file, "utf-8");
			return `export default ${JSON.stringify(content)}`;
		}
	},
};

export default defineConfig({
	...baseConfig,
	entry: { "amll-core": "./src/index.ts" },
	plugins: [rawQueryPlugin],
	define: {
		"import.meta.env.DEV": "process.env.NODE_ENV !== 'production'",
	},
});
