import { atom, map } from "nanostores";
import type { ApiEndpointDef } from "./configs";

/**
 * API 测试面板的开闭状态
 */
export const isDrawerOpen = atom<boolean>(false);

/**
 * 当前是否处于深色模式
 */
export const isDarkTheme = atom<boolean>(true);

if (typeof window !== "undefined") {
	const updateTheme = () => {
		const theme = document.documentElement.dataset.theme;
		if (theme) {
			isDarkTheme.set(theme === "dark");
		} else {
			const isDark =
				!document.documentElement.classList.contains("theme-light") &&
				(document.documentElement.classList.contains("theme-dark") ||
					window.matchMedia("(prefers-color-scheme: dark)").matches);
			isDarkTheme.set(isDark);
		}
	};

	updateTheme();

	const observer = new MutationObserver(() => {
		updateTheme();
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme", "class"],
	});
}

/**
 * 当前正在测试的 API 配置
 */
export const currentEndpoint = atom<ApiEndpointDef | null>(null);

/**
 * 用户在输入框中填写的参数类型
 */
export interface DynamicParam {
	/**
	 * 用于列表渲染的 ID
	 */
	id: string;
	/**
	 * 参数名
	 */
	key: string;
	/**
	 * 参数值
	 */
	value: string;
	/**
	 * 是否勾选
	 */
	enabled: boolean;
}

/**
 * 用户在输入框中填写的参数
 */
export const requestParams = atom<DynamicParam[]>([]);

/**
 * 用户在输入框中填写的 Path 路径参数
 */
export const requestPathParams = atom<Record<string, string>>({});

/**
 * HTTP 请求的响应状态
 */
export interface ResponseState {
	loading: boolean;
	/**
	 * 格式化后的 JSON 字符串
	 */
	data: string | null;
	/**
	 * 格式化后的响应头字符串
	 */
	headers: string | null;
	status: number | null;
	/**
	 * 请求耗时 (毫秒 ms)
	 */
	time: number | null;
	/**
	 * 响应大小 (字节 bytes)
	 */
	size: number | null;
	error: string | null;
}

export const responseState = map<ResponseState>({
	loading: false,
	data: null,
	headers: null,
	status: null,
	time: null,
	size: null,
	error: null,
});

/**
 * 持久化存储 Sync 接口用的鉴权 Token
 * @returns 鉴权用的 Token
 */
function getInitialToken() {
	if (typeof window !== "undefined") {
		return localStorage.getItem("amll_sync_secret") || "";
	}
	return "";
}

export const bearerToken = atom<string>(getInitialToken());

if (typeof window !== "undefined") {
	bearerToken.listen((value) => {
		localStorage.setItem("amll_sync_secret", value);
	});
}

/**
 * 创建一个默认的空参数行
 * @returns DynamicParam
 */
export function createEmptyParam(): DynamicParam {
	return {
		id: crypto.randomUUID(),
		key: "",
		value: "",
		enabled: false,
	};
}

/**
 * 一个方便的 action，用于从 MDX 唤起抽屉并初始化
 * @param _endpointId 端点 ID
 * @param def 要测试的 API 端点配置
 */
export function openTesterWith(_endpointId: string, def: ApiEndpointDef) {
	currentEndpoint.set(def);

	const initialPathParams: Record<string, string> = {};
	if (def.pathParams) {
		for (const p of def.pathParams) {
			initialPathParams[p.name] = p.placeholder
				? p.placeholder.replace("例如: ", "")
				: "";
		}
	}
	requestPathParams.set(initialPathParams);

	const initialParams: DynamicParam[] = def.params.map((p) => ({
		id: crypto.randomUUID(),
		key: p.name,
		value: "",
		enabled: true,
	}));

	initialParams.push(createEmptyParam());

	requestParams.set(initialParams);
	responseState.set({
		loading: false,
		data: null,
		headers: null,
		status: null,
		time: null,
		size: null,
		error: null,
	});
	isDrawerOpen.set(true);
}

/**
 * 用户是否正在拖拽侧边栏
 */
export const isDrawerDragging = atom<boolean>(false);

function getInitialWidth() {
	if (typeof window !== "undefined") {
		const w = localStorage.getItem("amll_api_drawer_width");
		return w ? parseInt(w, 10) : 400; // 默认宽度 400px
	}
	return 400;
}

/**
 * 侧边栏的宽度
 */
export const drawerWidth = atom<number>(getInitialWidth());

if (typeof window !== "undefined") {
	document.documentElement.style.setProperty(
		"--api-drawer-width",
		`${getInitialWidth()}px`,
	);

	drawerWidth.listen((val) => {
		localStorage.setItem("amll_api_drawer_width", val.toString());
		document.documentElement.style.setProperty(
			"--api-drawer-width",
			`${val}px`,
		);
	});
}
