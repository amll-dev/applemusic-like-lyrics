/**
 * @fileoverview
 * 一个适用于歌词页面横向布局的组件
 */

import classnames from "classnames";
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
			{/*
				这几个槽位刻意不用 layout 动画：进度条的音质标签用 popLayout 退场
				时会重置投影树快照，切歌那一下节点会拿失效快照做 translate + scale，
				封面表现为瞬间缩小跑向左上角再弹回。位移与尺寸本就有 CSS 过渡。
			*/}
			<div className={styles.thumb}>{thumbSlot}</div>
			<div className={styles.cover} ref={frameRef}>
				{coverSlot}
			</div>
			<div className={styles.controls}>{controlsSlot}</div>
			<div className={styles.lyric}>{lyricSlot}</div>
			<div className={styles.bottomControls}>{bottomControls}</div>
		</div>
	);
};
