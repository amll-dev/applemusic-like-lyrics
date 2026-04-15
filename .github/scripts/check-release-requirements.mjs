import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const githubToken = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const outputPath = process.env.GITHUB_OUTPUT;

if (!githubToken || !repository || !prNumber || !outputPath) {
	throw new Error("Missing required GitHub Actions environment variables.");
}

function loadIgnorePatternsForPlanCheck() {
	const nxJsonText = readFileSync(new URL("../../nx.json", import.meta.url), {
		encoding: "utf8",
	});
	const nxJson = JSON.parse(nxJsonText);
	const patterns = nxJson?.release?.versionPlans?.ignorePatternsForPlanCheck;

	if (
		!Array.isArray(patterns) ||
		patterns.some((pattern) => typeof pattern !== "string")
	) {
		throw new Error(
			"Invalid nx.json: release.versionPlans.ignorePatternsForPlanCheck must be an array of strings.",
		);
	}
	return patterns;
}

function getIgnoredFilesByGitignorePatterns(files, patterns) {
	const tempRepoDir = mkdtempSync(join(tmpdir(), "release-plan-ignore-check-"));

	try {
		const initResult = spawnSync(
			"git",
			["-C", tempRepoDir, "init", "--quiet"],
			{
				encoding: "utf8",
			},
		);
		if (initResult.status !== 0) {
			throw new Error(
				`Failed to initialize temporary git repository.\n${initResult.stderr || initResult.stdout}`,
			);
		}

		writeFileSync(join(tempRepoDir, ".gitignore"), `${patterns.join("\n")}\n`, {
			encoding: "utf8",
		});

		const stdin = `${files.map((file) => file.replaceAll("\\", "/")).join("\n")}\n`;
		const checkResult = spawnSync(
			"git",
			["-C", tempRepoDir, "check-ignore", "--no-index", "--stdin"],
			{
				encoding: "utf8",
				input: stdin,
			},
		);

		if (checkResult.status !== 0 && checkResult.status !== 1) {
			throw new Error(
				`Failed to evaluate ignore patterns with git check-ignore.\n${checkResult.stderr || checkResult.stdout}`,
			);
		}

		return new Set(
			checkResult.stdout
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean),
		);
	} finally {
		rmSync(tempRepoDir, { recursive: true, force: true });
	}
}

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
		files.push(...pageItems);
		if (pageItems.length < 100) break;
	}

	return files;
}

function isReleasePlanPath(path) {
	return (
		typeof path === "string" && /^\.nx\/version-plans\/.+\.md$/u.test(path)
	);
}

const pullRequest = await requestJson(`/pulls/${prNumber}`);
const labels = new Set((pullRequest.labels ?? []).map((label) => label.name));
const changedFileEntries = await getAllChangedFiles();
const changedFiles = changedFileEntries.map((item) => item.filename);
const ignorePatternsForPlanCheck = loadIgnorePatternsForPlanCheck();
const ignoredFiles = getIgnoredFilesByGitignorePatterns(
	changedFiles,
	ignorePatternsForPlanCheck,
);
const hasReleasePlanFileChange = changedFileEntries.some((item) => {
	if (item.status === "removed") {
		return false;
	}
	return (
		isReleasePlanPath(item.filename) ||
		isReleasePlanPath(item.previous_filename)
	);
});

if (changedFiles.length === 0) {
	throw new Error("Pull request does not contain any changed files.");
}

const nonIgnoredFiles = changedFiles.filter((file) => !ignoredFiles.has(file));
const hasNoReleaseLabel = labels.has("no-release");
const allIgnored = nonIgnoredFiles.length === 0;

if (allIgnored && !hasNoReleaseLabel) {
	throw new Error(
		"Pure documentation/CI/infra changes must include the no-release label.",
	);
}

if (!allIgnored && hasNoReleaseLabel) {
	throw new Error(
		"The no-release label is only allowed when every changed file is ignored by release plan checks.\n" +
			`Found ${nonIgnoredFiles.length} non-ignored changed file(s): (showing first 30)\n` +
			nonIgnoredFiles
				.slice(0, 30)
				.map((file) => `  - ${file}`)
				.join("\n"),
	);
}

if (!allIgnored && !hasNoReleaseLabel && !hasReleasePlanFileChange) {
	throw new Error(
		"This pull request changes release-relevant files but does not include a release plan file change in .nx/version-plans/.\n" +
			"Please add a release plan by running `nx release plan`. Learn more at https://nx.dev/docs/guides/nx-release/file-based-versioning-version-plans",
	);
}

appendFileSync(
	outputPath,
	`requires_release_plan=${allIgnored ? "false" : "true"}\n`,
);

console.log(
	JSON.stringify(
		{
			changedFiles,
			nonIgnoredFiles,
			hasNoReleaseLabel,
			hasReleasePlanFileChange,
		},
		null,
		2,
	),
);
