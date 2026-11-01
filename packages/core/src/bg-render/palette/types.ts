/**
 * @fileoverview
 * 调色板取色器的公共类型。
 *
 * 移植自 Storyteller-Studios/Impressionist（MIT）：
 * - `Impressionist/Abstractions/HSVColor.cs`
 * - `Impressionist/Abstractions/PaletteResult.cs`
 *
 * 颜色一律用 `[x, y, z]` 三元组表示。在 RGB 空间时分量范围是 [0, 255]，
 * 与 C# 原实现的 `Vector3` 约定保持一致；在 LAB 空间时则是 L/a/b 的原始取值。
 *
 * @see https://github.com/Storyteller-Studios/Impressionist/blob/master/Impressionist/Abstractions/HSVColor.cs
 * @see https://github.com/Storyteller-Studios/Impressionist/blob/master/Impressionist/Abstractions/PaletteResult.cs
 */

/** 一个颜色向量，语义随所处色彩空间而定。 */
export type ColorVec3 = [number, number, number];

/** HSV 颜色，H 取值 [0, 360)，S/V 取值 [0, 100]。 */
export interface HSVColor {
	h: number;
	s: number;
	v: number;
}

/** 直方图中的一项：一个颜色及其出现次数。 */
export interface ColorCount {
	color: ColorVec3;
	count: number;
}

/** 主题色结果。 */
export interface ThemeColorResult {
	/** RGB 空间下的主题色，分量范围 [0, 255]。 */
	color: ColorVec3;
	/** 该主题色是否偏暗（L* <= 50）。 */
	colorIsDark: boolean;
}

/** 调色板结果。 */
export interface PaletteResult {
	/** 调色板颜色，RGB 空间，分量范围 [0, 255]，长度恒等于请求的数量。 */
	palette: ColorVec3[];
	/** 该调色板整体是否偏暗。 */
	paletteIsDark: boolean;
	/** 生成调色板时顺带算出的主题色。 */
	themeColor: ThemeColorResult;
}

/**
 * 调色板的用途，决定取色时的取舍。
 *
 * - `"accent"`：Impressionist 的取向，取强调色用。只保留与主题色明暗一致的候选
 *   色，整套调色板压在明暗轴的一侧，作为强调色时才和界面拉得开对比；亮色封面还
 *   会偏好更聚拢的一支，免得强调色散得没有章法。
 * - `"dominant"`：要封面本身的主色，铺满全屏的背景用。不按明暗筛候选色（否则
 *   L* 落在 (40, 60) 的中间调会被整段丢掉，封面的标志色若在这一带就整个消失），
 *   择优时一律取更分散的一支 —— 背景要的是封面的颜色跨度，不是和界面的对比度。
 */
export type PaletteIntent = "accent" | "dominant";
