/**
 * @fileoverview
 * Titanium 流沙背景渲染器。
 *
 * 用封面主题色与解析高度场模拟金属沙面，沙粒由格子哈希程序化生成，
 * 每帧只有一次全屏绘制、零次纹理采样。
 */

import { clamp01 } from "#utils/clamp.ts";
import {
	loadResourceFromElement,
	loadResourceFromUrl,
} from "../../utils/resource.ts";
import { BaseRenderer } from "../base.ts";
import { GLProgram } from "../gl-program.ts";
import {
	type ColorVec3,
	createPaletteFromImage,
	type PaletteAlgorithm,
	srgbToOkLab,
} from "../palette/index.ts";
import { isHighpFragmentSupported, isWebGL1Supported } from "../support.ts";
import titaniumFragShader from "./titanium.frag.glsl?raw";
import titaniumVertShader from "./titanium.vert.glsl?raw";

/** Titanium 渲染器的可调选项。 */
export interface TitaniumRendererOptions {
	/** 细颗粒（粉末质感）强度，取值范围 [0, 1]，默认 0.7。 */
	grain: number;
	/** 金属闪粉强度，取值范围 [0, 1]，默认 0.75。 */
	sparkle: number;
	/** 金属高光强度，取值范围 [0, 1]，默认 0.5。 */
	sheen: number;
	/** 金属化程度，向画面亮度去饱和，取值范围 [0, 1]，默认 0.35。 */
	metalness: number;
	/**
	 * 换封面时锋线迁移的时长（毫秒），默认 2000。
	 * 设为 0 表示直接跳到新姿态。
	 */
	crestShiftMs: number;
	/** 是否启用抖动，默认 `true`。 */
	dithering: boolean;
	/** 取色算法，默认 `"auto"`。 */
	paletteAlgorithm: PaletteAlgorithm;
}

/** 渐变用到的颜色数量。 */
const COLOR_COUNT = 4;
/** 换封面时调色板过渡的时长，单位毫秒。 */
const PALETTE_TRANSITION_MS = 1400;
/** 加载封面失败时的重试次数。 */
const ALBUM_RETRY_TIMES = 5;
const TAU = Math.PI * 2;
/** 颜色与光照完成一轮循环所需的流动时间（秒）。 */
const COLOR_CYCLE_SECONDS = 8.0;
/** 粒子沿锋线切线走完一轮所需的流动时间（秒）。 */
const FLOW_CYCLE_SECONDS = 4.0;
/** 粒子每轮沿切线前进的距离，单位是屏幕 UV。 */
const FLOW_LENGTH = 0.04;
/** 默认帧率。 */
const DEFAULT_MAX_FPS = 30;
/** 锋线换位过渡的默认时长（毫秒）。 */
const DEFAULT_CREST_SHIFT_MS = 2000;
/** 锋线纵向偏移的随机范围。 */
const CREST_SHIFT_Y = 0.12;
/** 低频最强时粒子流速额外增加的比例（0.35 即最多快 35%）。 */
const LOW_FREQ_FLOW_GAIN = 0.35;

/** 还没拿到封面时的中性深色配色，分量取值 [0, 1] 的 sRGB。 */
const DEFAULT_COLORS: ColorVec3[] = [
	[0.13, 0.13, 0.15],
	[0.1, 0.1, 0.12],
	[0.17, 0.17, 0.19],
	[0.11, 0.11, 0.13],
];

/** {@link DEFAULT_COLORS} 的 OkLab 形式，四个颜色首尾相接。 */
const DEFAULT_OKLAB_COLORS = new Float32Array(
	DEFAULT_COLORS.flatMap(srgbToOkLab),
);

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

export class TitaniumRenderer extends BaseRenderer {
	/** 默认选项，同时可作为配置界面的初始值。 */
	static readonly defaultOptions: Readonly<TitaniumRendererOptions> = {
		grain: 0.7,
		sparkle: 0.75,
		sheen: 0.5,
		metalness: 0.35,
		dithering: true,
		paletteAlgorithm: "auto",
		crestShiftMs: DEFAULT_CREST_SHIFT_MS,
	};

	/** 当前环境是否支持该渲染器。 */
	static isSupported(): boolean {
		return isWebGL1Supported() && isHighpFragmentSupported();
	}

