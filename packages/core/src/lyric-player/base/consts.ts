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

/**
 * 触发排版布局更新的原因场景
 */
export const LayoutReason = {
	/** 正常播放时间推进 */
	PlaybackTick: "playback-tick",
	/** 容器或窗口尺寸调整 */
	Resize: "resize",
	/** 用户交互挂起开始（触摸/滚轮触发） */
	InteractionStart: "interaction-start",
	/** 连续高频滚动（手指触摸滑动或松手后的 RAF 惯性滑动） */
	ContinuousScroll: "continuous-scroll",
	/** 离散单步滚动（鼠标滚轮单次滚动） */
	DiscreteScroll: "discrete-scroll",
	/** 用户交互结束并恢复自动对齐 */
	InteractionEnd: "interaction-end",
	/** 跳转播放进度 */
	Seek: "seek",
	/** 重新构建歌词视图 */
	RebuildView: "rebuild-view",
	/** 视图结构或样式配置改变 */
	ConfigChange: "config-change",
} as const;

/** 触发排版布局更新的原因场景枚举类型，见 {@link LayoutReason} */
export type LayoutReason = ValueOf<typeof LayoutReason>;

/**
 * 对应各个 LayoutReason 的排版执行策略定义
 */
export interface LayoutStrategy {
	/** 是否禁用阶梯交错动画 */
	disableStagger: boolean;
	/** 是否重置间奏圆点动画 */
	resetInterlude: boolean;
	/**
	 * 是否瞬移 Y 轴位置而不经过弹簧动画
	 *
	 * 一般用于触摸拖动中，避免弹簧动画导致拖动不跟手
	 */
	snapPosY: boolean;
}

/**
 * 排版原因到排版执行策略的映射字典
 */
export const LayoutReasonStrategyMap: Record<LayoutReason, LayoutStrategy> = {
	[LayoutReason.PlaybackTick]: {
		disableStagger: false,
		resetInterlude: false,
		snapPosY: false,
	},
	[LayoutReason.InteractionEnd]: {
		disableStagger: false,
		resetInterlude: false,
		snapPosY: false,
	},
	[LayoutReason.ContinuousScroll]: {
		disableStagger: true,
		resetInterlude: true,
		snapPosY: true,
	},
	[LayoutReason.DiscreteScroll]: {
		disableStagger: true,
		resetInterlude: true,
		snapPosY: false,
	},
	[LayoutReason.InteractionStart]: {
		disableStagger: true,
		resetInterlude: true,
		snapPosY: false,
	},
	[LayoutReason.Seek]: {
		disableStagger: true,
		resetInterlude: true,
		snapPosY: false,
	},
	// RebuildView 时也不应该瞬移 Y 轴，因为载入歌词时有一个歌词行从底部远处飞入的动画，需要弹簧来动画
	[LayoutReason.RebuildView]: {
		disableStagger: true,
		resetInterlude: true,
		snapPosY: false,
	},
	[LayoutReason.Resize]: {
		disableStagger: true,
		resetInterlude: false,
		snapPosY: false,
	},
	[LayoutReason.ConfigChange]: {
		disableStagger: true,
		resetInterlude: false,
		snapPosY: false,
	},
};
