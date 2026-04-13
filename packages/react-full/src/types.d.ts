declare module "*.svg?react" {
	import type { FC, SVGProps } from "react";
	const ReactComponent: FC<SVGProps<SVGSVGElement> & { title?: string }>;
	export default ReactComponent;
}

declare module "*.svg" {
	const src: string;
	export default src;
}

declare module "*.module.css" {
	const classes: Record<string, string>;
	export default classes;
}

declare module "*.css" {
	const css: string;
	export default css;
}