	private gl: WebGLRenderingContext;
	private program!: GLProgram;
	private quadBuffer!: WebGLBuffer;
	private contextLost = false;
	private _disposed = false;

	private options: TitaniumRendererOptions = {
		...TitaniumRenderer.defaultOptions,
	};

	/** 有歌词时背景收敛到的程度。 */
	private lyricScrim = 0;
	private lyricScrimTarget = 0;

	/** 目标低频强度（0–1），由 `setLowFreqVolume` 写入。 */
	private volume = 0;
	/** 平滑后的低频强度，实际用于着色器与流速。 */
	private smoothedVolume = 0;

	private tickHandle = 0;
	private lastTickTime = 0;
	private lastFrameTime = 0;
	private frameTime = 0;
	/**
	 * 粒子流的独立时间轴。
	 *
	 * 不复用 `frameTime`：那个还驱动颜色呼吸，且流速变化不应改变颜色节奏。
	 */
	private flowTime = 0;
	private maxFPS = DEFAULT_MAX_FPS;
	private paused = false;
	private staticMode = false;

	private targetWidth = 0;
	private targetHeight = 0;
	private currentWidth = 0;
	private currentHeight = 0;

	private albumRequestId = 0;
	private albumSource?: HTMLImageElement | HTMLVideoElement;

