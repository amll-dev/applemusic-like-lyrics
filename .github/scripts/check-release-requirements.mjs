import { appendFileSync } from "node:fs";

const githubToken = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const outputPath = process.env.GITHUB_OUTPUT;

if (!githubToken || !repository || !prNumber || !outputPath) {
	throw new Error("Missing required GitHub Actions environment variables.");
}

const ignoredMatchers = [
	(file) => file.endsWith(".md"),
	(file) => file.endsWith(".mdx"),
	(file) => file.startsWith(".github/"),
	(file) => file.startsWith(".nx/version-plans/"),
	(file) => file.startsWith("packages/player"),
	(file) => file.startsWith("packages/skia-player"),
	(file) => file === ".editorconfig",
	(file) => file === ".gitignore",
	(file) => file === "biome.json",
	(file) => file === "Cargo.lock",
	(file) => file === "Cargo.toml",
	(file) => file === "lerna.json",
	(file) => file === "LICENSE",
	(file) => file === "nx.json",
	(file) => file === "package.json",
	(file) => file === "pnpm-lock.yaml",
	(file) => file === "pnpm-workspace.yaml",
	(file) => file === "tsconfig.base.json",
	(file) => file === "tsconfig.json",
	(file) => file.startsWith("packages/docs/"),
	(file) => /^packages\/[^/]+\/docs\//.test(file),
];

const isIgnoredFile = (file) =>
	ignoredMatchers.some((matcher) => matcher(file));

const apiBaseUrl = `https://api.github.com/repos/${repository}`;

async function requestJson(path) {
	const response = await fetch(`${apiBaseUrl}${path}`, {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${githubToken}`,
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	if (!response.ok) {
		throw new Error(
			`GitHub API request failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

async function getAllChangedFiles() {
	const files = [];

	for (let page = 1; ; page += 1) {
		const pageItems = await requestJson(
			`/pulls/${prNumber}/files?per_page=100&page=${page}`,
		);
		files.push(...pageItems.map((item) => item.filename));
		if (pageItems.length < 100) break;
	}

	return files;
}

const pullRequest = await requestJson(`/pulls/${prNumber}`);
const labels = new Set((pullRequest.labels ?? []).map((label) => label.name));
const changedFiles = await getAllChangedFiles();

if (changedFiles.length === 0) {
	throw new Error("Pull request does not contain any changed files.");
}

const nonIgnoredFiles = changedFiles.filter((file) => !isIgnoredFile(file));
const hasNoReleaseLabel = labels.has("no-release");
const allIgnored = nonIgnoredFiles.length === 0;

if (allIgnored && !hasNoReleaseLabel) {
	throw new Error(
		"Pure documentation/CI/infra changes must include the no-release label.",
	);
}

if (!allIgnored && hasNoReleaseLabel) {
	throw new Error(
		"The no-release label is only allowed when every changed file is ignored by release plan checks.",
	);
}

appendFileSync(
	outputPath,
	`requires_release_plan=${allIgnored ? "false" : "true"}\n`,
);

console.log(
	JSON.stringify({ changedFiles, nonIgnoredFiles, hasNoReleaseLabel }, null, 2),
);
