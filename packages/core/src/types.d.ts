/** biome-ignore-all lint/correctness/noUnusedVariables: used */
declare module "*.glsl" {
	const content: string;
	export default content;
}

declare module "*.glsl?raw" {
	const content: string;
	export default content;
}

declare module "*.module.css" {
	const classes: Record<string, string>;
	export default classes;
}

declare module "*.css" {
	const css: string;
	export default css;
}

interface ImportMetaEnv {
	readonly DEV: boolean;
	readonly PROD: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
