// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { Application, PageEvent } from "typedoc";
import {} from "typedoc-plugin-markdown";

import react from "@astrojs/react";

/** @type {import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions} */
const typeDocConfigBaseOptions = {
	// TypeDoc options
	// https://typedoc.org/options/
	githubPages: false,
	hideGenerator: true,
	plugin: [
		"typedoc-plugin-markdown",
		"typedoc-plugin-mark-react-functional-components",
		"typedoc-plugin-vue",
	],
	readme: "none",
	logLevel: "Warn",
	parametersFormat: "table",
	// typedoc-plugin-markdown options
	// https://github.com/tgreyuk/typedoc-plugin-markdown/blob/next/packages/typedoc-plugin-markdown/docs/usage/options.md
	outputFileStrategy: "members",
	flattenOutputFiles: true,
	entryFileName: "index.md",
	hidePageHeader: true,
	hidePageTitle: true,
	hideBreadcrumbs: true,
	useCodeBlocks: true,
	propertiesFormat: "table",
	typeDeclarationFormat: "table",
	useHTMLAnchors: true,
};

async function generateDoc() {
	/**
	 * @param {import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions} cfg
	 */
	async function generateOneDoc(cfg) {
		/** @type {import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions} */
		const config = {
			...typeDocConfigBaseOptions,
			...cfg,
		};
		/** @type {import('typedoc-plugin-markdown').MarkdownApplication} */
		const app = await Application.bootstrapWithPlugins(config);

		/**
		 * @param {import('typedoc').PageEvent} evt
		 */
		function generateFrontmatter(evt) {
			const content = ["---"];
			if (evt.model.name.startsWith("@applemusic-like-lyrics/")) {
				content.push(`title: "索引"`);
			} else {
				content.push(`title: "${evt.model.name}"`);
			}
			content.push(`pageKind: ${evt.pageKind}`);
			content.push("editUrl: false");
			// content.push("sidebar:");
			// content.push("  badge:");
			// content.push("    text: Class");
			// content.push("    variant: tip");
			content.push("---");
			content.push("<!-- This file is generated, do not edit directly! -->");
			content.push(evt.contents || "");
			evt.contents = content.join("\n");
		}

		app.renderer.on(PageEvent.END, generateFrontmatter);

		const project = await app.convert();

		if (project) {
			await app.generateOutputs(project);
		}
	}

	await generateOneDoc({
		entryPoints: ["../core/src/index.ts"],
		tsconfig: "../core/tsconfig.json",
		out: "./src/content/docs/reference/core",
	});

	await generateOneDoc({
		entryPoints: ["../react/src/index.ts"],
		tsconfig: "../react/tsconfig.json",
		out: "./src/content/docs/reference/react",
	});

	await generateOneDoc({
		entryPoints: ["../vue/src/index.ts"],
		tsconfig: "../vue/tsconfig.json",
		out: "./src/content/docs/reference/vue",
	});

	await generateOneDoc({
		entryPoints: ["../react-full/src/index.ts"],
		tsconfig: "../react-full/tsconfig.json",
		out: "./src/content/docs/reference/react-full",
	});

	await generateOneDoc({
		// entryPoints: ["../lyric/pkg/amll_lyric.d.ts"],
		entryPoints: ["../lyric/src/types.d.ts"],
		tsconfig: "../lyric/tsconfig.json",
		out: "./src/content/docs/reference/lyric",
	});
}

// https://astro.build/config
export default defineConfig({
	base: "applemusic-like-lyrics",
	integrations: [
		react(),
		starlight({
			favicon: "favicon.ico",
			title: "Apple Music-like Lyrics",
			customCss: ["./src/styles/custom.css"],
			locales: {
				root: {
					label: "简体中文",
					lang: "zh-CN",
				},
				en: {
					label: "English",
					lang: "en",
				},
			},
			social: {
				github: "https://github.com/Steve-xmh/applemusic-like-lyrics",
			},
			plugins: [
				{
					name: "typedoc",
					hooks: {
						"config:setup": async (cfg) => {
							cfg.logger.info("Generating typedoc...");
							await generateDoc();
							cfg.logger.info("Finished typedoc generation");
						},
					},
				},
			],
			sidebar: [
				{
					label: "核心组件",
					items: [{ slug: "guides/core/introduction" }],
				},
				{
					label: "React 绑定",
					items: [
						{ slug: "guides/react/introduction" },
						{ slug: "guides/react/quick-start" },
						{ slug: "guides/react/lyric-player" },
						{ slug: "guides/react/bg-render" },
					],
				},
				{
					label: "AMLL TTML Tools",
					items: [
						{ slug: "guides/ttml-tools/introduction" },
						{ slug: "guides/ttml-tools/tips" },
					],
				},
				{
					label: "接口参考",
					items: [
						{
							label: "Core 核心模块",
							collapsed: true,
							autogenerate: {
								directory: "reference/core",
								collapsed: true,
							},
						},
						{
							label: "React 绑定模块",
							collapsed: true,
							autogenerate: {
								directory: "reference/react",
								collapsed: true,
							},
						},
						{
							label: "React Full 组件库模块",
							collapsed: true,
							autogenerate: {
								directory: "reference/react-full",
								collapsed: true,
							},
						},
						{
							label: "Vue 绑定模块",
							collapsed: true,
							autogenerate: {
								directory: "reference/vue",
								collapsed: true,
							},
						},
						{
							label: "Lyric 歌词模块",
							collapsed: true,
							autogenerate: {
								directory: "reference/lyric",
								collapsed: true,
							},
						},
						// coreTypeDocSidebarGroup,
						// reactTypeDocSidebarGroup,
						// vueTypeDocSidebarGroup,
						// reactFullTypeDocSidebarGroup,
						// lyricTypeDocSidebarGroup,
					],
				},
			],
		}),
	],
});
