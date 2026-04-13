import { DomLyricPlayer } from "./dom/index.ts";

export { LyricPlayerBase } from "./base.ts";
export * from "./dom/index.ts";
export * from "./dom-slim/index.ts";

/**
 * 歌词中不雅用语的掩码模式
 */
enum MaskObsceneWordsMode {
	/** 禁用任何不雅用语掩码 */
	Disabled = "",
	/** 完全掩码所有不雅用语 */
	FullMask = "full-mask",
	/** 保留首尾字符，屏蔽中间字符 */
	PartialMask = "partial-mask",
}

/**
 * 歌词行的渲染模式
 * @internal
 */
enum LyricLineRenderMode {
	SOLID = 0,
	GRADIENT = 1,
}

export {
	/**
	 * 默认导出的歌词播放组件
	 */
	DomLyricPlayer as LyricPlayer,
	LyricLineRenderMode,
	MaskObsceneWordsMode,
};
