import fs from "node:fs";

fs.rmSync("dist/playground", { recursive: true, force: true });
fs.cpSync("../playground/core/dist", "dist/playground", { recursive: true });
console.log("Playground copied to dist/playground");
