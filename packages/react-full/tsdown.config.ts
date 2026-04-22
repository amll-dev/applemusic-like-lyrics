import { readFileSync } from "node:fs";
import path from "node:path";
import pluginBabel from "@rolldown/plugin-babel";
import { transform } from "@svgr/core";
import { defineConfig } from "tsdown";
import { baseConfig } from "../../tsdown.base.ts";

const svgrQueryPlugin = {
	name: "svgr-react-query",
	resolveId(id: string, importer: string | undefined) {
		if (id.endsWith("?react")) {
			const rawPath = id.slice(0, -6);
			const base = importer ? `file://${importer}` : `file://${process.cwd()}/`;
			const resolved = new URL(rawPath, base).pathname.replace(
				/^\/([A-Za-z]:)/,
				"$1",
			);
			return `\0svgr:${resolved}`;
		}
	},
	async load(id: string) {
		if (id.startsWith("\0svgr:")) {
			const file = id.slice(6);
			const svg = readFileSync(file, "utf-8");

			const code = await transform(
				svg,
				{ ref: true, plugins: ["@svgr/plugin-jsx"] },
				{ filePath: file },
			);
			return { code, moduleType: "jsx" };
		}
	},
};

const cssUrlSvgInlinePlugin = {
	name: "css-url-svg-inline",
	transform(code: string, id: string) {
		if (!id.endsWith(".css")) return;
		const replaced = code.replace(
			/url\(\s*(['"]?)([^)'"]+\.svg)\1\s*\)/g,
			(_, _quote, svgPath) => {
				const resolved = path.resolve(path.dirname(id), svgPath);
				const svg = readFileSync(resolved, "utf-8");
				const encoded = encodeURIComponent(svg);
				return `url("data:image/svg+xml,${encoded}")`;
			},
		);
		return replaced !== code ? { code: replaced } : undefined;
	},
};

export default defineConfig({
	...baseConfig,
	entry: { "amll-react-framework": "./src/index.ts" },
	plugins: [
		cssUrlSvgInlinePlugin,
		svgrQueryPlugin,
		pluginBabel({
			plugins: [
				["babel-plugin-react-compiler", { target: "19" }],
				"jotai-babel/plugin-debug-label",
				"jotai-babel/plugin-react-refresh",
			],
		}),
	],
});
