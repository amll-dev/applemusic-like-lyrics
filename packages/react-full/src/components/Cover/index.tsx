/**
 * @fileoverview
 * 一个专辑图组件
 */

import classNames from "classnames";
import { Squircle } from "corner-smoothing";
import {
	AnimatePresence,
	motion,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "framer-motion";
import {
	type CSSProperties,
	type ForwardRefExoticComponent,
	forwardRef,
	type HTMLProps,
	type PointerEvent as ReactPointerEvent,
	type Ref,
	type RefAttributes,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useComposedRefs } from "../../utils/useComposedRefs";
import styles from "./index.module.css";

export type CoverProps = {
	coverUrl?: string;
	coverIsVideo?: boolean;
	coverVideoPaused?: boolean;
	/** 封面视频元素的 ref，仅在 `coverIsVideo` 为 true 时指向视频元素，切换为图片封面时会被清空 */
	videoRef?: Ref<HTMLVideoElement>;
	musicPaused?: boolean;
	pauseShrinkAspect?: number;
	/** 上一首的封面；存在且光标靠近左侧时会预窥 */
	previousCoverUrl?: string;
	/** 下一首的封面；存在且光标靠近右侧时会预窥 */
	nextCoverUrl?: string;
	/** 当前是否正在播放；暂停时封面轻微缩小，恢复播放时弹回 */
	playing?: boolean;
	/** 点击封面左侧三分之一的回调 */
	onPrevious?: () => void;
	/** 点击封面右侧三分之一的回调 */
	onNext?: () => void;
	/** 点击封面中间三分之一的回调（通常是播放 / 暂停） */
	onTogglePlay?: () => void;
} & HTMLProps<HTMLDivElement>;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

type Side = "previous" | "next" | null;

// 封装帧容器的尺寸，供边缘位移与预窥比例使用
type FrameMetrics = {
	width: number;
	height: number;
	cornerRadius: number;
};

/**
 * 一个专辑图组件
 */
export const Cover: ForwardRefExoticComponent<
	CoverProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, CoverProps>(
	(
		{
			coverUrl,
			coverIsVideo,
			coverVideoPaused,
			videoRef: externalVideoRef,
			className,
			musicPaused,
			pauseShrinkAspect,
			previousCoverUrl,
			nextCoverUrl,
			playing = true,
			onPrevious,
			onNext,
			onTogglePlay,
			style,
			...rest
		},
		ref,
	) => {
		const frameRef = useRef<HTMLDivElement>(null);
		const composedRef = useComposedRefs(frameRef, ref);
		const prefersReducedMotion = useReducedMotion();
		const clsNames = useMemo(
			() =>
				classNames(styles.cover, musicPaused && styles.musicPaused, className),
			[className, musicPaused],
		);
		const videoRef = useRef<HTMLVideoElement>(null);
		const composedVideoRef = useComposedRefs(videoRef, externalVideoRef);

		// 光标吸附：最多跟随 6px，避免大幅位移
		const pointerX = useMotionValue(0);
		const pointerY = useMotionValue(0);
		const smoothX = useSpring(pointerX, {
			stiffness: 320,
			damping: 28,
			mass: 0.4,
		});
		const smoothY = useSpring(pointerY, {
			stiffness: 320,
			damping: 28,
			mass: 0.4,
		});
		// 预窥时主封面向反方向避让的位移 / 轻微 Y 轴旋转
		const edgeShift = useSpring(0, { stiffness: 260, damping: 26, mass: 0.6 });
		const edgeRotate = useSpring(0, { stiffness: 260, damping: 26, mass: 0.6 });

		const [hovered, setHovered] = useState(false);
		const [side, setSide] = useState<Side>(null);
		// 切歌方向：+1 = 下一首（新封面从右进、旧封面往左退），-1 = 上一首
		const [direction, setDirection] = useState<1 | -1>(1);
		const [metrics, setMetrics] = useState<FrameMetrics>({
			width: 0,
			height: 0,
			cornerRadius: 20,
		});

		useEffect(() => {
			const videoEl = videoRef.current;
			if (videoEl) {
				if (coverVideoPaused) {
					videoEl.pause();
				} else {
					void videoEl.play().catch(() => {
						// 暂停、替换视频源或自动播放策略都可能中断播放请求，忽略即可
					});
				}
			}
		}, [coverVideoPaused]);

		useLayoutEffect(() => {
			const frameEl = frameRef.current;
			if (!frameEl) return;
			const onResize = () => {
				const width = frameEl.clientWidth;
				const height = frameEl.clientHeight;
				const size = Math.min(width, height);
				setMetrics({
					width,
					height,
					cornerRadius: Math.max(size * 0.02, window.innerHeight * 0.007),
				});
			};
			const obz = new ResizeObserver(onResize);
			onResize();
			obz.observe(frameEl);
			return () => {
				obz.disconnect();
			};
		}, []);

		// 靠近边缘时让主封面避让，给侧边封面留出展示空间
		useLayoutEffect(() => {
			if (prefersReducedMotion) {
				edgeShift.set(0);
				edgeRotate.set(0);
				return;
			}
			const shift = metrics.width * 0.06;
			edgeShift.set(side === "previous" ? shift : side === "next" ? -shift : 0);
			edgeRotate.set(side === "previous" ? -2 : side === "next" ? 2 : 0);
		}, [side, metrics.width, prefersReducedMotion, edgeShift, edgeRotate]);

		// 切歌时收起当前预窥，避免新旧邻封面的短晩重叠
		// biome-ignore lint/correctness/useExhaustiveDependencies: 只跟随封面地址变化
		useEffect(() => {
			setSide(null);
		}, [coverUrl]);

		const handlePointerMove = (evt: ReactPointerEvent<HTMLDivElement>) => {
			const frameEl = frameRef.current;
			if (!frameEl) return;
			const rect = frameEl.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return;
			const nx = (evt.clientX - rect.left) / rect.width;
			const ny = (evt.clientY - rect.top) / rect.height;
			if (!prefersReducedMotion) {
				pointerX.set(clamp((nx - 0.5) * 12, -6, 6));
				pointerY.set(clamp((ny - 0.5) * 8, -4, 4));
			}
			const nextSide: Side = nx < 0.25 ? "previous" : nx > 0.75 ? "next" : null;
			setSide((current) => (current === nextSide ? current : nextSide));
		};

		const resetPointer = () => {
			setHovered(false);
			setSide(null);
			pointerX.set(0);
			pointerY.set(0);
		};

		// 暂停时略缩小；悬停时回到原尺寸（播放中再稍微放大一点），让「点一下
		// 中间继续播放」的暗示更明确。
		const pausedScale = pauseShrinkAspect ?? 0.75;
		const targetScale = hovered
			? playing === false
				? 1
				: 1.02
			: playing === false
				? pausedScale
				: 1;

		const isRemoteUrl =
			coverUrl?.startsWith("http://") || coverUrl?.startsWith("https://");

		const swapVariants = {
			enter: (dir: number) => ({
				x: prefersReducedMotion ? 0 : `${dir * 14}%`,
				rotateY: prefersReducedMotion ? 0 : -dir * 7,
				scale: prefersReducedMotion ? 1 : 0.99,
				opacity: 0,
			}),
			center: { x: 0, rotateY: 0, scale: 1, opacity: 1 },
			exit: (dir: number) => ({
				x: prefersReducedMotion ? 0 : `${-dir * 4}%`,
				rotateY: prefersReducedMotion ? 0 : dir * 4,
				scale: 1,
				opacity: 0,
				/*
				 * 新封面渲染在旧封面上面（AnimatePresence 先排退场节点、后排入场节点），
				 * 所以旧封面先保持不透明、等新封面完全盖在上面之后再淡出：
				 * 两张图同时半透明时叠出来的不透明度只有 ~75%，背景会透出来（看上去就是「闪一下透明」）。
				 */
				transition: {
					type: "spring" as const,
					stiffness: 220,
					damping: 26,
					mass: 0.9,
					opacity: { delay: 0.16, duration: 0.14, ease: "easeIn" as const },
				},
			}),
		};

		const swapTransition = prefersReducedMotion
			? { duration: 0.15 }
			: {
					type: "spring" as const,
					stiffness: 220,
					damping: 26,
					mass: 0.9,
					// 入场只快速淡入，配合下面旧封面延迟淡出，全程不会出现半透明缺口
					opacity: {
						type: "tween" as const,
						duration: 0.16,
						ease: "easeOut" as const,
					},
				};

		// 侧封面贴住主封面内侧边缘缩放，位移刚好抵消缩放让出的缝隙即为露出量
		const sideVariants = (dir: "previous" | "next") => {
			const sign = dir === "previous" ? -1 : 1;
			return {
				// 藏起来时缩放 0.94 会露出 6% 的缝隙，位移 6% 正好把它完全塞回主封面背后
				hidden: { opacity: 0, x: `${sign * 6}%`, rotateY: 0, scale: 0.94 },
				// 位移 14% - 缩放缝隙 4% = 自身露出 10%，再叠加主封面 6% 的反向避让，
				// 合计约主封面宽度的 1/6。
				visible: {
					opacity: 1,
					x: `${sign * 14}%`,
					// 外侧边缘向后倾，强化「藏在主封面后面」的感觉
					rotateY: prefersReducedMotion ? 0 : sign * 3,
					scale: 0.96,
				},
			};
		};

		return (
			<div
				className={clsNames}
				style={
					{
						// 缩放已经交给下面的 scale 动画，但外部 CSS 仍在读这个变量，
						// 保留导出；调用方传入的 style 优先。
						"--scale-level": pausedScale,
						...style,
					} as CSSProperties
				}
				ref={composedRef}
				onPointerEnter={() => setHovered(true)}
				onPointerMove={handlePointerMove}
				onPointerLeave={resetPointer}
				{...rest}
			>
				<motion.div
					className={styles.assembly}
					style={{ x: smoothX, y: smoothY }}
					animate={{ scale: targetScale }}
					transition={{
						type: "spring",
						stiffness: 280,
						damping: 24,
						mass: 0.6,
					}}
				>
					{previousCoverUrl ? (
						<motion.div
							className={classNames(styles.sideCover, styles.sidePrevious)}
							aria-hidden="true"
							style={{ backgroundImage: `url(${previousCoverUrl})` }}
							variants={sideVariants("previous")}
							initial="hidden"
							animate={side === "previous" ? "visible" : "hidden"}
							transition={swapTransition}
						/>
					) : null}
					{nextCoverUrl ? (
						<motion.div
							className={classNames(styles.sideCover, styles.sideNext)}
							aria-hidden="true"
							style={{ backgroundImage: `url(${nextCoverUrl})` }}
							variants={sideVariants("next")}
							initial="hidden"
							animate={side === "next" ? "visible" : "hidden"}
							transition={swapTransition}
						/>
					) : null}

					{/* 主封面单独一层，预窥时向反方向避让，让侧封面真正露出来 */}
					<motion.div
						className={styles.mainCover}
						style={{ x: edgeShift, rotateY: edgeRotate }}
					>
						{/* 静止的阴影层：动画层只做 transform/opacity，避免图层光栅化出错 */}
						<div className={styles.coverShadow} />
						<AnimatePresence initial={false} custom={direction}>
							<motion.div
								key={coverUrl || "empty"}
								className={styles.coverSwap}
								custom={direction}
								variants={swapVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={swapTransition}
							>
								<Squircle
									cornerRadius={metrics.cornerRadius}
									cornerSmoothing={0.7}
									className={styles.coverInner}
								>
									{coverIsVideo ? (
										<video
											className={styles.coverInner}
											src={coverUrl}
											autoPlay={!coverVideoPaused}
											loop
											muted
											playsInline
											crossOrigin={isRemoteUrl ? "anonymous" : undefined}
											ref={composedVideoRef}
										/>
									) : (
										<div
											className={styles.coverInner}
											style={{
												backgroundImage: `url(${coverUrl})`,
											}}
										/>
									)}
								</Squircle>
							</motion.div>
						</AnimatePresence>
					</motion.div>
				</motion.div>

				<button
					type="button"
					className={classNames(styles.zone, styles.zonePrevious)}
					aria-label="上一首"
					onClick={() => {
						setDirection(-1);
						onPrevious?.();
					}}
				/>
				<button
					type="button"
					className={classNames(styles.zone, styles.zoneCenter)}
					aria-label={playing === false ? "播放" : "暂停"}
					onClick={() => onTogglePlay?.()}
				/>
				<button
					type="button"
					className={classNames(styles.zone, styles.zoneNext)}
					aria-label="下一首"
					onClick={() => {
						setDirection(1);
						onNext?.();
					}}
				/>
			</div>
		);
	},
);
