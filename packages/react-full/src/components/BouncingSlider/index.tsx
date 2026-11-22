import classNames from "classnames";
import {
	animate,
	motion,
	type PanInfo,
	useMotionTemplate,
	useMotionValue,
	useSpring,
	useTransform,
} from "framer-motion";
import type React from "react";
import { useEffect, useRef } from "react";
import styles from "./index.module.css";

export interface SliderProps {
	className?: string;
	style?: React.CSSProperties;
	value: number;
	min: number;
	max: number;
	isPlaying?: boolean;
	onChange?: (v: number) => void;
	onAfterChange?: (v: number) => void;
	onBeforeChange?: () => void;
	onSeeking?: (v: boolean) => void;
	beforeIcon?: React.ReactNode;
	afterIcon?: React.ReactNode;
	changeOnDrag?: boolean;
	/** 是否推进进度；歌词页收起时传 `false`，组件仍挂在 DOM 里但不跑帧循环。 */
	active?: boolean;
	/** 换歌标识；变化时先淡出已播放部分，再在不可见状态下跳回开头。 */
	resetKey?: string;
	/**
	 * 是否正在等待音频数据。
	 *
	 * 为 true 时不再自行推进进度（否则拖动进度后会「假装」还在播），
	 * 并在轨道上画一道流动的加载高光。
	 */
	buffering?: boolean;
}

const MAX_HEIGHT = 20;
const MIN_HEIGHT = 8;
const INITIAL_INSET = (MAX_HEIGHT - MIN_HEIGHT) / 2;

const MAX_BOUNCE_DISTANCE = 12;

