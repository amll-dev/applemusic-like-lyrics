import {
	type AbstractBaseRenderer,
	type BaseRenderer,
	BackgroundRender as CoreBackgroundRender,
	MeshGradientRenderer,
} from "@applemusic-like-lyrics/core";
import {
	type ForwardRefExoticComponent,
	forwardRef,
	type HTMLProps,
	type RefAttributes,
	useEffect,
	useImperativeHandle,
	useRef,
} from "react";

export {
	BaseRenderer,
	MeshGradientRenderer,
	PixiRenderer,
} from "@applemusic-like-lyrics/core";

/**
 * 背景渲染组件的属性
 */
export interface BackgroundRenderProps {
	/**
	 * 设置背景专辑资源
	 */
	album?: string | HTMLImageElement | HTMLVideoElement;
	/**
	 * 设置专辑资源是否为视频
	 */
	albumIsVideo?: boolean;
	/**
	 * 设置当前背景动画帧率，如果为 `undefined` 则默认为 `30`
	 */
	fps?: number;
	/**
	 * 设置当前播放状态，如果为 `undefined` 则默认为 `true`
	 */
	playing?: boolean;
	/**
	 * 设置当前动画流动速度，如果为 `undefined` 则默认为 `2`
	 */
	flowSpeed?: number;
	/**
	 * 设置背景是否根据“是否有歌词”这个特征调整自身效果，例如有歌词时会变得更加活跃
	 *
	 * 部分渲染器会根据这个特征调整自身效果
	 *
	 * 如果不确定是否需要赋值或无法知晓是否包含歌词，请传入 true 或不做任何处理（默认值为 true）
	 */
	hasLyric?: boolean;
	/**
	 * 设置低频的音量大小，范围在 80hz-120hz 之间为宜，取值范围在 [0.0-1.0] 之间
	 *
	 * 部分渲染器会根据音量大小调整背景效果（例如根据鼓点跳动）
	 *
	 * 如果无法获取到类似的数据，请传入 undefined 或 1.0 作为默认值，或不做任何处理（默认值即 1.0）
	 */
	lowFreqVolume?: number;
	/**
	 * 设置当前渲染缩放比例，如果为 `undefined` 则默认为 `0.5`
	 */
	renderScale?: number;
	/**
	 * 是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能
	 * 默认为 `false`
	 */
	staticMode?: boolean;
	/**
	 * 设置渲染器，如果为 `undefined` 则默认为 `MeshGradientRenderer`
	 * 默认渲染器有可能会随着版本更新而更换
	 */
	renderer?: {
		new (...args: ConstructorParameters<typeof BaseRenderer>): BaseRenderer;
	};
	/**
	 * 配置当前渲染器实例。
	 *
	 * 渲染器创建或回调变化后调用，可用于下发特定渲染器才支持的选项。
	 */
	configureRenderer?: (renderer: BaseRenderer) => void;
}

/**
 * 背景渲染组件的引用
 */
export interface BackgroundRenderRef {
	/**
	 * 背景渲染实例引用
	 */
	bgRender?: AbstractBaseRenderer;
	/**
	 * 将背景渲染实例的元素包裹起来的 DIV 元素实例
	 */
	wrapperEl: HTMLDivElement | null;
}

/**
 * 流体背景渲染组件，通过提供图片链接可以显示出酷似 Apple Music 的流体背景效果
 */
export const BackgroundRender: ForwardRefExoticComponent<
	Omit<HTMLProps<HTMLDivElement> & BackgroundRenderProps, "ref"> &
		RefAttributes<BackgroundRenderRef>
> = forwardRef<
	BackgroundRenderRef,
	HTMLProps<HTMLDivElement> & BackgroundRenderProps
