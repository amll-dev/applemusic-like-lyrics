/**
 * @fileoverview
 * 一个专辑图组件
 */

import classNames from "classnames";
import { Squircle } from "corner-smoothing";
import {
	type ForwardRefExoticComponent,
	forwardRef,
	type HTMLProps,
	type RefAttributes,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import styles from "./index.module.css";

export type CoverProps = {
	coverUrl?: string;
	coverIsVideo?: boolean;
	coverVideoPaused?: boolean;
	musicPaused?: boolean;
	pauseShrinkAspect?: number;
} & HTMLProps<HTMLElement>;

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
			className,
			musicPaused,
			pauseShrinkAspect,
			...rest
		},
		ref,
	) => {
		const frameRef = useRef<HTMLDivElement>(null);
		const clsNames = useMemo(
			() =>
				classNames(styles.cover, musicPaused && styles.musicPaused, className),
			[className, musicPaused],
		);
		const videoRef = useRef<HTMLVideoElement>(null);
		useEffect(() => {
			const videoEl = videoRef.current;
			if (videoEl) {
				if (coverVideoPaused) {
					videoEl.pause();
				} else {
					videoEl.play();
				}
			}
		}, [coverVideoPaused]);
		const [cornerRadius, setCornerRadius] = useState(20);

		useLayoutEffect(() => {
			const frameEl = frameRef.current;
			if (frameEl) {
				const onResize = () => {
					const size = Math.min(frameEl.clientWidth, frameEl.clientHeight);
					setCornerRadius(Math.max(size * 0.02, window.innerHeight * 0.007));
				};
				const obz = new ResizeObserver(onResize);
				onResize();
				obz.observe(frameEl);
				return () => {
					obz.disconnect();
				};
			}
			return;
		}, []);

		useImperativeHandle(ref, () => frameRef.current!, []);

		return (
			<div
				className={clsNames}
				style={
					{
						"--scale-level": pauseShrinkAspect ?? 0.75,
					} as React.CSSProperties
				}
				ref={frameRef}
				{...rest}
			>
				<Squircle
					cornerRadius={cornerRadius}
					cornerSmoothing={0.7}
					className={styles.coverInner}
				>
					{coverIsVideo ? (
						<video
							className={styles.coverInner}
							src={coverUrl}
							autoPlay
							loop
							muted
							playsInline
							crossOrigin="anonymous"
							ref={videoRef}
							{...rest}
						/>
					) : (
						<div
							className={styles.coverInner}
							alt="cover"
							style={
								{
									backgroundImage: `url(${coverUrl})`,
									"--scale-level": pauseShrinkAspect ?? 0.75,
								} as React.CSSProperties
							}
							{...rest}
						/>
					)}
				</Squircle>
			</div>
		);
	},
);
