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
	/** The live video element, when coverIsVideo is true. */
	videoRef?: Ref<HTMLVideoElement>;
	musicPaused?: boolean;
	pauseShrinkAspect?: number;
} & HTMLProps<HTMLDivElement>;

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
			style,
			...rest
		},
		ref,
	) => {
		const frameRef = useRef<HTMLDivElement>(null);
		const composedRef = useComposedRefs(frameRef, ref);
		const clsNames = useMemo(
			() =>
				classNames(styles.cover, musicPaused && styles.musicPaused, className),
			[className, musicPaused],
		);
		const videoRef = useRef<HTMLVideoElement>(null);
		const composedVideoRef = useComposedRefs(videoRef, externalVideoRef);
		useEffect(() => {
			const videoEl = videoRef.current;
			if (videoEl) {
				if (coverVideoPaused) {
					videoEl.pause();
				} else {
					void videoEl.play().catch(() => {
						// Pausing, replacing the source, or autoplay policy can cancel playback.
					});
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

		const isRemoteUrl =
			coverUrl?.startsWith("http://") || coverUrl?.startsWith("https://");

		return (
			<div
				className={clsNames}
				style={
					{
						"--scale-level": pauseShrinkAspect ?? 0.75,
						...style,
					} as React.CSSProperties
				}
				ref={composedRef}
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
							style={
								{
									backgroundImage: `url(${coverUrl})`,
									"--scale-level": pauseShrinkAspect ?? 0.75,
								} as React.CSSProperties
							}
						/>
					)}
				</Squircle>
			</div>
		);
	},
);
