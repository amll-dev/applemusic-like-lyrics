#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const nxJsonPath = path.resolve(process.cwd(), "nx.json");

const nxJson = JSON.parse(fs.readFileSync(nxJsonPath, "utf8"));
nxJson.cli = { ...(nxJson.cli || {}), packageManager: "npm" };
fs.writeFileSync(nxJsonPath, `${JSON.stringify(nxJson, null, 2)}\n`);

const { detectPackageManager } = require("nx/src/utils/package-manager");
console.log(`Nx detected package manager: ${detectPackageManager()}`);
