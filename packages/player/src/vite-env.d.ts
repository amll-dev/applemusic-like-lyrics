/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite-plugin-i18next-loader/vite" />

declare module "md5" {
	export default function md5(input: string): string;
}

declare module "virtual:git-metadata-plugin" {
	export const commit: string;
	export const branch: string;
}

declare module "virtual:i18next-loader" {
	const translation: typeof import("../locales/zh-CN/translation.json");
	const resources: {
		"af-ZA": { translation: typeof translation };
		"ar-SA": { translation: typeof translation };
		"ca-ES": { translation: typeof translation };
		"cs-CZ": { translation: typeof translation };
		"da-DK": { translation: typeof translation };
		"de-DE": { translation: typeof translation };
		"el-GR": { translation: typeof translation };
		"en-US": { translation: typeof translation };
		"es-ES": { translation: typeof translation };
		"fi-FI": { translation: typeof translation };
		"fr-FR": { translation: typeof translation };
		"he-IL": { translation: typeof translation };
		"hu-HU": { translation: typeof translation };
		"it-IT": { translation: typeof translation };
		"ja-JP": { translation: typeof translation };
		"ko-KR": { translation: typeof translation };
		"nl-NL": { translation: typeof translation };
		"no-NO": { translation: typeof translation };
		"pl-PL": { translation: typeof translation };
		"pt-BR": { translation: typeof translation };
		"pt-PT": { translation: typeof translation };
		"ro-RO": { translation: typeof translation };
		"ru-RU": { translation: typeof translation };
		"sr-SP": { translation: typeof translation };
		"sv-SE": { translation: typeof translation };
		"tr-TR": { translation: typeof translation };
		"uk-UA": { translation: typeof translation };
		"vi-VN": { translation: typeof translation };
		"zh-CN": { translation: typeof translation };
		"zh-HK": { translation: typeof translation };
		"zh-TW": { translation: typeof translation };
	};
	export default resources;
}

declare enum SystemTitlebarAppearance {
	Windows = "windows",
	MacOS = "macos",
	Hidden = "hidden",
}

declare function setSystemTitlebarAppearance(
	appearance: SystemTitlebarAppearance,
): void;
declare enum SystemTitlebarResizeAppearance {
	Restore = "restore",
	Maximize = "maximize",
}
declare function setSystemTitlebarResizeAppearance(
	appearance: SystemTitlebarResizeAppearance,
): void;
declare function setSystemTitlebarFullscreen(enable: boolean): void;
declare function setSystemTitlebarImmersiveMode(enable: boolean): void;
declare function addEventListener(
	type: "on-system-titlebar-click-close",
	listener: (evt: Event) => void,
): void;
declare function addEventListener(
	type: "on-system-titlebar-click-resize",
	listener: (evt: Event) => void,
): void;
declare function addEventListener(
	type: "on-system-titlebar-click-minimize",
	listener: (evt: Event) => void,
): void;
