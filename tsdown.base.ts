import type { UserConfig } from "tsdown";

export const baseConfig: UserConfig = {
	format: ["esm", "cjs"],
	dts: true,
	sourcemap: true,
};
