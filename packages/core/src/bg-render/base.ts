import type { Disposable, HasElement } from "../interfaces.ts";

export abstract class AbstractBaseRenderer implements Disposable, HasElement {
	/**
	 * 修改背景的流动速度，数字越大越快，默认为 8
	 * @param speed 背景的流动速度，默认为 8
	 */
	abstract setFlowSpeed(speed: number): void;
	/**
	 * 修改背景的渲染比例，默认是 0.5
	 *
	 * 一般情况下这个程度既没有明显瑕疵也不会特别吃性能
	 * @param scale 背景的渲染比例
	 */
	abstract setRenderScale(scale: number): void;
	/**
	 * 是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能
	 * @param enable 是否启用静态模式
	 */
	abstract setStaticMode(enable: boolean): void;
	/**
	 * 修改背景动画帧率，默认是 30 FPS
	 *
	 * 如果设置成 0 则会停止动画
	 * @param fps 目标帧率，默认 30 FPS
	 */
	abstract setFPS(fps: number): void;
	/**
	 * 暂停背景动画，画面即便是更新了图片也不会发生变化
	 */
	abstract pause(): void;
	/**
	 * 恢复播放背景动画
	 */
	abstract resume(): void;
	/**
	 * 设置背景专辑资源，纹理加载并设置完成后会返回
	 * @param albumSource 专辑的资源链接，可以是图片或视频链接，抑或是任意 img/video 元素，如果提供字符串链接且为视频则需要指定第二个参数
	 */
	abstract setAlbum(
		albumSource: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void>;
	/**
	 * 设置低频的音量大小，范围在 80hz-120hz 之间为宜，取值范围在 [0.0-1.0] 之间
	 *
	 * 部分渲染器会根据音量大小调整背景效果（例如根据鼓点跳动）
	 *
	 * 如果无法获取到类似的数据，请传入 1.0 作为默认值，或不做任何处理（默认值即 1.0）
	 * @param volume 低频的音量大小，范围在 50hz-120hz 之间为宜，取值范围在 [0.0-1.0] 之间
	 */
	abstract setLowFreqVolume(volume: number): void;
	/**
	 * 设置背景是否根据“是否有歌词”这个特征调整自身效果，例如有歌词时会变得更加活跃
	 *
	 * 部分渲染器会根据这个特征调整自身效果
	 *
	 * 如果不确定是否需要赋值或无法知晓是否包含歌词，请传入 true 或不做任何处理（默认值为 true）
	 *
	 * @param hasLyric 是否有歌词，如不确定是否需要赋值，请传入 true 或不做任何处理（默认值为 true）
	 */
	abstract setHasLyric(hasLyric: boolean): void;
	abstract dispose(): void;
	abstract getElement(): HTMLElement;
}

export abstract class BaseRenderer extends AbstractBaseRenderer {
	private observer: ResizeObserver;
	protected flowSpeed = 1;
	protected currerntRenderScale = 0.75;
	constructor(protected canvas: HTMLCanvasElement) {
		super();
		this.observer = new ResizeObserver(() => {
			const width = Math.max(
				1,
				canvas.clientWidth * window.devicePixelRatio * this.currerntRenderScale,
			);
			const height = Math.max(
				1,
				canvas.clientHeight *
					window.devicePixelRatio *
					this.currerntRenderScale,
			);
			this.onResize(width, height);
		});
		this.observer.observe(canvas);
	}
	setRenderScale(scale: number): void {
		this.currerntRenderScale = scale;
		this.onResize(
			this.canvas.clientWidth *
				window.devicePixelRatio *
				this.currerntRenderScale,
			this.canvas.clientHeight *
				window.devicePixelRatio *
				this.currerntRenderScale,
		);
	}
	/**
	 * 当画板元素大小发生变化时此函数会被调用
	 * 可以在此处重设和渲染器相关的尺寸设置
	 * 考虑到初始化的时候元素不一定在文档中或出于某些特殊样式状态，尺寸长宽有可能会为 0，请注意进行特判处理
	 * @param width 画板元素实际的物理像素宽度，有可能为 0
	 * @param height 画板元素实际的物理像素高度，有可能为 0
	 */
	protected onResize(width: number, height: number): void {
		this.canvas.width = width;
		this.canvas.height = height;
	}
	/**
	 * 修改背景的流动速度，数字越大越快，默认为 1
	 * @param speed 背景的流动速度，默认为 1
	 */
	setFlowSpeed(speed: number): void {
		this.flowSpeed = speed;
	}
	/**
	 * 是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能
	 * @param enable 是否启用静态模式
	 */
	abstract override setStaticMode(enable: boolean): void;
	/**
	 * 修改背景动画帧率，默认是 30 FPS
	 *
	 * 如果设置成 0 则会停止动画
	 * @param fps 目标帧率，默认 30 FPS
	 */
	abstract override setFPS(fps: number): void;
	/**
	 * 暂停背景动画，画面即便是更新了图片也不会发生变化
	 */
	abstract override pause(): void;
	/**
	 * 恢复播放背景动画
	 */
	abstract override resume(): void;
	/**
	 * 设置背景专辑资源，纹理加载并设置完成后会返回
	 * @param albumSource 专辑的资源链接，可以是图片或视频链接，抑或是任意 img/video 元素，如果提供字符串链接且为视频则需要指定第二个参数
	 */
	abstract override setAlbum(
		albumSource: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void>;
	dispose(): void {
		this.observer.disconnect();
		this.canvas.remove();
	}
	override getElement(): HTMLElement {
		return this.canvas;
	}
}
