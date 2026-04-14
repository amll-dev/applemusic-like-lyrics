#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const rootPackageJsonPath = path.join(rootDir, "package.json");
const packagesDir = path.join(rootDir, "packages");

const dependencyFields = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
];

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
	fs.writeFileSync(filePath, `${JSON.stringify(data, null, "\t")}\n`);
}

function listPackageJsonFiles() {
	if (!fs.existsSync(packagesDir)) return [];
	const entries = fs
		.readdirSync(packagesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(packagesDir, entry.name, "package.json"))
		.filter((filePath) => fs.existsSync(filePath));
	return entries;
}

function resolveWorkspaceVersion(depName, rawSpec, localVersions) {
	const localVersion = localVersions.get(depName);
	const body = rawSpec.slice("workspace:".length);
	if (!localVersion) {
		return body;
	}
	if (body === "^") return `^${localVersion}`;
	if (body === "~") return `~${localVersion}`;
	if (body === "*" || body === "") return localVersion;
	return body;
}

function resolveCatalogVersion(depName, rawSpec, catalog) {
	if (!rawSpec.startsWith("catalog:")) {
		return rawSpec;
	}
	const catalogKey =
		rawSpec === "catalog:" ? depName : rawSpec.slice("catalog:".length);
	const resolved = catalog[catalogKey];
	return resolved ?? null;
}

const rootPackageJson = readJson(rootPackageJsonPath);
const catalog = rootPackageJson.catalog || {};
const packageJsonFiles = listPackageJsonFiles();

const localVersions = new Map();
for (const filePath of packageJsonFiles) {
	const json = readJson(filePath);
	if (typeof json.name === "string" && typeof json.version === "string") {
		localVersions.set(json.name, json.version);
	}
}

const unresolvedCatalogRefs = [];

for (const filePath of packageJsonFiles) {
	const json = readJson(filePath);
	delete json.nx

	for (const field of dependencyFields) {
		const deps = json[field];
		if (!deps || typeof deps !== "object") continue;

		for (const [depName, rawSpec] of Object.entries(deps)) {
			if (typeof rawSpec !== "string") continue;

			let nextSpec = rawSpec;

			if (rawSpec.startsWith("workspace:")) {
				nextSpec = resolveWorkspaceVersion(depName, rawSpec, localVersions);
			} else if (rawSpec.startsWith("catalog:")) {
				const resolved = resolveCatalogVersion(depName, rawSpec, catalog);
				if (resolved == null) {
					unresolvedCatalogRefs.push(
						`${path.relative(rootDir, filePath)} -> ${field}.${depName}=${rawSpec}`,
					);
					continue;
				}
				nextSpec = resolved;
			}

			if (nextSpec !== rawSpec) {
				deps[depName] = nextSpec;
			}
		}
	}

	writeJson(filePath, json);
	console.log(`Prepared npm manifest: ${path.relative(rootDir, filePath)}`);
}

if (unresolvedCatalogRefs.length > 0) {
	console.error("Failed to resolve catalog references for npm publish:");
	for (const ref of unresolvedCatalogRefs) {
		console.error(`- ${ref}`);
	}
	process.exit(1);
}
