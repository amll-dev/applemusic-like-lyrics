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
	 * 设置渲染器，如果为 `undefined` 则默认为 `PixiRenderer`
	 * 默认渲染器有可能会随着版本更新而更换
	 */
	renderer?: {
		new (...args: ConstructorParameters<typeof BaseRenderer>): BaseRenderer;
	};
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
			style,
			...props
		},
		ref,
	) => {
		const coreBGRenderRef = useRef<AbstractBaseRenderer>(null);
		const wrapperRef = useRef<HTMLDivElement>(null);
		const lastRendererRef = useRef<{
			new (canvas: HTMLCanvasElement): BaseRenderer;
		}>(null);
		const curRenderer = renderer ?? MeshGradientRenderer;

		useEffect(() => {
			if (
				lastRendererRef.current !== curRenderer ||
				coreBGRenderRef.current === undefined
			) {
				lastRendererRef.current = curRenderer;
				coreBGRenderRef.current?.dispose();
				coreBGRenderRef.current = CoreBackgroundRender.new(curRenderer);
			}
		}, [curRenderer]);

		useEffect(() => {
			if (curRenderer && album)
				coreBGRenderRef.current?.setAlbum(album, albumIsVideo);
		}, [curRenderer, album, albumIsVideo]);

		useEffect(() => {
			if (curRenderer && fps) coreBGRenderRef.current?.setFPS(fps);
		}, [curRenderer, fps]);

		useEffect(() => {
			if (!curRenderer) return;
			if (playing === undefined) {
				coreBGRenderRef.current?.resume();
			} else if (playing) {
				coreBGRenderRef.current?.resume();
			} else {
				coreBGRenderRef.current?.pause();
			}
		}, [curRenderer, playing]);

		useEffect(() => {
			if (!curRenderer) return;
			if (flowSpeed) coreBGRenderRef.current?.setFlowSpeed(flowSpeed);
		}, [curRenderer, flowSpeed]);

		useEffect(() => {
			if (!curRenderer) return;
			coreBGRenderRef.current?.setStaticMode(staticMode ?? false);
		}, [curRenderer, staticMode]);

		useEffect(() => {
			if (curRenderer && renderScale)
				coreBGRenderRef.current?.setRenderScale(renderScale ?? 0.5);
		}, [curRenderer, renderScale]);

		useEffect(() => {
			if (curRenderer && lowFreqVolume)
				coreBGRenderRef.current?.setLowFreqVolume(lowFreqVolume ?? 1.0);
		}, [curRenderer, lowFreqVolume]);

		useEffect(() => {
			if (curRenderer && hasLyric !== undefined)
				coreBGRenderRef.current?.setHasLyric(hasLyric ?? true);
		}, [curRenderer, hasLyric]);

		// biome-ignore lint/correctness/useExhaustiveDependencies: coreBGRenderRef.current
		useEffect(() => {
			if (coreBGRenderRef.current) {
				const el = coreBGRenderRef.current.getElement();
				el.style.width = "100%";
				el.style.height = "100%";
				el.style.minHeight = "0";
				el.style.minWidth = "0";
				el.style.overflow = "hidden";
				wrapperRef.current?.appendChild(el);
			}
		}, [coreBGRenderRef.current]);

		// biome-ignore lint/correctness/useExhaustiveDependencies: wrapperRef.current, coreBGRenderRef.current
		useImperativeHandle(
			ref,
			() => ({
				wrapperEl: wrapperRef.current,
				bgRender: coreBGRenderRef.current!,
			}),
			[wrapperRef.current, coreBGRenderRef.current],
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
