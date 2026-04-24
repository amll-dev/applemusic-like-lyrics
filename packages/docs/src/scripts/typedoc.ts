import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Application, PageEvent, type TypeDocOptions } from "typedoc";
import type {
	PluginOptions as TypeDocPluginOptions,
	MarkdownApplication,
} from "typedoc-plugin-markdown";

type TypeDocBaseOptions = TypeDocOptions & TypeDocPluginOptions;

type TypeDocDocTarget = TypeDocBaseOptions & {
	name: string;
	packageRoot: string;
	routeBase: string;
	out: string;
	tsconfig: string;
};

type TypeDocCache = {
	version: number;
	targetFingerprints: Record<string, string>;
};

type LoggerLike = {
	info: (message: string) => void;
};

const TYPE_DOC_CONFIG_BASE_OPTIONS: TypeDocBaseOptions = {
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

const DOCS_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
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

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function collectFingerprintFiles(root: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string): Promise<void> {
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

async function calculateFilesFingerprint(files: string[]): Promise<string> {
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

async function runWithConcurrency<T>(
	limit: number,
	items: T[],
	worker: (item: T) => Promise<void>,
): Promise<void> {
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

function convertTypeDocHrefToRoute(href: string, routeBase: string): string {
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

async function generateOneDoc(cfg: TypeDocDocTarget): Promise<void> {
	const {
		routeBase,
		name: _name,
		packageRoot: _packageRoot,
		...typedocConfig
	} = cfg;

	const config: TypeDocBaseOptions = {
		...TYPE_DOC_CONFIG_BASE_OPTIONS,
		...typedocConfig,
	};

	const app = (await Application.bootstrapWithPlugins(
		config,
	)) as unknown as MarkdownApplication;

	function generateFrontmatter(evt: PageEvent): void {
		const content: string[] = ["---"];
		if (evt.model.name.startsWith("@applemusic-like-lyrics/")) {
			content.push('title: "索引"');
		} else {
			content.push(`title: "${evt.model.name}"`);
		}
		content.push(`pageKind: ${evt.pageKind}`);
		content.push("editUrl: false");
		content.push("---");
		content.push("<!-- This file is generated, do not edit directly! -->");

		let docContent = evt.contents ?? "";
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

function getDocTargets(): TypeDocDocTarget[] {
	return [
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
}

async function readTypeDocCache(): Promise<TypeDocCache> {
	if (await pathExists(TYPEDOC_CACHE_PATH)) {
		try {
			const raw = await readFile(TYPEDOC_CACHE_PATH, "utf8");
			const parsed = JSON.parse(raw) as TypeDocCache;
			if (
				parsed &&
				parsed.version === TYPEDOC_CACHE_VERSION &&
				typeof parsed.targetFingerprints === "object"
			) {
				return parsed;
			}
		} catch {
			// ignore cache parse errors
		}
	}
	return { version: TYPEDOC_CACHE_VERSION, targetFingerprints: {} };
}

async function writeTypeDocCache(cache: TypeDocCache): Promise<void> {
	await mkdir(dirname(TYPEDOC_CACHE_PATH), { recursive: true });
	await writeFile(TYPEDOC_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

export async function generateTypedocDocs(logger?: LoggerLike): Promise<void> {
	const docTargets = getDocTargets();
	const typedocCache = await readTypeDocCache();

	const optionsFingerprint = createHash("sha1")
		.update(JSON.stringify(TYPE_DOC_CONFIG_BASE_OPTIONS))
		.update("\n")
		.update(TYPEDOC_CONFIG_SEED)
		.digest("hex");

	const dirtyTargets: TypeDocDocTarget[] = [];
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
		process.env.TYPEDOC_CONCURRENCY ?? "2",
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

	await writeTypeDocCache(typedocCache);
}
