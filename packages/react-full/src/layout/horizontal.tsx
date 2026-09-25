/**
 * @fileoverview
 * 一个适用于歌词页面横向布局的组件
 */

import classnames from "classnames";
import { motion } from "framer-motion";
import type React from "react";
import type { HTMLProps, Ref } from "react";
import { useMotionElementRef } from "../utils/useMotionElementRef";
import styles from "./horizontal.module.css";

export const HorizontalLayout: React.FC<
	{
		thumbSlot?: React.ReactNode;
		coverSlot?: React.ReactNode;
		coverFrameRef?: Ref<HTMLDivElement>;
		controlsSlot?: React.ReactNode;
		lyricSlot?: React.ReactNode;
		backgroundSlot?: React.ReactNode;
		bottomControls?: React.ReactNode;
		hideLyric?: boolean;
		asChild?: boolean;
	} & HTMLProps<HTMLDivElement>
> = ({
	thumbSlot,
	coverSlot,
	coverFrameRef,
	controlsSlot,
	lyricSlot,
	bottomControls,
	hideLyric,
	className,
	asChild,
	...rest
}) => {
	const frameRef = useMotionElementRef(coverFrameRef);
	return (
		<div
			className={classnames(
				className,
				!asChild && styles.horizontalLayout,
				!asChild && hideLyric && styles.hideLyric,
			)}
			{...rest}
		>
			<motion.div layout layoutId="amll-player-thumb" className={styles.thumb}>
				{thumbSlot}
			</motion.div>
			<motion.div
				layout
				layoutId="amll-player-cover"
				className={styles.cover}
				ref={frameRef}
			>
				{coverSlot}
			</motion.div>
			<motion.div
				layout
				layoutId="amll-player-controls"
				className={styles.controls}
			>
				{controlsSlot}
			</motion.div>
			<div className={styles.lyric}>{lyricSlot}</div>
			<div className={styles.bottomControls}>{bottomControls}</div>
		</div>
	);
};
