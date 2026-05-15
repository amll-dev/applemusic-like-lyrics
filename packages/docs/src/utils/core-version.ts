import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const corePackageJsonPath = [
	resolve(process.cwd(), "../core/package.json"),
	resolve(process.cwd(), "packages/core/package.json"),
].find((path) => existsSync(path));

if (!corePackageJsonPath) {
	throw new Error("Unable to locate packages/core/package.json.");
}

const corePackageJson = JSON.parse(
	readFileSync(corePackageJsonPath, "utf-8"),
) as {
	version?: unknown;
};

if (typeof corePackageJson.version !== "string" || !corePackageJson.version) {
	throw new Error(
		`Expected ${corePackageJsonPath} to define a package version.`,
	);
}

export const amllCoreVersion = corePackageJson.version;
export const amllCoreVersionLabel = `AMLL Core v${amllCoreVersion}`;
