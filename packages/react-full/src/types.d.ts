declare module "*.svg" {
	import type { FC, SVGProps } from "react";
	const ReactComponent: FC<SVGProps<SVGSVGElement> & { title?: string }>;
	export default ReactComponent;
}

declare module "*.module.css" {
	const classes: Record<string, string>;
	export default classes;
}

declare module "*.css" {
	const css: string;
	export default css;
}
