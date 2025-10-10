import resources from "virtual:i18next-loader";
import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";

type ResourcesType = typeof resources;

declare module "i18next" {
	// Extend CustomTypeOptions
	interface CustomTypeOptions {
		defaultNS: "translation";
		resources: ResourcesType["zh-CN"];
	}
}

i18n
	.use(initReactI18next) // passes i18n down to react-i18next
	.use(ICU)
	.init({
		resources,
		debug: import.meta.env.DEV,
		fallbackLng: "zh-CN",
		defaultNS: "translation",
		interpolation: {
			escapeValue: false, // react already safes from xss
		},
	});

export default i18n;
