import i18n from "i18next";
import { useEffect, useState } from "react";
import { initReactI18next, useTranslation } from "react-i18next";

export const resources = {
	"zh-CN": {
		translation: {
			apiTester: {
				debug: "调 试",
				onlineTest: "在线测试",
				close: "关闭",
				send: "发 送",
				cancel: "取 消",
				authParams: "鉴权参数",
				pathParams: "路径参数",
				queryParams: "请求参数",
				bearerToken: "Bearer Token",
				bearerTokenDesc: "鉴权用的 Bearer Token",
				customParam: "自定义参数",
				addParam: "添加参数",
				disableParam: "禁用此参数",
				enableParam: "启用此参数",
				delete: "删除",
				fillPathParams: "请先填写路径参数 {{params}}",
				invalidUrl: "无效的 URL 格式",
				waitingResponse: "正在等待响应",
				sendToDebug: "发送请求以进行调试",
				noHeaders: "暂无响应头信息",
				value: "Value",
				key: "Key",
			},
			apiParams: {
				getLyric: {
					id: "歌词 ID",
					filename: "歌词文件名",
					ncmMusicId: "网易云音乐歌曲 ID",
					qqMusicId: "QQ 音乐歌曲 ID",
					appleMusicId: "Apple Music 歌曲 ID",
					spotifyId: "Spotify 歌曲 ID",
					isrc: "国际标准音像制品编码",
					format: "歌词格式",
				},
				searchLyrics: {
					q: "全局模糊搜索关键词",
					musicName: "歌曲名",
					artistName: "歌手名",
					albumName: "专辑名",
					lyricText: "歌词正文",
					authorId: "歌词贡献者 GitHub ID",
					authorUsername: "歌词贡献者 GitHub 用户名",
				},
				lrclibSearch: {
					q: "全局模糊搜索关键词",
					track_name: "歌曲名",
					artist_name: "歌手名",
					album_name: "专辑名",
				},
				lrclibGet: {
					track_name: "歌曲名",
					artist_name: "歌手名",
					album_name: "专辑名",
					duration: "歌曲时长",
				},
				lrclibGetById: {
					id: "歌词 ID",
				},
			},
			tooltip: {
				required: "必填",
				optional: "可选",
			},
		},
	},
	en: {
		translation: {
			apiTester: {
				debug: "Try it out",
				onlineTest: "API Tester",
				close: "Close",
				send: "Send",
				cancel: "Cancel",
				authParams: "Authorization",
				pathParams: "Path Parameters",
				queryParams: "Query Parameters",
				bearerToken: "Bearer Token",
				bearerTokenDesc: "Bearer Token for authentication",
				customParam: "Custom parameter",
				addParam: "Add parameter",
				disableParam: "Disable parameter",
				enableParam: "Enable parameter",
				delete: "Delete",
				fillPathParams: "Please fill in path parameters {{params}}",
				invalidUrl: "Invalid URL format",
				waitingResponse: "Waiting for response...",
				sendToDebug: "Send request to test",
				noHeaders: "No response headers",
				value: "Value",
				key: "Key",
			},
			apiParams: {
				getLyric: {
					id: "Lyric ID",
					filename: "Lyric filename",
					ncmMusicId: "Netease Cloud Music song ID",
					qqMusicId: "QQ Music song ID",
					appleMusicId: "Apple Music song ID",
					spotifyId: "Spotify song ID",
					isrc: "International Standard Recording Code (ISRC)",
					format: "Lyric format",
				},
				searchLyrics: {
					q: "Global fuzzy search keyword",
					musicName: "Song title",
					artistName: "Artist name",
					albumName: "Album title",
					lyricText: "Lyric text",
					authorId: "Lyric contributor GitHub ID",
					authorUsername: "Lyric contributor GitHub username",
				},
				lrclibSearch: {
					q: "Global fuzzy search keyword",
					track_name: "Track name",
					artist_name: "Artist name",
					album_name: "Album title",
				},
				lrclibGet: {
					track_name: "Track name",
					artist_name: "Artist name",
					album_name: "Album title",
					duration: "Track duration",
				},
				lrclibGetById: {
					id: "Lyric ID",
				},
			},
			tooltip: {
				required: "Required",
				optional: "Optional",
			},
		},
	},
} as const;

export function detectLanguage(): "zh-CN" | "en" {
	if (typeof window !== "undefined") {
		const htmlLang = document.documentElement.lang;
		if (htmlLang?.startsWith("en")) return "en";
		if (
			window.location.pathname.startsWith("/en/") ||
			window.location.pathname === "/en"
		) {
			return "en";
		}
	}
	return "zh-CN";
}

if (!i18n.isInitialized) {
	i18n.use(initReactI18next).init({
		resources,
		lng: "zh-CN",
		fallbackLng: "zh-CN",
		interpolation: {
			escapeValue: false,
		},
	});
}

if (typeof window !== "undefined") {
	const syncLanguage = () => {
		const lang = detectLanguage();
		if (i18n.language !== lang) {
			i18n.changeLanguage(lang);
		}
	};

	const observer = new MutationObserver(() => {
		syncLanguage();
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["lang"],
	});
}

/**
 * 水合安全的 i18n 钩子
 *
 * 在组件首次 SSR 及 Hydration Pass 中维持与服务端相同的默认文本，水合完成后自动切换为客户端识别的目标语言
 */
export function useHydratedTranslation() {
	const { t, i18n } = useTranslation();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const lang = detectLanguage();
		if (i18n.language !== lang) {
			i18n.changeLanguage(lang);
		}
	}, []);

	const hydratedT = (key: string, options?: Record<string, unknown>) => {
		if (!mounted) {
			return i18n.t(key, { ...options, lng: "zh-CN" });
		}
		return t(key, options);
	};

	return { t: hydratedT, i18n, mounted };
}

export default i18n;
