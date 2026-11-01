import {
	type BaseRenderer,
	DomLyricPlayer,
	IsolationRenderer,
	type IsolationRendererOptions,
	type LyricPlayerBase,
	MeshGradientRenderer,
	PixiRenderer,
	TitaniumRenderer,
	type TitaniumRendererOptions,
} from "@applemusic-like-lyrics/core";
import type { BackgroundRenderProps } from "@applemusic-like-lyrics/react";
import { atom, type PrimitiveAtom, type WritableAtom } from "jotai";
import { atomWithStorage, type RESET } from "jotai/utils";

//#region 类型定义
/**
 * 播放器底部控制区域的控制组件类型
 * - `Controls`: 播放控制按钮
 * - `FFT`: 音频可视化内容
 * - `None`: 不显示任何内容
 */
export enum PlayerControlsType {
	Controls = "controls",
	FFT = "fft",
	None = "none",
}

/**
 * 在隐藏歌词的情况下专辑图的布局方式：
 * - `Auto`: 根据专辑图是否为视频以使用沉浸布局
 * - `ForceNormal`: 强制使用默认的专辑图布局
 * - `ForceImmersive`: 强制使用沉浸式的专辑图布局
 */
export enum VerticalCoverLayout {
	Auto = "auto",
	ForceNormal = "force-normal",
	ForceImmersive = "force-immersive",
}

/**
 * 可用的歌词渲染器实现
 */
export enum LyricPlayerImplementation {
	Dom = "dom",
}

/**
 * 可用的预设歌词字体大小
 */
export enum LyricSizePreset {
	Tiny = "tiny",
	ExtraSmall = "extra-small",
	Small = "small",
	Medium = "medium",
	Large = "large",
	ExtraLarge = "extra-large",
	Huge = "huge",
}
//#endregion

//#region 歌词效果配置
export type LyricPlayerImplementationObject = {
	lyricPlayer?: {
		new (
			...args: ConstructorParameters<typeof LyricPlayerBase>
		): LyricPlayerBase;
	};
};

const getInitialPlayerImplementation = (): LyricPlayerImplementationObject => {
	const savedImpl = localStorage.getItem(
		"amll-react-full.lyricPlayerImplementation",
	);
	switch (savedImpl) {
		default:
			return { lyricPlayer: DomLyricPlayer };
	}
};

/**
 * 歌词播放组件的实现类型
 * @default DomLyricPlayer
 */
export const lyricPlayerImplementationAtom: PrimitiveAtom<LyricPlayerImplementationObject> =
	atom(getInitialPlayerImplementation());

/**
 * 是否启用歌词行模糊效果
 *
 * 性能影响：较高
 * @default true
 */
export const enableLyricLineBlurEffectAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.enableLyricLineBlurEffect", true);

/**
 * 是否启用歌词行缩放效果
 *
 * 性能影响：无
 * @default true
 */
export const enableLyricLineScaleEffectAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.enableLyricLineScaleEffect", true);

/**
 * 是否使用物理弹簧算法实现歌词动画效果
 *
 * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
 *
 * 如果不启用，则会回退到基于 transition 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
 *
 * 性能影响：较高
 * @default true
 */
export const enableLyricLineSpringAnimationAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.enableLyricLineSpringAnimation", true);

/**
 * 是否显示翻译歌词行
 *
 * 性能影响：无
 * @default true
 */
export const enableLyricTranslationLineAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.enableLyricTranslationLine", true);

/**
 * 是否显示音译歌词行
 *
 * 性能影响：无
 * @default true
 */
export const enableLyricRomanLineAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.enableLyricRomanLine", true);

/**
 * 是否交换音译和翻译歌词行的显示位置
 *
 * 性能影响：无
 * @default false
 */
export const enableLyricSwapTransRomanLineAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.enableLyricSwapTransRomanLine", false);

/**
 * 调节逐词歌词时单词的渐变过渡宽度，单位为一个全角字的宽度
 * - 如果要模拟 Apple Music for Android 的效果，可以设置为 1
 * - 如果要模拟 Apple Music for iPad 的效果，可以设置为 0.5
 * - 如需关闭逐词歌词时单词的渐变过渡效果，可以设置为 0
 * @default 0.5
 */
