/**
 * @fileoverview
 * 渲染器的运行环境能力探测。
 *
 * 渲染器的构造函数在拿不到所需上下文时会直接抛错，而 `BackgroundRender.new()`
 * 只是 `new` 一下，没有回落余地。所以选择渲染器的一方（设置界面、从
 * localStorage 恢复配置的地方）应当先问一句支不支持。
 */

let webgl1Support: boolean | undefined;
let webgl2Support: boolean | undefined;
let highpFragmentSupport: boolean | undefined;

/**
 * 借一个 1x1 的临时上下文跑一次 `probe`，用完立刻释放。不传 `probe` 就只测能不
 * 能拿到上下文。
 *
 * 拿不到上下文或者探测过程中抛错都算作不支持。
 */
function withProbeContext(
	contextId: "webgl" | "webgl2",
	probe: (gl: WebGLRenderingContext | WebGL2RenderingContext) => boolean = () =>
		true,
): boolean {
	try {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const gl = canvas.getContext(contextId) as
			| WebGLRenderingContext
			| WebGL2RenderingContext
			| null;
		if (!gl) return false;
		try {
			return probe(gl);
		} finally {
			// 探测用的上下文用完立刻释放，免得白占一个 WebGL 上下文名额
			gl.getExtension("WEBGL_lose_context")?.loseContext();
		}
	} catch {
		return false;
	}
}

/** 当前环境是否支持 WebGL1，结果只探测一次。 */
export function isWebGL1Supported(): boolean {
	if (webgl1Support === undefined) webgl1Support = withProbeContext("webgl");
	return webgl1Support;
}

/** 当前环境是否支持 WebGL2，结果只探测一次。 */
export function isWebGL2Supported(): boolean {
	if (webgl2Support === undefined) webgl2Support = withProbeContext("webgl2");
	return webgl2Support;
}

/**
 * WebGL1 的片元着色器是否支持 highp 浮点，结果只探测一次。
 *
 * 程序化渲染器的着色器里时间项会一直单调累加，噪声哈希又多是
 * `sin(...) * 43758.5453` 这种把误差放大四万倍的写法。mediump 只有 10 位有效
 * 数，播放几分钟后时间项就会量化到肉眼可见的台阶，哈希本身也会退化成条带 ——
 * 与其默默给出破图，不如直接判定为不支持。
 */
export function isHighpFragmentSupported(): boolean {
	if (highpFragmentSupport === undefined) {
		highpFragmentSupport = withProbeContext("webgl", (gl) => {
			const format = gl.getShaderPrecisionFormat(
				gl.FRAGMENT_SHADER,
				gl.HIGH_FLOAT,
			);
			return (format?.precision ?? 0) > 0;
		});
	}
	return highpFragmentSupport;
}