	/** 调色板过渡已过的毫秒数，与渲染时钟共用时间。 */
	private paletteTransitionElapsed = PALETTE_TRANSITION_MS;
	private readonly fromColors = new Float32Array(DEFAULT_OKLAB_COLORS);
	private readonly toColors = new Float32Array(DEFAULT_OKLAB_COLORS);
	private readonly colorBuffer = new Float32Array(DEFAULT_OKLAB_COLORS);
	private readonly nextColors = new Float32Array(COLOR_COUNT * 3);
	/** 每个实例固定的随机偏移。 */
	private readonly seed = new Float32Array(3);
	/**
	 * 锋线姿态：xy 为两个谐波的相位偏移，z 为纵向偏移。
	 * 与 `seed` 分开，换封面时只挪锋线。
	 */
	private readonly crestMotion = new Float32Array(3);
	private readonly crestFrom = new Float32Array(3);
	private readonly crestTo = new Float32Array(3);
	/** 锋线换位已经过的毫秒数。 */
	private crestShiftElapsed = 0;
	private readonly grainOffset = new Float32Array(2);
	private readonly paletteOrder = new Uint8Array(COLOR_COUNT);

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);
		const gl = canvas.getContext("webgl", {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			powerPreference: "low-power",
		});
		if (!gl) {
			this.disconnectResizeObserver();
			throw new Error("WebGL not supported");
		}
		this.gl = gl;
		try {
			this.rollRandomParameters();
			this.initializeGLResources();
		} catch (error) {
			this.program?.dispose();
			gl.getExtension("WEBGL_lose_context")?.loseContext();
			this.disconnectResizeObserver();
			throw error;
		}
		canvas.addEventListener("webglcontextlost", this.onContextLost);
		canvas.addEventListener("webglcontextrestored", this.onContextRestored);
		this.requestTick();
	}

	private initializeGLResources(): void {
		const gl = this.gl;
		this.program = new GLProgram(
			gl,
			titaniumVertShader,
			titaniumFragShader,
			"titanium",
		);
		const buffer = gl.createBuffer();
		if (!buffer) throw new Error("Failed to create quad buffer");
		this.quadBuffer = buffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const position = this.program.attrs.a_pos;
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	}

	private readonly onContextLost = (event: Event): void => {
		event.preventDefault();
		this.contextLost = true;
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
	};

	private readonly onContextRestored = (): void => {
		if (this._disposed) return;
		try {
			this.initializeGLResources();
		} catch (error) {
			this.program?.dispose();
			console.error("Failed to restore WebGL resources", error);
			return;
		}
		this.contextLost = false;
		this.currentWidth = 0;
		this.currentHeight = 0;
		this.resetFrameClock();
		this.requestTick();
	};

	/** 掷一次随机偏移：锋线相位与颗粒纹理位置。整个实例内保持不变。 */
	private rollRandomParameters(): void {
		for (let i = 0; i < this.seed.length; i++) {
			this.seed[i] = Math.random() * TAU;
		}
		this.grainOffset[0] = Math.random();
		this.grainOffset[1] = Math.random();
		this.rollPaletteOrder();
	}

	/** 重排主题色落到四个角上的顺序，每个封面换一次。 */
	private rollPaletteOrder(): void {
		for (let i = 0; i < this.paletteOrder.length; i++) {
			this.paletteOrder[i] = i;
		}
		for (let i = this.paletteOrder.length - 1; i > 0; i--) {
			const swapIndex = Math.floor(Math.random() * (i + 1));
			[this.paletteOrder[i], this.paletteOrder[swapIndex]] = [
				this.paletteOrder[swapIndex],
				this.paletteOrder[i],
			];
		}
	}

	/** 换封面时掷一个新的锋线姿态，并平滑过渡过去。 */
	private rollCrestTarget(): void {
		// 从当前帧的实际姿态接着插值，连续换封面不会回跳
		this.updateCrestMotion();
		this.crestFrom.set(this.crestMotion);

		for (let i = 0; i < 2; i++) {
			const sweep = (0.25 + Math.random() * 0.6) * TAU;
			this.crestTo[i] =
				this.crestMotion[i] + (Math.random() < 0.5 ? -sweep : sweep);
		}
		this.crestTo[2] = (Math.random() - 0.5) * 2 * CREST_SHIFT_Y;
		this.crestShiftElapsed = 0;
	}

	/** 按经过时间把锋线姿态插值到目标。 */
	private updateCrestMotion(): void {
		const duration = Math.max(0, this.options.crestShiftMs);
		if (duration <= 0 || this.crestShiftElapsed >= duration) {
			this.crestMotion.set(this.crestTo);
			// 相位折回一圈内，避免长期累加后精度下降
			for (let i = 0; i < 2; i++) {
				this.crestMotion[i] = ((this.crestMotion[i] % TAU) + TAU) % TAU;
			}
			this.crestTo.set(this.crestMotion);
			return;
		}

		const t = this.crestShiftElapsed / duration;
		const eased = t * t * t * (t * (t * 6 - 15) + 10);
		for (let i = 0; i < this.crestMotion.length; i++) {
			this.crestMotion[i] = lerp(this.crestFrom[i], this.crestTo[i], eased);
		}
	}

	/** 更新渲染器选项。 */
	setOptions(patch: Partial<TitaniumRendererOptions>): void {
		// 逐字段取值，避免 `undefined` 把已有配置抹掉
		const previous = this.options;
		const next: TitaniumRendererOptions = {
			grain: clamp01(patch.grain ?? previous.grain),
			sparkle: clamp01(patch.sparkle ?? previous.sparkle),
			sheen: clamp01(patch.sheen ?? previous.sheen),
			metalness: clamp01(patch.metalness ?? previous.metalness),
			dithering: patch.dithering ?? previous.dithering,
			paletteAlgorithm: patch.paletteAlgorithm ?? previous.paletteAlgorithm,
			crestShiftMs: Math.max(0, patch.crestShiftMs ?? previous.crestShiftMs),
		};
		const algorithmChanged =
			next.paletteAlgorithm !== previous.paletteAlgorithm;
		this.options = next;
		if (algorithmChanged && this.albumSource) {
			this.updatePaletteFromSource(this.albumSource, true);
		}
		this.requestTick();
	}

	private updatePaletteFromSource(
		source: HTMLImageElement | HTMLVideoElement,
		immediate = false,
	): void {
		this.rollPaletteOrder();
		let palette: [number, number, number][];
		try {
			palette = createPaletteFromImage(source, COLOR_COUNT, {
				algorithm: this.options.paletteAlgorithm,
				// 背景要的是封面本身的颜色跨度，不是和界面的对比度
				intent: "dominant",
			}).palette;
		} catch (error) {
			// 跨域封面会让 getImageData 抛安全错误，此时保持现有配色
			console.warn("Failed to extract palette from album", error);
			return;
		}
		for (let i = 0; i < COLOR_COUNT; i++) {
			const [red, green, blue] = palette[this.paletteOrder[i]];
			this.nextColors.set(
				srgbToOkLab([red / 255, green / 255, blue / 255]),
				i * 3,
			);
		}
		this.transitionToColors(this.nextColors, immediate);
		this.requestTick();
	}

	private transitionToColors(next: Float32Array, immediate: boolean): void {
		if (immediate) {
			this.fromColors.set(next);
		} else {
			// 从当前这一帧的实际颜色接着往下过渡，免得连续换封面时颜色回跳
			this.updateColorBuffer();
			this.fromColors.set(this.colorBuffer);
		}
		this.toColors.set(next);
		this.paletteTransitionElapsed = immediate ? PALETTE_TRANSITION_MS : 0;
	}

	/** 按当前过渡进度就地更新颜色，不产生任何中间数组。 */
	private updateColorBuffer(): void {
		if (this.paletteTransitionElapsed >= PALETTE_TRANSITION_MS) {
			this.colorBuffer.set(this.toColors);
			return;
		}
		const progress = this.paletteTransitionElapsed / PALETTE_TRANSITION_MS;
		// 余弦缓动：首尾都很软，中段也不会显得急
		const eased = 0.5 - 0.5 * Math.cos(Math.PI * progress);
		for (let i = 0; i < this.colorBuffer.length; i++) {
			this.colorBuffer[i] = lerp(this.fromColors[i], this.toColors[i], eased);
		}
	}

	private checkIfResize(): void {
		if (
			this.targetWidth === this.currentWidth &&
			this.targetHeight === this.currentHeight
		) {
			return;
		}
		super.onResize(this.targetWidth, this.targetHeight);
		this.currentWidth = this.targetWidth;
		this.currentHeight = this.targetHeight;
		this.gl.viewport(0, 0, this.targetWidth, this.targetHeight);
	}

	private onRedraw(frameTime: number, frameDelta: number): boolean {
		this.checkIfResize();
		// 歌词出现/消失时背景在约三分之一秒内缓缓收放
		const scrimStep = Math.min(1, frameDelta / 350);
		this.lyricScrim += (this.lyricScrimTarget - this.lyricScrim) * scrimStep;
		if (this.currentWidth <= 0 || this.currentHeight <= 0) return false;

		if (this.paletteTransitionElapsed < PALETTE_TRANSITION_MS) {
			this.paletteTransitionElapsed += frameDelta;
		}
		this.updateColorBuffer();

		if (this.crestShiftElapsed < this.options.crestShiftMs) {
			this.crestShiftElapsed += frameDelta;
		}
		this.updateCrestMotion();

		const gl = this.gl;
		const program = this.program;
		program.use();
		program.setUniform2f("u_resolution", this.currentWidth, this.currentHeight);
		program.setUniform1f("u_aspect", this.currentWidth / this.currentHeight);
		program.setUniform1f(
			"u_colorTime",
			(frameTime / 1000 / COLOR_CYCLE_SECONDS) % 1,
		);
		// 垂直流向的偏移由着色器对哈希周期取模，可以一直朝一个方向滑。
		program.setUniform1f("u_flowTime", this.flowTime / 1000);
		program.setUniform1f("u_flowSpeed", FLOW_LENGTH / FLOW_CYCLE_SECONDS);
		program.setUniform3fv("u_colors[0]", this.colorBuffer);
		program.setUniform3fv("u_seed", this.seed);
		program.setUniform3fv("u_crestMotion", this.crestMotion);
		program.setUniform2f(
			"u_grainOffset",
			this.grainOffset[0],
			this.grainOffset[1],
		);
		program.setUniform4f(
			"u_metal",
			this.options.grain,
			this.options.sparkle,
			this.options.sheen,
			this.options.metalness,
		);
		program.setUniform1f("u_lyricScrim", this.lyricScrim);
		program.setUniform1f("u_lowFreq", this.smoothedVolume);
		program.setUniform1i("u_enableDithering", this.options.dithering ? 1 : 0);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// 调色板过渡、锋线迁移与歌词收敛都跑完之后，才允许静态模式停下来
		return (
			this.paletteTransitionElapsed >= PALETTE_TRANSITION_MS &&
			Math.abs(this.lyricScrimTarget - this.lyricScrim) < 0.001 &&
			this.crestShiftElapsed >= this.options.crestShiftMs
		);
	}

	private onTick(tickTime: number): void {
		this.tickHandle = 0;
		if (this.paused || this._disposed || this.contextLost) return;

		const interval = 1000 / this.maxFPS;
		const delta = tickTime - this.lastTickTime;
		if (delta < interval) {
			this.requestTick();
			return;
		}

		if (Number.isNaN(this.lastFrameTime)) this.lastFrameTime = tickTime;
		// 切后台回来时 delta 会很大，封个顶，否则调色板过渡会一帧跳完
		const frameDelta = Math.min(tickTime - this.lastFrameTime, 250);
		this.lastFrameTime = tickTime;
		this.lastTickTime = tickTime - (delta % interval);

		this.frameTime += frameDelta * this.flowSpeed;
		// 低频值先平滑一档：FFT 是离散帧，直接拿来加减速会有台阶感
		const volumeStep = Math.min(1, frameDelta / 120);
		this.smoothedVolume += (this.volume - this.smoothedVolume) * volumeStep;
		this.flowTime +=
			frameDelta *
			this.flowSpeed *
			(1 + LOW_FREQ_FLOW_GAIN * this.smoothedVolume);

		if (!(this.onRedraw(this.frameTime, frameDelta) && this.staticMode)) {
			this.requestTick();
		} else {
			this.lastFrameTime = Number.NaN;
		}
	}

	private readonly onTickBinded = this.onTick.bind(this);

	private requestTick(): void {
		if (this._disposed || this.paused || this.contextLost) return;
		// 写成 `!(maxFPS > 0)` 而不是 `maxFPS <= 0`，是为了连 NaN 一起挡掉
		if (!(this.maxFPS > 0)) return;
		if (this.tickHandle === 0) {
			this.tickHandle = requestAnimationFrame(this.onTickBinded);
		}
	}

	protected override onResize(width: number, height: number): void {
		this.targetWidth = Math.ceil(width);
		this.targetHeight = Math.ceil(height);
		this.requestTick();
	}

	override setStaticMode(enable: boolean): void {
		this.staticMode = enable;
		this.resetFrameClock();
		this.requestTick();
	}

	override setFPS(fps: number): void {
		this.maxFPS = fps;
		this.resetFrameClock();
		this.requestTick();
	}

	override pause(): void {
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this.paused = true;
	}

	override resume(): void {
		this.paused = false;
		this.resetFrameClock();
		this.requestTick();
	}

	private resetFrameClock(): void {
		const now = performance.now();
		this.lastFrameTime = now;
		this.lastTickTime = now;
	}

	private isCurrentAlbumRequest(requestId: number): boolean {
		return (
			!this._disposed && requestId === this.albumRequestId
		);
	}

	override async setAlbum(
		albumSource?: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void> {
		const requestId = ++this.albumRequestId;
		if (
			albumSource === undefined ||
			(typeof albumSource === "string" && albumSource.trim().length === 0)
		) {
			this.albumSource = undefined;
			this.transitionToColors(DEFAULT_OKLAB_COLORS, false);
			this.requestTick();
			return;
		}

		let source: HTMLImageElement | HTMLVideoElement | null = null;
		let remainRetryTimes = ALBUM_RETRY_TIMES;
		while (!source && remainRetryTimes > 0) {
			try {
				source =
					typeof albumSource === "string"
						? await loadResourceFromUrl(albumSource, isVideo)
						: await loadResourceFromElement(albumSource);
			} catch (error) {
				if (!this.isCurrentAlbumRequest(requestId)) return;
				remainRetryTimes--;
				console.warn(
					`failed on loading album resource, retrying (${remainRetryTimes})`,
					{ albumSource, error },
				);
			}
		}
		if (!this.isCurrentAlbumRequest(requestId)) return;
		if (!source) {
			console.error("Failed to load album resource", albumSource);
			return;
		}

		this.albumSource = source;
		// 换封面时锋线缓缓挪到新的随机姿态
		this.rollCrestTarget();
		// 视频封面只取首帧主色
		this.updatePaletteFromSource(source);
	}

	override setLowFreqVolume(volume: number): void {
		// 只存目标值，平滑交给 onTick；静态模式下不因低频重绘
		this.volume = clamp01(volume);
		if (!this.staticMode) this.requestTick();
	}

	override setHasLyric(hasLyric: boolean): void {
		// 有歌词时略收背景，保证白字可读性
		this.lyricScrimTarget = hasLyric ? 1 : 0;
		this.requestTick();
	}

	override dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
		this.canvas.removeEventListener(
			"webglcontextrestored",
			this.onContextRestored,
		);
		this.program.dispose();
		this.gl.deleteBuffer(this.quadBuffer);
		this.gl.getExtension("WEBGL_lose_context")?.loseContext();
		super.dispose();
	}
}
