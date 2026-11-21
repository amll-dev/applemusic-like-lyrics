import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { type FC, type HTMLProps, memo, type PropsWithChildren } from "react";
import { MenuButton } from "../MenuButton";
import { TextMarquee } from "../TextMarquee";
import styles from "./index.module.css";

/** 换歌时新信息文字的过渡曲线，收尾更平缓 */
const SLIDE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

const lineVariants = {
	initial: { opacity: 0, x: "18%", filter: "blur(0px)" },
	visible: {
		opacity: 1,
		x: "0%",
		filter: "blur(0px)",
		// 延后一点入场，让旧文字先模糊淡出，避免两团文字叠在同一个位置
		transition: { duration: 0.44, delay: 0.08, ease: SLIDE_EASE },
	},
	exit: {
		// 旧信息原地模糊后淡出，显式锁住 x，防止跟着新信息一起位移
		x: "0%",
		opacity: 0,
		filter: "blur(6px)",
		transition: {
			filter: { duration: 0.14, ease: "easeOut" as const },
			opacity: { duration: 0.22, ease: "easeOut" as const },
		},
	},
};

/**
 * 一行歌曲信息：内容变化时旧文字模糊淡出、新文字从右侧滑入。用 grid 把新旧
 * 两份文字叠在同一格里，换字号或行高时容器高度不会跳。
 */
const MusicInfoLine: FC<PropsWithChildren<{ contentKey: string }>> = ({
	contentKey,
	children,
}) => (
	<div className={styles.line}>
		<AnimatePresence initial={false}>
			<motion.div
				key={contentKey}
				className={styles.lineInner}
				variants={lineVariants}
				initial="initial"
				animate="visible"
				exit="exit"
			>
				{children}
			</motion.div>
		</AnimatePresence>
	</div>
);

export const MusicInfo: React.FC<
	{
		name?: string;
		artists?: string[];
		album?: string;
		onArtistClicked?: (artist: string, index: number) => void;
		onAlbumClicked?: () => void;
		onMenuButtonClicked?: () => void;
		/**
		 * 是否显示菜单按钮，在紧凑播放器中复用歌曲信息时可以隐藏
		 *
		 * @default true
		 */
		showMenuButton?: boolean;
		/** 传给文字容器的属性及 ref，不包含菜单按钮 */
		infoProps?: HTMLProps<HTMLDivElement>;
	} & HTMLProps<HTMLDivElement>
> = memo(
	({
		name,
		artists,
		album,
		onArtistClicked,
		onAlbumClicked,
		onMenuButtonClicked,
		showMenuButton = true,
		infoProps,
		className,
		...rest
	}) => {
		return (
			<div className={classNames(styles.musicInfo, className)} {...rest}>
				<div
					{...infoProps}
					className={classNames(styles.info, infoProps?.className)}
				>
					{name !== undefined && (
						<MusicInfoLine contentKey={`name:${name}`}>
							<TextMarquee className={styles.name}>{name}</TextMarquee>
						</MusicInfoLine>
					)}
					{artists !== undefined && (
						<MusicInfoLine contentKey={`artists:${artists.join(" ")}`}>
							<TextMarquee className={styles.artists}>
								{artists.map((v) => (
									<a key={`artist-${v}`}>{v}</a>
								))}
							</TextMarquee>
						</MusicInfoLine>
					)}
					{album !== undefined && (
						<MusicInfoLine contentKey={`album:${album}`}>
							<TextMarquee className={styles.album}>{album}</TextMarquee>
						</MusicInfoLine>
					)}
				</div>
				{showMenuButton && <MenuButton onClick={onMenuButtonClicked} />}
			</div>
		);
	},
);