export const lyricWordFadeWidthAtom: WritableAtom<
	number,
	[number | ((prev: number) => number) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.lyricWordFadeWidth", 0.5);

/**
 * 设置歌词组件的字体家族
 *
 * 以逗号分隔的字体名称组合，等同于 CSS 的 font-family 属性
 * @default ""
 */
export const lyricFontFamilyAtom: WritableAtom<
	string,
	[string | ((prev: string) => string) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.lyricFontFamily", "");

/**
 * 设置歌词组件的字体字重
 *
 * 等同于 CSS 的 font-weight 属性
 * @default 600
 */
export const lyricFontWeightAtom: WritableAtom<
	number | string,
	[
		| number
		| string
		| ((prev: number | string) => number | string)
		| typeof RESET,
	],
	void
> = atomWithStorage<number | string>("amll-react-full.lyricFontWeight", 600);

/**
 * 设置歌词组件的字符间距
 *
 * 等同于 CSS 的 letter-spacing 属性
 * @default "normal"
 */
export const lyricLetterSpacingAtom: WritableAtom<
	string,
	[string | ((prev: string) => string) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.lyricLetterSpacing", "normal");

/**
 * 设置歌词的字体大小
 * @default LyricSizePreset.Medium
 */
export const lyricSizePresetAtom: WritableAtom<
	LyricSizePreset,
	[
		| LyricSizePreset
		| ((prev: LyricSizePreset) => LyricSizePreset)
		| typeof RESET,
	],
	void
> = atomWithStorage<LyricSizePreset>(
	"amll-react-full.lyricSizePreset",
	LyricSizePreset.Medium,
);
//#endregion

//#region 歌曲信息展示配置
/**
 * 播放控制组件的显示类型，即歌曲信息下方的组件
 */
export const playerControlsTypeAtom: WritableAtom<
	PlayerControlsType,
	[
		| PlayerControlsType
		| ((prev: PlayerControlsType) => PlayerControlsType)
		| typeof RESET,
	],
	void
> = atomWithStorage<PlayerControlsType>(
	"amll-react-full.playerControlsType",
	PlayerControlsType.Controls,
);

/**
 * 是否显示歌曲名称
 * @default true
 */
export const showMusicNameAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.showMusicName", true);

/**
 * 在隐藏歌词的情况下专辑图的布局方式
 * @default VerticalCoverLayout.Auto
 */
export const verticalCoverLayoutAtom: WritableAtom<
	VerticalCoverLayout,
	[
		| VerticalCoverLayout
		| ((prev: VerticalCoverLayout) => VerticalCoverLayout)
		| typeof RESET,
	],
	void
> = atomWithStorage<VerticalCoverLayout>(
	"amll-react-full.verticalCoverLayout",
	VerticalCoverLayout.Auto,
);

/**
 * 是否显示歌曲作者
 * @default true
 */
export const showMusicArtistsAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.showMusicArtists", true);

/**
 * 是否显示歌曲专辑名称
 *
 * 如果同时启用三个，布局上可能不太好看，请酌情调节
 * @default false
 */
export const showMusicAlbumAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.showMusicAlbum", false);

/**
 * 是否显示音量控制条
 * @default true
 */
export const showVolumeControlAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.showVolumeControl", true);

/**
 * 是否显示底部控制按钮组
 *
 * 在横向布局里是右下角的几个按钮，在竖向布局里是播放按钮下方的几个按钮
 * @default true
 */
export const showBottomControlAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.showBottomControl", true);
//#endregion

//#region 歌词背景配置
export type LyricBackgroundRenderer = {
	renderer?: BackgroundRenderProps["renderer"] | string;
};

/** 一个可选背景渲染器的注册项。 */
export interface BackgroundRendererEntry {
	/** 渲染器类。 */
	readonly renderer: {
		new (canvas: HTMLCanvasElement): BaseRenderer;
	};
	/**
	 * 当前环境是否支持，不支持时会按 {@link resolveBackgroundRenderer} 的顺序回落
	 */
	readonly isSupported: () => boolean;
}

export const CSS_BACKGROUND_RENDERER_ID = "css-bg";
export const DEFAULT_BACKGROUND_RENDERER_ID = "mesh";

/**
 * 所有可选的背景渲染器。
 *
 * `"css-bg"` 不在表内，因为它不是渲染器，而是固定的纯色 CSS 背景
 */
export const BACKGROUND_RENDERERS: Readonly<
	Record<string, BackgroundRendererEntry>
> = {
	mesh: {
		renderer: MeshGradientRenderer,
		isSupported: () => MeshGradientRenderer.isSupported(),
	},
	pixi: {
		renderer: PixiRenderer,
		isSupported: () => PixiRenderer.isSupported(),
	},
	isolation: {
		renderer: IsolationRenderer,
		isSupported: () => IsolationRenderer.isSupported(),
	},
	titanium: {
		renderer: TitaniumRenderer,
		isSupported: () => TitaniumRenderer.isSupported(),
	},
};

/** 背景渲染器配置在 localStorage 中的键名。 */
export const LYRIC_BACKGROUND_RENDERER_STORAGE_KEY =
	"amll-react-full.lyricBackgroundRenderer";

/**
 * {@link resolveBackgroundRenderer} 的结果：可以直接使用的渲染器类，或
 * {@link CSS_BACKGROUND_RENDERER_ID} 表示不需要加载背景渲染器
 */
export type ResolvedBackgroundRenderer =
	| BackgroundRendererEntry["renderer"]
	| typeof CSS_BACKGROUND_RENDERER_ID;

/**
 * 把字符串标识解析成渲染器
 *
 * 如果传入的渲染器标识在当前环境不支持，则会依次回退到 Mesh 渲染器和 CSS 背景
 */
export const resolveBackgroundRenderer = (
	id: string,
): ResolvedBackgroundRenderer => {
	if (id === CSS_BACKGROUND_RENDERER_ID) return CSS_BACKGROUND_RENDERER_ID;
	const entry = BACKGROUND_RENDERERS[id];
	if (entry?.isSupported()) return entry.renderer;
	const fallback = BACKGROUND_RENDERERS[DEFAULT_BACKGROUND_RENDERER_ID];
	if (fallback?.isSupported()) return fallback.renderer;
	return CSS_BACKGROUND_RENDERER_ID;
};

const getInitialBackgroundRenderer = (): LyricBackgroundRenderer => ({
	renderer: resolveBackgroundRenderer(
		localStorage.getItem(LYRIC_BACKGROUND_RENDERER_STORAGE_KEY) ??
			DEFAULT_BACKGROUND_RENDERER_ID,
	),
});

/**
 * 配置所使用的歌词背景渲染器
 */
export const lyricBackgroundRendererAtom: PrimitiveAtom<LyricBackgroundRenderer> =
	atom<LyricBackgroundRenderer>(getInitialBackgroundRenderer());

/**
 * Isolation 背景渲染器的专属选项
 *
 * 仅在背景渲染器为 Isolation 时生效
 */
export const isolationRendererOptionsAtom: WritableAtom<
	IsolationRendererOptions,
	[
		| IsolationRendererOptions
		| ((prev: IsolationRendererOptions) => IsolationRendererOptions)
		| typeof RESET,
	],
	void
> = atomWithStorage<IsolationRendererOptions>(
	"amll-react-full.isolationRendererOptions",
	{ ...IsolationRenderer.defaultOptions },
);

/**
 * Titanium 背景渲染器的专属选项
 *
 * 仅在背景渲染器为 Titanium 时生效
 */
export const titaniumRendererOptionsAtom: WritableAtom<
	TitaniumRendererOptions,
	[
		| TitaniumRendererOptions
		| ((prev: TitaniumRendererOptions) => TitaniumRendererOptions)
		| typeof RESET,
	],
	void
> = atomWithStorage<TitaniumRendererOptions>(
	"amll-react-full.titaniumRendererOptions",
	{ ...TitaniumRenderer.defaultOptions },
);

/**
 * 当背景渲染器设置为纯色或CSS背景时，使用此值
 * @default "#111111"
 */
export const cssBackgroundPropertyAtom: WritableAtom<
	string,
	[string | ((prev: string) => string) | typeof RESET],
	void
> = atomWithStorage("amll-player.cssBackgroundProperty", "#111111");

/**
 * 调节背景的最大渲染帧率，较低的值可以提升性能
 *
 * 性能影响：高
 * @default 60
 */
export const lyricBackgroundFPSAtom: WritableAtom<
	number,
	[number | ((prev: number) => number) | typeof RESET],
	void
> = atomWithStorage<number>("amll-react-full.lyricBackgroundFPS", 60);

/**
 * 调节背景的渲染倍率，较低的值可以提升性能
 *
 * 性能影响：高
 * @default 1
 */
export const lyricBackgroundRenderScaleAtom: WritableAtom<
	number,
	[number | ((prev: number) => number) | typeof RESET],
	void
> = atomWithStorage<number>("amll-react-full.lyricBackgroundRenderScale", 1);

/**
 * 是否启用背景静态模式
 *
 * 让背景会在除了切换歌曲变换封面的情况下保持静止，如果遇到了性能问题，可以考虑开启此项
 *
 * 注意：启用此项会导致背景跳动效果失效
 * @default false
 */
export const lyricBackgroundStaticModeAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage<boolean>(
	"amll-react-full.lyricBackgroundStaticMode",
	false,
);
//#endregion

//#region UI 交互状态
/**
 * 控制歌词播放页面是否可见
 */
export const isLyricPageOpenedAtom: PrimitiveAtom<boolean> = atom(false);

/**
 * 是否隐藏歌词视图（即使有歌词数据）
 * @default false
 */
export const hideLyricViewAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.hideLyricView", false);

/**
 * 是否在进度条上显示剩余时间而非当前时间
 * @default true
 */
export const showRemainingTimeAtom: WritableAtom<
	boolean,
	[boolean | ((prev: boolean) => boolean) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.showRemainingTime", true);

/**
 * 音频可视化频域范围
 *
 * 单位为赫兹（hz），此项会影响音频可视化和背景跳动效果的展示效果
 * @default [80, 2000]
 */
export const fftDataRangeAtom: WritableAtom<
	[number, number],
	[
		| [number, number]
		| ((prev: [number, number]) => [number, number])
		| typeof RESET,
	],
	void
> = atomWithStorage("amll-react-full.fftDataRange", [80, 2000] as [
	number,
	number,
]);
//#endregion