>(
	(
		{
			album,
			albumIsVideo,
			fps,
			playing,
			flowSpeed,
			renderScale,
			staticMode,
			lowFreqVolume,
			hasLyric,
			renderer,
			configureRenderer,
			style,
			...props
		},
		ref,
	) => {
		const coreBGRenderRef = useRef<CoreBackgroundRender<BaseRenderer>>(null);
		const wrapperRef = useRef<HTMLDivElement>(null);
		const configureRendererRef = useRef(configureRenderer);
		configureRendererRef.current = configureRenderer;
		const rendererPropsRef = useRef({
			album,
			albumIsVideo,
			fps,
			playing,
			flowSpeed,
			renderScale,
			staticMode,
			lowFreqVolume,
			hasLyric,
		});
		rendererPropsRef.current = {
			album,
			albumIsVideo,
			fps,
			playing,
			flowSpeed,
			renderScale,
			staticMode,
			lowFreqVolume,
			hasLyric,
		};
		const curRenderer = renderer ?? MeshGradientRenderer;

		useEffect(() => {
			const rendererInstance = coreBGRenderRef.current?.getRenderer();
			if (rendererInstance) configureRenderer?.(rendererInstance);
		}, [configureRenderer]);

		useEffect(() => {
			if (album) coreBGRenderRef.current?.setAlbum(album, albumIsVideo);
		}, [album, albumIsVideo]);

		useEffect(() => {
			if (fps !== undefined) coreBGRenderRef.current?.setFPS(fps);
		}, [fps]);

		useEffect(() => {
			if (playing === undefined) {
				coreBGRenderRef.current?.resume();
			} else if (playing) {
				coreBGRenderRef.current?.resume();
			} else {
				coreBGRenderRef.current?.pause();
			}
		}, [playing]);

		useEffect(() => {
			if (flowSpeed !== undefined) {
				coreBGRenderRef.current?.setFlowSpeed(flowSpeed);
			}
		}, [flowSpeed]);

		useEffect(() => {
			coreBGRenderRef.current?.setStaticMode(staticMode ?? false);
		}, [staticMode]);

		useEffect(() => {
			if (renderScale !== undefined) {
				coreBGRenderRef.current?.setRenderScale(renderScale);
			}
		}, [renderScale]);

		useEffect(() => {
			if (lowFreqVolume !== undefined) {
				coreBGRenderRef.current?.setLowFreqVolume(lowFreqVolume);
			}
		}, [lowFreqVolume]);

		useEffect(() => {
			if (hasLyric !== undefined) {
				coreBGRenderRef.current?.setHasLyric(hasLyric);
			}
		}, [hasLyric]);

		useEffect(() => {
			const backgroundRender = CoreBackgroundRender.new(curRenderer);
			coreBGRenderRef.current = backgroundRender;
			configureRendererRef.current?.(backgroundRender.getRenderer());

			const current = rendererPropsRef.current;
			if (current.album) {
				backgroundRender.setAlbum(current.album, current.albumIsVideo);
			}
			if (current.fps !== undefined) backgroundRender.setFPS(current.fps);
			if (current.flowSpeed !== undefined) {
				backgroundRender.setFlowSpeed(current.flowSpeed);
			}
			backgroundRender.setStaticMode(current.staticMode ?? false);
			if (current.renderScale !== undefined) {
				backgroundRender.setRenderScale(current.renderScale);
			}
			if (current.lowFreqVolume !== undefined) {
				backgroundRender.setLowFreqVolume(current.lowFreqVolume);
			}
			if (current.hasLyric !== undefined) {
				backgroundRender.setHasLyric(current.hasLyric);
			}
			if (current.playing === false) backgroundRender.pause();
			else backgroundRender.resume();

			const element = backgroundRender.getElement();
			element.style.width = "100%";
			element.style.height = "100%";
			element.style.minHeight = "0";
			element.style.minWidth = "0";
			element.style.overflow = "hidden";
			wrapperRef.current?.appendChild(element);

			return () => {
				backgroundRender.dispose();
				if (coreBGRenderRef.current === backgroundRender) {
					coreBGRenderRef.current = null;
				}
			};
		}, [curRenderer]);

		useImperativeHandle(
			ref,
			() => ({
				get wrapperEl() {
					return wrapperRef.current;
				},
				get bgRender() {
					return coreBGRenderRef.current ?? undefined;
				},
			}),
			[],
		);

		return (
			<div
				style={{
					display: "contents",
					...style,
				}}
				{...props}
				ref={wrapperRef}
			/>
		);
	},
);
