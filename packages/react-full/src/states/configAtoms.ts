import {
	CanvasLyricPlayer,
	DomLyricPlayer,
	DomSlimLyricPlayer,
	type LyricPlayerBase,
	MeshGradientRenderer,
	PixiRenderer,
} from "@applemusic-like-lyrics/core";
import type { BackgroundRenderProps } from "@applemusic-like-lyrics/react";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ==================================================================
//                            类型定义
// ==================================================================

/**
 * 定义了播放器底部控制区域的显示模式。
 * - `Controls`: 显示播放控制按钮。
 * - `FFT`: 显示音频频谱图。
 * - `None`: 不显示任何内容。
 */
export enum PlayerControlsType {
	Controls = "controls",
	FFT = "fft",
	None = "none",
}

/**
 * 定义了垂直布局下，隐藏歌词时专辑封面的布局模式。
 * - `Auto`: 根据封面是否为视频自动切换为沉浸式布局。
 * - `ForceNormal`: 强制使用标准布局。
 * - `ForceImmersive`: 强制使用沉浸式布局。
 */
export enum VerticalCoverLayout {
	Auto = "auto",
	ForceNormal = "force-normal",
	ForceImmersive = "force-immersive",
}

/**
 * 定义了可用的歌词渲染器实现枚举。
 */
export enum LyricPlayerImplementation {
	Dom = "dom",
	DomSlim = "dom-slim",
	Canvas = "canvas",
}

/**
 * 定义了歌词大小的预设值常量。
 */
export const LyricSizePreset = {
	Tiny: "tiny",
	ExtraSmall: "extra-small",
	Small: "small",
	Medium: "medium",
	Large: "large",
	ExtraLarge: "extra-large",
	Huge: "huge",
} as const;

/**
 * 从预设值常量生成具体的类型。
 */
export type LyricSizePresetValue =
	(typeof LyricSizePreset)[keyof typeof LyricSizePreset];

// ==================================================================
//                        歌词效果配置
// ==================================================================

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
		case LyricPlayerImplementation.DomSlim:
			return { lyricPlayer: DomSlimLyricPlayer };
		case LyricPlayerImplementation.Canvas:
			return { lyricPlayer: CanvasLyricPlayer };
		default:
			return { lyricPlayer: DomLyricPlayer };
	}
};

/**
 * 歌词播放组件的实现类型
 */
export const lyricPlayerImplementationAtom = atom(
	getInitialPlayerImplementation(),
);

/**
 * 是否启用歌词行模糊效果。性能影响：高。
 */
export const enableLyricLineBlurEffectAtom = atomWithStorage(
	"amll-react-full.enableLyricLineBlurEffect",
	true,
);

/**
 * 是否启用歌词行缩放效果。性能影响：无。
 */
export const enableLyricLineScaleEffectAtom = atomWithStorage(
	"amll-react-full.enableLyricLineScaleEffect",
	true,
);

/**
 * 是否启用歌词行弹簧动画效果。如果禁用，则回退到基础的 CSS 动画。性能影响：中。
 */
export const enableLyricLineSpringAnimationAtom = atomWithStorage(
	"amll-react-full.enableLyricLineSpringAnimation",
	true,
);

/**
 * 是否显示翻译歌词行。性能影响：低。
 */
export const enableLyricTranslationLineAtom = atomWithStorage(
	"amll-react-full.enableLyricTranslationLine",
	true,
);

/**
 * 是否显示音译歌词行。性能影响：低。
 */
export const enableLyricRomanLineAtom = atomWithStorage(
	"amll-react-full.enableLyricRomanLine",
	true,
);

/**
 * 是否交换音译和翻译歌词行的显示位置。性能影响：无。
 */
export const enableLyricSwapTransRomanLineAtom = atomWithStorage(
	"amll-react-full.enableLyricSwapTransRomanLine",
	false,
);

/**
 * 调节逐词歌词的渐变过渡宽度（单位为一个全角字宽）。
 * 0.5 模拟 Apple Music for iPad；1 模拟 Android；0 则关闭效果。
 */
export const lyricWordFadeWidthAtom = atomWithStorage(
	"amll-react-full.lyricWordFadeWidth",
	0.5,
);

/**
 * 设置歌词组件的字体家族（CSS Font Family）。
 */
export const lyricFontFamilyAtom = atomWithStorage(
	"amll-react-full.lyricFontFamily",
	"",
);

/**
 * 设置歌词组件的字体字重（CSS Font Weight）。
 */
export const lyricFontWeightAtom = atomWithStorage<number | string>(
	"amll-react-full.lyricFontWeight",
	0,
);

/**
 * 设置歌词组件的字符间距（CSS Letter Spacing）。
 */
