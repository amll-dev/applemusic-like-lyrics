// @ts-check

import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const DOCS_CONFIG_PATH = fileURLToPath(import.meta.url);
const DOCS_ROOT = dirname(DOCS_CONFIG_PATH);
const TYPEDOC_CACHE_PATH = resolve(
	DOCS_ROOT,
	"node_modules/.cache/typedoc-generation-cache.json",
);
const TYPEDOC_CACHE_VERSION = 1;
const TYPEDOC_CONFIG_SEED = "typedoc-config-v1";
const TYPEDOC_FINGERPRINT_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".mts",
	".cts",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".vue",
	".json",
]);

/**
 * @param {string} path
 */
async function pathExists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function collectFingerprintFiles(root) {
	/** @type {string[]} */
	const files = [];

	/**
	 * @param {string} dir
	 */
	async function walk(dir) {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === "node_modules" || entry.name === "dist") continue;
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}
			if (!entry.isFile()) continue;
			if (TYPEDOC_FINGERPRINT_EXTENSIONS.has(extname(entry.name))) {
				files.push(fullPath);
			}
		}
	}

	if (existsSync(root)) {
		await walk(root);
	}

	return files.sort();
}

/**
 * @param {string[]} files
 */
async function calculateFilesFingerprint(files) {
	const hash = createHash("sha1");
	for (const filePath of files) {
		const fileStat = await stat(filePath);
		const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();
		hash.update(normalizedPath);
		hash.update(":");
		hash.update(String(fileStat.size));
		hash.update(":");
		hash.update(String(fileStat.mtimeMs));
		hash.update("\n");
	}
	return hash.digest("hex");
}

/**
 * @param {number} limit
 * @param {T[]} items
 * @param {(item: T) => Promise<void>} worker
 * @template T
 */
async function runWithConcurrency(limit, items, worker) {
	if (items.length === 0) return;
	const workers = Array.from(
		{ length: Math.max(1, Math.min(limit, items.length)) },
		async () => {
			while (items.length > 0) {
				const next = items.shift();
				if (!next) return;
				await worker(next);
			}
		},
	);
	await Promise.all(workers);
}

