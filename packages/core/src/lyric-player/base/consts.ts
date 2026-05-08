type ValueOf<T extends Record<PropertyKey, unknown>> = T[keyof T];

/** 歌词中不雅用语的掩码模式 */
export const MaskObsceneWordsMode = {
	/** 禁用任何不雅用语掩码 */
	Disabled: "",
	/** 完全掩码所有不雅用语 */
	FullMask: "full-mask",
	/** 保留首尾字符，屏蔽中间字符 */
	PartialMask: "partial-mask",
} as const;

/** 歌词中不雅用语的掩码模式枚举类型，见 {@link MaskObsceneWordsMode} */
export type MaskObsceneWordsMode = ValueOf<typeof MaskObsceneWordsMode>;

/**
 * 歌词行的渲染模式
 * @internal
 */
export const LyricLineRenderMode = {
	SOLID: 0,
	GRADIENT: 1,
} as const;

/**
 * 歌词行的渲染模式枚举类型，见 {@link LyricLineRenderMode}
 * @internal
 */
export type LyricLineRenderMode = ValueOf<typeof LyricLineRenderMode>;

/** 布局对齐锚点 */
export const LayoutAlignAnchor = {
	Top: "top",
	Center: "center",
	Bottom: "bottom",
} as const;

/** 布局对齐锚点枚举类型，见 {@link LayoutAlignAnchor} */
export type LayoutAlignAnchor = ValueOf<typeof LayoutAlignAnchor>;
