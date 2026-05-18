/**
 * @fileoverview
 * 一个适用于歌词页面竖向布局的组件
 */

import classNames from "classnames";
import { type MotionProps, motion, type Target } from "framer-motion";
import type React from "react";
import type { HTMLProps } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import styles from "./vertical.module.css";

export const VerticalLayout: React.FC<
	{
		thumbSlot?: React.ReactNode;
		smallControlsSlot?: React.ReactNode;
		bigControlsSlot?: React.ReactNode;
		coverSlot?: React.ReactNode;
		lyricSlot?: React.ReactNode;
		asChild?: boolean;
		hideLyric?: boolean;
		immerseCover?: boolean;
	} & HTMLProps<HTMLDivElement>
> = ({
	thumbSlot,
	coverSlot,
	smallControlsSlot,
	bigControlsSlot,
	lyricSlot,
	hideLyric,
	asChild,
	className,
	immerseCover,
	...rest
}) => {
	const rootRef = useRef<HTMLDivElement>(null);
	const phonyBigCoverRef = useRef<HTMLDivElement>(null);
	const phonySmallCoverRef = useRef<HTMLDivElement>(null);
	const coverFrameRef = useRef<HTMLDivElement>(null);
	const hideLyricRef = useRef(hideLyric ?? false);
	const immerseCoverRef = useRef(immerseCover ?? false);
	const [currentCoverStyle, setCurrentCoverStyle] =
		useState<MotionProps["animate"]>(undefined);
	const calcCoverLayout = useCallback(
		(hideLyric = hideLyricRef.current): Target | undefined => {
			if (!rootRef.current) return;
			let rootEl: HTMLElement = rootRef.current;
			const targetCover = hideLyric
				? phonyBigCoverRef.current
				: phonySmallCoverRef.current;
			if (!targetCover || !rootEl) return;
			const immerseCover = immerseCoverRef.current;
			while (getComputedStyle(rootEl).display === "contents") {
				const parentEl = rootEl.parentElement;
				if (!parentEl) return;
				rootEl = parentEl;
			}
			const rootB = rootEl.getBoundingClientRect();
			const targetCoverB = targetCover.getBoundingClientRect();
			if (immerseCover) {
				const halfHeight =
					targetCoverB.top - rootB.top + targetCoverB.height / 2;
				const targetCoverSize = Math.max(
					halfHeight * 2.4,
					rootB.width * 1.2,
					Math.min(targetCover.clientWidth, targetCover.clientHeight),
				);
				const targetCoverLeft =
					targetCoverB.x - rootB.x + (targetCoverB.width - targetCoverSize) / 2;
				const targetCoverTop =
					targetCoverB.y -
					rootB.y +
					(targetCoverB.height - targetCoverSize) / 2;
				return {
					width: targetCoverSize,
					height: targetCoverSize,
					left: targetCoverLeft,
					top: targetCoverTop,
				};
			}
			const targetCoverSize = Math.min(
				targetCover.clientWidth,
				targetCover.clientHeight,
			);
			const targetCoverLeft =
				targetCoverB.x - rootB.x + (targetCoverB.width - targetCoverSize) / 2;
			const targetCoverTop =
				targetCoverB.y - rootB.y + (targetCoverB.height - targetCoverSize) / 2;
			return {
				width: targetCoverSize,
				height: targetCoverSize,
				left: targetCoverLeft,
				top: targetCoverTop,
			};
		},
		[],
	);
	useLayoutEffect(() => {
		hideLyricRef.current = hideLyric ?? false;
		immerseCoverRef.current = immerseCover ?? false;
		setCurrentCoverStyle(calcCoverLayout(hideLyricRef.current));
	}, [hideLyric, immerseCover, calcCoverLayout]);
	useLayoutEffect(() => {
		const phonyBigCoverEl = phonyBigCoverRef.current;
		const phonySmallCoverEl = phonySmallCoverRef.current;
		// const coverFrameEl = coverFrameRef.current;
		if (!phonyBigCoverEl || !phonySmallCoverEl) return;
		const obz = new ResizeObserver(() => {
			setCurrentCoverStyle(calcCoverLayout(hideLyricRef.current));
		});
		obz.observe(phonyBigCoverEl);
		obz.observe(phonySmallCoverEl);
		const init = calcCoverLayout(hideLyricRef.current);
		setCurrentCoverStyle(init);
		return () => {
			obz.disconnect();
		};
	}, [calcCoverLayout]);
	return (
		<div
			className={classNames(
				className,
				!asChild && styles.verticalLayout,
				!asChild && hideLyric && styles.hideLyric,
			)}
			ref={rootRef}
			{...rest}
		>
			<div className={styles.thumb}>{thumbSlot}</div>
			<div className={styles.lyricLayout}>
				{/** 用于占位，测量布局的大小用 */}
				<div className={styles.phonySmallCover} ref={phonySmallCoverRef} />
				<div className={styles.smallControls}>{smallControlsSlot}</div>
				<div className={styles.lyric}>{lyricSlot}</div>
			</div>
			<div className={styles.noLyricLayout}>
				{/** 用于占位，测量布局的大小用 */}
				<div className={styles.phonyBigCover} ref={phonyBigCoverRef} />
				<div className={styles.bigControls}>{bigControlsSlot}</div>
			</div>
			{currentCoverStyle && (
				<motion.div
					className={classNames(
						styles.coverFrame,
						immerseCover && styles.immerseCover,
					)}
					animate={currentCoverStyle}
					initial={false}
					transition={{
						type: "spring",
						stiffness: 200,
						damping: 30,
					}}
					ref={coverFrameRef}
				>
					{coverSlot}
				</motion.div>
			)}
		</div>
	);
};