async function generateDoc(logger) {
	/**
	 * Convert a TypeDoc markdown file link (e.g. Interface.Foo.md#bar)
	 * to the Starlight route (e.g. /reference/core/interfacefoo#bar).
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
			return hashPart ? `${normalizedBase}#${hashPart}` : normalizedBase;
		}

		const slug = stem.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
		const route = `${normalizedBase}/${slug}`;
		return hashPart ? `${route}#${hashPart}` : route;
	}

	/**
	 * @param {import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions & { routeBase?: string; name: string; packageRoot: string }} cfg
	 */
	async function generateOneDoc(cfg) {
		const { routeBase = "", name: _name, packageRoot: _packageRoot, ...typedocConfig } = cfg;

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

	/** @type {Array<import('typedoc').TypeDocOptions & import('typedoc-plugin-markdown').PluginOptions & { routeBase: string; name: string; packageRoot: string; out: string; tsconfig: string }>} */
	const docTargets = [
		{
			name: "core",
			packageRoot: "../core",
			entryPoints: ["../core/src/index.ts"],
			tsconfig: "../core/tsconfig.json",
			out: "./src/content/docs/reference/core",
			routeBase: "/reference/core",
		},
		{
			name: "react",
			packageRoot: "../react",
			entryPoints: ["../react/src/index.ts"],
			tsconfig: "../react/tsconfig.json",
			out: "./src/content/docs/reference/react",
			routeBase: "/reference/react",
		},
		{
			name: "vue",
			packageRoot: "../vue",
			entryPoints: ["../vue/src/index.ts"],
			tsconfig: "../vue/tsconfig.json",
			out: "./src/content/docs/reference/vue",
			routeBase: "/reference/vue",
		},
		{
			name: "react-full",
			packageRoot: "../react-full",
			entryPoints: ["../react-full/src/index.ts"],
			tsconfig: "../react-full/tsconfig.json",
			out: "./src/content/docs/reference/react-full",
			routeBase: "/reference/react-full",
		},
		{
			name: "lyric",
			packageRoot: "../lyric",
			entryPoints: ["../lyric/src/index.ts"],
			tsconfig: "../lyric/tsconfig.json",
			skipErrorChecking: true,
			out: "./src/content/docs/reference/lyric",
			routeBase: "/reference/lyric",
		},
		{
			name: "ttml",
			packageRoot: "../ttml",
			entryPoints: ["../ttml/src/index.ts"],
			tsconfig: "../ttml/tsconfig.json",
			skipErrorChecking: true,
			out: "./src/content/docs/reference/ttml",
			routeBase: "/reference/ttml",
		},
	];

	/** @type {{ version: number; targetFingerprints: Record<string, string> }} */
	let typedocCache = { version: TYPEDOC_CACHE_VERSION, targetFingerprints: {} };
	if (await pathExists(TYPEDOC_CACHE_PATH)) {
		try {
			const raw = await readFile(TYPEDOC_CACHE_PATH, "utf8");
			const parsed = JSON.parse(raw);
			if (
				parsed &&
				parsed.version === TYPEDOC_CACHE_VERSION &&
				typeof parsed.targetFingerprints === "object"
			) {
				typedocCache = parsed;
			}
		} catch {
			typedocCache = { version: TYPEDOC_CACHE_VERSION, targetFingerprints: {} };
		}
	}

	const optionsFingerprint = createHash("sha1")
		.update(JSON.stringify(typeDocConfigBaseOptions))
		.update("\n")
		.update(TYPEDOC_CONFIG_SEED)
		.digest("hex");

	/** @type {typeof docTargets} */
	const dirtyTargets = [];
	for (const target of docTargets) {
		const packageRootAbs = resolve(DOCS_ROOT, target.packageRoot);
		const srcFiles = await collectFingerprintFiles(join(packageRootAbs, "src"));
		const tsconfigAbs = resolve(DOCS_ROOT, target.tsconfig);
		const inputFiles = [...srcFiles, tsconfigAbs];
		const sourceFingerprint = await calculateFilesFingerprint(inputFiles);
		const targetFingerprint = createHash("sha1")
			.update(optionsFingerprint)
			.update("\n")
			.update(sourceFingerprint)
			.digest("hex");
		const previousFingerprint = typedocCache.targetFingerprints[target.name];
		const outIndex = resolve(DOCS_ROOT, target.out, "index.md");
		const hasOutput = await pathExists(outIndex);

		if (hasOutput && previousFingerprint === targetFingerprint) {
			logger?.info(`Skipping typedoc (${target.name}): cache hit`);
			continue;
		}

		typedocCache.targetFingerprints[target.name] = targetFingerprint;
		dirtyTargets.push(target);
	}

	const concurrencyRaw = Number.parseInt(
		process.env.TYPEDOC_CONCURRENCY || "2",
		10,
	);
	const concurrency = Number.isFinite(concurrencyRaw)
		? Math.max(1, concurrencyRaw)
		: 2;

	await runWithConcurrency(concurrency, dirtyTargets, async (target) => {
		logger?.info(`Generating typedoc (${target.name})...`);
		await generateOneDoc(target);
		logger?.info(`Finished typedoc (${target.name})`);
	});

	await mkdir(dirname(TYPEDOC_CACHE_PATH), { recursive: true });
	await writeFile(
		TYPEDOC_CACHE_PATH,
		JSON.stringify(typedocCache, null, 2),
		"utf8",
	);
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
	{
		label: "歌词格式",
		items: [
			{ slug: "guides/lyric/overview" },
			{ slug: "guides/lyric/formats" },
			{ slug: "guides/lyric/ttml" },
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
	trailingSlash: "never",
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
						link: "/guides",
						icon: "open-book",
						items: docsSidebar,
					},
					{
						id: "reference",
						label: {
							"zh-CN": "API 参考",
							en: "API Reference",
						},
						link: "/reference",
						icon: "information",
						items: referenceSidebar,
					},
					{
						id: "contribute",
						label: {
							"zh-CN": "贡献指南",
							en: "Contributing",
						},
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
							await generateDoc(cfg.logger);
							cfg.logger.info("Finished typedoc generation");
						},
					},
				},
			],
		}),
	],
});
