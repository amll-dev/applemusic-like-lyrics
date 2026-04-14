import { execSync } from "node:child_process";

console.log(process.version);
console.log(execSync("npm --version", { encoding: "utf8" }).trim());

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 14)) {
	throw new Error("Node.js 22.14.0+ is required for trusted publishing.");
}

const [npmMajor, npmMinor, npmPatch] = execSync("npm --version", {
	encoding: "utf8",
})
	.trim()
	.split(".")
	.map(Number);

const npmOk =
	npmMajor > 11 ||
	(npmMajor === 11 && npmMinor > 5) ||
	(npmMajor === 11 && npmMinor === 5 && npmPatch >= 1);

if (!npmOk) {
	throw new Error("npm 11.5.1+ is required for trusted publishing.");
}