export const lyricLetterSpacingAtom = atomWithStorage(
	"amll-react-full.lyricLetterSpacing",
	"normal",
);

/**
 * 调节全局歌词时间戳位移，单位毫秒。正值为提前，负值为推迟。
 */
export const globalLyricTimelineOffsetAtom = atomWithStorage(
	"amll-react-full.globalLyricTimelineOffset",
	0,
);

/**
 * 歌词字体大小的预设选项。
 */
export const lyricSizePresetAtom = atomWithStorage<LyricSizePresetValue>(
	"amll-react-full.lyricSizePreset",
	LyricSizePreset.Medium,
);

// ==================================================================
//                        歌曲信息展示配置
// ==================================================================

/**
 * 播放器底部控制区域的显示模式。
 */
export const playerControlsTypeAtom = atomWithStorage(
	"amll-react-full.playerControlsType",
	PlayerControlsType.Controls,
);

/**
 * 是否显示歌曲名称。
 */
export const showMusicNameAtom = atomWithStorage(
	"amll-react-full.showMusicName",
	true,
);

/**
 * 垂直布局下隐藏歌词时的专辑图布局模式。
 */
export const verticalCoverLayoutAtom = atomWithStorage(
	"amll-react-full.verticalCoverLayout",
	VerticalCoverLayout.Auto,
);

/**
 * 是否显示歌曲创作者。
 */
export const showMusicArtistsAtom = atomWithStorage(
	"amll-react-full.showMusicArtists",
	true,
);

/**
 * 是否显示歌曲专辑名称。
 */
export const showMusicAlbumAtom = atomWithStorage(
	"amll-react-full.showMusicAlbum",
	false,
);

/**
 * 是否显示音量控制滑块。
 */
export const showVolumeControlAtom = atomWithStorage(
	"amll-react-full.showVolumeControl",
	true,
);

/**
 * 是否显示底部控制按钮组。
 */
export const showBottomControlAtom = atomWithStorage(
	"amll-react-full.showBottomControl",
	true,
);

// ==================================================================
//                        歌词背景配置
// ==================================================================

export type LyricBackgroundRenderer = {
	renderer?: BackgroundRenderProps["renderer"] | string;
};

const getInitialBackgroundRenderer = (): LyricBackgroundRenderer => {
	const savedRenderer = localStorage.getItem(
		"amll-react-full.lyricBackgroundRenderer",
	);
	switch (savedRenderer) {
		case "pixi":
			return { renderer: PixiRenderer };
		case "css-bg":
			return { renderer: "css-bg" };
		default:
			return { renderer: MeshGradientRenderer };
	}
};

/**
 * 配置所使用的歌词背景渲染器。
 */
export const lyricBackgroundRendererAtom = atom<LyricBackgroundRenderer>(
	getInitialBackgroundRenderer(),
);

/**
 * 当背景渲染器设置为纯色或CSS背景时，使用此值。
 */
export const cssBackgroundPropertyAtom = atomWithStorage(
	"amll-player.cssBackgroundProperty",
	"#111111",
);

/**
 * 调节背景的最大渲染帧率。性能影响：高。
 */
export const lyricBackgroundFPSAtom = atomWithStorage<number>(
	"amll-react-full.lyricBackgroundFPS",
	60,
);

/**
 * 调节背景的渲染倍率。较低的值可以提升性能。性能影响：高。
 */
export const lyricBackgroundRenderScaleAtom = atomWithStorage<number>(
	"amll-react-full.lyricBackgroundRenderScale",
	1,
);

/**
 * 是否启用背景静态模式。启用后，背景只在必要时重绘，以优化性能。性能影响：中。
 */
export const lyricBackgroundStaticModeAtom = atomWithStorage<boolean>(
	"amll-react-full.lyricBackgroundStaticMode",
	false,
);

// ==================================================================
//                        UI 交互状态
// ==================================================================

/**
 * 控制歌词播放页面是否可见。
 * 推荐在页面被隐藏时设置为 false，以暂停动画和渲染，优化性能。
 */
export const isLyricPageOpenedAtom = atom(false);

/**
 * 是否强制隐藏歌词视图（即使有歌词数据）。
 */
export const hideLyricViewAtom = atomWithStorage(
	"amll-react-full.hideLyricView",
	false,
);

/**
 * 是否在进度条上显示剩余时间而非当前时间。
 */
export const showRemainingTimeAtom = atomWithStorage(
	"amll-react-full.showRemainingTime",
	true,
);

/**
 * 用于音频可视化频谱图的数据采样频率范围。
 */
export const fftDataRangeAtom = atomWithStorage(
	"amll-react-full.fftDataRange",
	[80, 2000] as [number, number],
);