export const BouncingSlider: React.FC<SliderProps> = ({
	className,
	style,
	value,
	min,
	max,
	isPlaying = false,
	onChange,
	onAfterChange,
	onBeforeChange,
	onSeeking,
	beforeIcon,
	afterIcon,
	changeOnDrag = false,
	active = true,
	resetKey,
	buffering = false,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const rectRef = useRef<DOMRect | null>(null);
	const isHoveringRef = useRef(false);

	const progressMv = useMotionValue(0);
	const scaleX = useTransform(progressMv, [0, 1], [0, 1]);

	// 已播放部分的透明度：换歌时先淡出旧进度，再在透明状态下从零开始
	const thumbOpacity = useMotionValue(1);
	const resettingRef = useRef(false);
	const resetKeyRef = useRef(resetKey);
	const resetTokenRef = useRef<symbol | null>(null);
	// 动画回调里需要最新的值，直接从最新一次渲染取
	const latestRef = useRef({ value, min, max });
	latestRef.current = { value, min, max };

	const insetMv = useMotionValue(INITIAL_INSET);

	const clipPath = useMotionTemplate`inset(${insetMv}px 0px round 100px)`;

	const bounceXSpring = useSpring(0, { damping: 12, stiffness: 300 });

	const isDraggingRef = useRef(false);
	const localTimeRef = useRef(value);

	// 换歌：已播放部分快速淡出 → 在透明状态下跳回开头 → 再淡入
	useEffect(() => {
		if (!resetKey || resetKey === resetKeyRef.current) return;
		resetKeyRef.current = resetKey;

		// 连续快速切歌时，只有最后一次的重置可以写回进度
		const token = Symbol("slider-reset");
		resetTokenRef.current = token;
		resettingRef.current = true;
		const fadeOut = animate(thumbOpacity, 0, {
			type: "tween",
			duration: 0.12,
			ease: "easeOut",
		});
		void fadeOut.then(() => {
			if (resetTokenRef.current !== token) return;
			const {
				value: nextValue,
				min: nextMin,
				max: nextMax,
			} = latestRef.current;
			const span = nextMax - nextMin;
			localTimeRef.current = nextValue;
			progressMv.set(
				span > 0 ? Math.max(0, Math.min(1, (nextValue - nextMin) / span)) : 0,
			);
			resettingRef.current = false;
			animate(thumbOpacity, 1, {
				type: "tween",
				duration: 0.3,
				delay: 0.04,
				ease: "easeOut",
			});
		});

		return () => {
			fadeOut.stop();
			if (resetTokenRef.current === token) {
				resetTokenRef.current = null;
				resettingRef.current = false;
				// 连续快速切歌时不要把进度条永久留在不可见状态
				thumbOpacity.set(1);
			}
		};
	}, [resetKey, thumbOpacity, progressMv]);

	useEffect(() => {
		if (isDraggingRef.current || resettingRef.current) return;

		localTimeRef.current = value;
		const newProgress = Math.max(0, Math.min(1, (value - min) / (max - min)));
		progressMv.set(newProgress);
	}, [value, min, max, progressMv]);

	// 不用 framer-motion 的 `useAnimationFrame`：它会从挂载起就永久订阅帧循环，
	// 即使歌曲暂停或歌词页已经隐藏。这里用普通 rAF，只在真正需要推进时启动。
	useEffect(() => {
		if (!active || !isPlaying) return;
		let frame = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const delta = Math.min(now - last, 64);
			last = now;
			if (!isDraggingRef.current && !resettingRef.current && !buffering) {
				localTimeRef.current = Math.min(max, localTimeRef.current + delta);
				const span = max - min;
				const newProgress =
					span > 0
						? Math.max(0, Math.min(1, (localTimeRef.current - min) / span))
						: 0;
				progressMv.set(newProgress);
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [active, isPlaying, min, max, progressMv, buffering]);

	const expand = () => {
		animate(insetMv, 0, { type: "tween", ease: "easeOut", duration: 0.28 });
	};

	const collapse = () => {
		animate(insetMv, INITIAL_INSET, {
			type: "spring",
			damping: 12,
			stiffness: 200,
		});
	};

	const handlePanStart = (_event: MouseEvent | TouchEvent | PointerEvent) => {
		isDraggingRef.current = true;

		if (innerRef.current) {
			rectRef.current = innerRef.current.getBoundingClientRect();
		}

		expand();

		onBeforeChange?.();
		onSeeking?.(true);
	};

	const handlePan = (
		_event: MouseEvent | TouchEvent | PointerEvent,
		info: PanInfo,
	) => {
		const rect = rectRef.current;
		if (!rect) return;

		const relPos = (info.point.x - rect.left) / rect.width;

		if (relPos < 0) {
			bounceXSpring.set(Math.tanh(relPos * 2) * MAX_BOUNCE_DISTANCE);
		} else if (relPos > 1) {
			bounceXSpring.set(Math.tanh((relPos - 1) * 2) * MAX_BOUNCE_DISTANCE);
		} else {
			bounceXSpring.set(0);
		}

		const clampedPos = Math.max(0, Math.min(1, relPos));
		const NewValue = min + clampedPos * (max - min);

		localTimeRef.current = NewValue;

		progressMv.set(clampedPos);

		if (changeOnDrag) {
			onChange?.(NewValue);
		}
	};

	const handlePanEnd = () => {
		isDraggingRef.current = false;
		rectRef.current = null;

		if (isHoveringRef.current) {
			expand();
		} else {
			collapse();
		}

		bounceXSpring.set(0);

		onSeeking?.(false);

		onChange?.(localTimeRef.current);

		onAfterChange?.(localTimeRef.current);
	};

	const handleHoverStart = () => {
		isHoveringRef.current = true;
		if (!isDraggingRef.current) {
			expand();
		}
	};

	const handleHoverEnd = () => {
		isHoveringRef.current = false;
		if (!isDraggingRef.current) {
			collapse();
		}
	};

	const handleTap = (
		_event: MouseEvent | TouchEvent | PointerEvent,
		info: PanInfo,
	) => {
		const rect = innerRef.current?.getBoundingClientRect();
		if (!rect) return;

		const relPos = Math.max(
			0,
			Math.min(1, (info.point.x - rect.left) / rect.width),
		);

		const NewValue = min + relPos * (max - min);

		localTimeRef.current = NewValue;
		progressMv.set(relPos);

		onBeforeChange?.();
		onChange?.(NewValue);
		onAfterChange?.(NewValue);
	};

	return (
		<motion.div
			ref={containerRef}
			className={classNames(styles.nowPlayingSlider, className)}
			style={{
				...style,
				x: bounceXSpring,
			}}
			onPanStart={handlePanStart}
			onPan={handlePan}
			onPanEnd={handlePanEnd}
			onTap={handleTap}
			onHoverStart={handleHoverStart}
			onHoverEnd={handleHoverEnd}
		>
			{beforeIcon}
			<motion.div
				ref={innerRef}
				className={styles.inner}
				style={{
					clipPath: clipPath,
				}}
			>
				<motion.div
					className={styles.thumb}
					style={{
						scaleX: scaleX,
						originX: 0,
						opacity: thumbOpacity,
					}}
				/>
				{buffering && <div className={styles.bufferingSheen} />}
			</motion.div>

			{afterIcon}
		</motion.div>
	);
};
