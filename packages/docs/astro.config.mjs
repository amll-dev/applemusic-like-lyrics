// @ts-check

import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightSidebarTopics from "starlight-sidebar-topics";
import { Application, PageEvent } from "typedoc";

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
	 * Convert a TypeDoc markdown file link (e.g. Interface.Foo.md#bar)
	 * to the Starlight route (e.g. /reference/core/interfacefoo/#bar).
	 * @param {string} href
	 * @param {string} routeBase
	 */
	function convertTypeDocHrefToRoute(href, routeBase) {
		const trimmedHref = href.trim();
		if (
			trimmedHref.startsWith("#") ||
			trimmedHref.startsWith("http://") ||
			trimmedHref.startsWith("https://") ||
			trimmedHref.startsWith("mailto:")
		) {
			return href;
		}

		const [filePartRaw, hashPart] = trimmedHref.split("#", 2);
		const filePart = filePartRaw.replace(/^\.?\//, "");
		if (!filePart.toLowerCase().endsWith(".md")) return href;

		const fileName = filePart.split("/").pop();
		if (!fileName) return href;

		const stem = fileName.replace(/\.md$/i, "");
		const normalizedBase = routeBase.endsWith("/")
			? routeBase.slice(0, -1)
			: routeBase;

		if (stem.toLowerCase() === "index") {
			return hashPart ? `${normalizedBase}/#${hashPart}` : `${normalizedBase}/`;
		}

		const slug = stem.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
		const route = `${normalizedBase}/${slug}/`;
		return hashPart ? `${route}#${hashPart}` : route;
	}

	/**
	 * @param {import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions & { routeBase?: string }} cfg
	 */
	async function generateOneDoc(cfg) {
		const { routeBase = "", ...typedocConfig } = cfg;

		/** @type {import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions} */
		const config = {
			...typeDocConfigBaseOptions,
			...typedocConfig,
		};
		const app =
			/** @type {import('typedoc-plugin-markdown').MarkdownApplication} */ (
				/** @type {unknown} */ (await Application.bootstrapWithPlugins(config))
			);

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

			let docContent = evt.contents || "";
			if (routeBase) {
				docContent = docContent
					.replace(/\]\(([^)\n]+)\)/g, (_raw, href) => {
						const converted = convertTypeDocHrefToRoute(href, routeBase);
						return `](${converted})`;
					})
					.replace(/href="([^"\n]+)"/g, (_raw, href) => {
						const converted = convertTypeDocHrefToRoute(href, routeBase);
						return `href="${converted}"`;
					});
			}

			content.push(docContent);
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
		routeBase: "/reference/core",
	});

	await generateOneDoc({
		entryPoints: ["../react/src/index.ts"],
		tsconfig: "../react/tsconfig.json",
		out: "./src/content/docs/reference/react",
		routeBase: "/reference/react",
	});

	await generateOneDoc({
		entryPoints: ["../vue/src/index.ts"],
		tsconfig: "../vue/tsconfig.json",
		out: "./src/content/docs/reference/vue",
		routeBase: "/reference/vue",
	});

	await generateOneDoc({
		entryPoints: ["../react-full/src/index.ts"],
		tsconfig: "../react-full/tsconfig.json",
		out: "./src/content/docs/reference/react-full",
		routeBase: "/reference/react-full",
	});

	await generateOneDoc({
		entryPoints: ["../lyric/src/index.ts"],
		tsconfig: "../lyric/tsconfig.json",
		skipErrorChecking: true,
		out: "./src/content/docs/reference/lyric",
		routeBase: "/reference/lyric",
	});

	await generateOneDoc({
		entryPoints: ["../ttml/src/index.ts"],
		tsconfig: "../ttml/tsconfig.json",
		skipErrorChecking: true,
		out: "./src/content/docs/reference/ttml",
		routeBase: "/reference/ttml",
	});
}

// https://astro.build/config
const docsSidebar = [
	{
		label: "概览",
		items: [
			{ slug: "guides/overview/intro" },
			{ slug: "guides/overview/quickstart" },
			{ slug: "guides/overview/eco" },
		],
	},
	// {
	// 	label: "核心组件",
	// 	items: [
	// 		{ slug: "guides/core/introduction" },
	// 	],
	// },
	{
		label: "React 绑定",
		items: [
			{ slug: "guides/react/introduction" },
			{ slug: "guides/react/quick-start" },
			{ slug: "guides/react/lyric-player" },
			{ slug: "guides/react/bg-render" },
		],
	},
];

const referenceSidebar = [
	{
		label: "Core 核心",
		collapsed: true,
		autogenerate: {
			directory: "reference/core",
			collapsed: true,
		},
	},
	{
		label: "React 绑定",
		collapsed: true,
		autogenerate: {
			directory: "reference/react",
			collapsed: true,
		},
	},
	{
		label: "React Full 组件库",
		collapsed: true,
		autogenerate: {
			directory: "reference/react-full",
			collapsed: true,
		},
	},
	{
		label: "Vue 绑定",
		collapsed: true,
		autogenerate: {
			directory: "reference/vue",
			collapsed: true,
		},
	},
	{
		label: "Lyric 歌词处理",
		collapsed: true,
		autogenerate: {
			directory: "reference/lyric",
			collapsed: true,
		},
	},
	{
		label: "TTML 歌词处理",
		collapsed: true,
		autogenerate: {
			directory: "reference/ttml",
			collapsed: true,
		},
	},
];

const contributeSidebar = [
	{
		label: "开发指南",
		items: [
			{ slug: "contribute/development/environments" },
			{ slug: "contribute/development/structure" },
		],
	},
	{
		label: "仓库规范",
		items: [
			{ slug: "contribute/guidelines/pr" },
			{ slug: "contribute/guidelines/publishing" },
		],
	},
];

export default defineConfig({
	site: "https://amll.dev",
	integrations: [
		react(),
		starlight({
			favicon: "favicon.ico",
			title: "AppleMusic-like Lyrics",
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
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/amll-dev/applemusic-like-lyrics",
				},
			],
			plugins: [
				starlightSidebarTopics([
					{
						id: "docs",
						label: {
							"zh-CN": "使用文档",
							en: "Guides",
						},
						link: "/guides/",
						icon: "open-book",
						items: docsSidebar,
					},
					{
						id: "reference",
						label: {
							"zh-CN": "API 参考",
							en: "API Reference",
						},
						link: "/reference/",
						icon: "information",
						items: referenceSidebar,
					},
					{
						id: "contribute",
						label: {
							"zh-CN": "贡献指南",
							en: "Contributing",
						},
						link: "/contribute/",
						icon: "rocket",
						items: contributeSidebar,
					},
				]),
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
		}),
	],
});
