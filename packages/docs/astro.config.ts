import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightSidebarTopics from "starlight-sidebar-topics";
import { generateTypedocDocs } from "./src/scripts/typedoc";

const docsSidebar = [
	{
		label: "概览",
		translations: { en: "Overview" },
		items: [
			{ slug: "guides/overview/intro" },
			{ slug: "guides/overview/quickstart" },
			{ slug: "guides/overview/eco" },
		],
	},
	{
		label: "React 绑定",
		translations: { en: "React Bindings" },
		items: [
			{ slug: "guides/react/introduction" },
			{ slug: "guides/react/quick-start" },
			{ slug: "guides/react/lyric-player" },
			{ slug: "guides/react/bg-render" },
		],
	},
	{
		label: "歌词格式",
		translations: { en: "Lyric Formats" },
		items: [
			{ slug: "guides/lyric/quickstart" },
			{ slug: "guides/lyric/formats" },
			{ slug: "guides/lyric/ttml" },
		],
	},
];

const referenceSidebar = [
	{
		label: "Core 核心",
		translations: { en: "Core" },
		collapsed: true,
		autogenerate: { directory: "reference/core", collapsed: true },
	},
	{
		label: "React 绑定",
		translations: { en: "React Bindings" },
		collapsed: true,
		autogenerate: { directory: "reference/react", collapsed: true },
	},
	{
		label: "React Full 组件库",
		translations: { en: "React Full Components" },
		collapsed: true,
		autogenerate: { directory: "reference/react-full", collapsed: true },
	},
	{
		label: "Vue 绑定",
		translations: { en: "Vue Bindings" },
		collapsed: true,
		autogenerate: { directory: "reference/vue", collapsed: true },
	},
	{
		label: "Lyric 歌词处理",
		translations: { en: "Lyric Processing" },
		collapsed: true,
		autogenerate: { directory: "reference/lyric", collapsed: true },
	},
	{
		label: "TTML 歌词处理",
		translations: { en: "TTML Processing" },
		collapsed: true,
		autogenerate: { directory: "reference/ttml", collapsed: true },
	},
];

const contributeSidebar = [
	{
		label: "开发指南",
		translations: { en: "Development" },
		items: [
			{ slug: "contribute/development/environments" },
			{ slug: "contribute/development/structure" },
		],
	},
	{
		label: "仓库规范",
		translations: { en: "Repository Guidelines" },
		items: [
			{ slug: "contribute/guidelines/pr" },
			{ slug: "contribute/guidelines/publishing" },
		],
	},
];

export default defineConfig({
	site: "https://amll.dev",
	trailingSlash: "never",
	integrations: [
		react(),
		starlight({
			favicon: "favicon.ico",
			title: "AppleMusic-like Lyrics",
			customCss: ["./src/styles/custom.css"],
			locales: {
				root: { label: "简体中文", lang: "zh-CN" },
				en: { label: "English", lang: "en" },
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
						label: { "zh-CN": "使用文档", en: "Guides" },
						link: "/guides",
						icon: "open-book",
						items: docsSidebar,
					},
					{
						id: "reference",
						label: { "zh-CN": "API 参考", en: "API Reference" },
						link: "/reference",
						icon: "information",
						items: referenceSidebar,
					},
					{
						id: "contribute",
						label: { "zh-CN": "贡献指南", en: "Contributing" },
						link: "/contribute",
						icon: "rocket",
						items: contributeSidebar,
					},
				]),
				{
					name: "typedoc",
					hooks: {
						"config:setup": async (cfg) => {
							cfg.logger.info("Generating typedoc...");
							await generateTypedocDocs(cfg.logger);
							cfg.logger.info("Finished typedoc generation");
						},
					},
				},
			],
		}),
	],
});
