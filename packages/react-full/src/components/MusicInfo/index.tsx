import classNames from "classnames";
import { type HTMLProps, memo } from "react";
import { MenuButton } from "../MenuButton";
import { TextMarquee } from "../TextMarquee";
import styles from "./index.module.css";

export const MusicInfo: React.FC<
	{
		name?: string;
		artists?: string[];
		album?: string;
		onArtistClicked?: (artist: string, index: number) => void;
		onAlbumClicked?: () => void;
		onMenuButtonClicked?: () => void;
		/** Hide the menu when reusing the same metadata in a compact player. */
		showMenuButton?: boolean;
		/** Attributes and ref for the text container, excluding the menu button. */
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
						<TextMarquee className={styles.name}>{name}</TextMarquee>
					)}
					{artists !== undefined && (
						<TextMarquee className={styles.artists}>
							{artists.map((v) => (
								<a key={`artist-${v}`}>{v}</a>
							))}
						</TextMarquee>
					)}
					{album !== undefined && (
						<TextMarquee className={styles.album}>{album}</TextMarquee>
					)}
				</div>
				{showMenuButton && <MenuButton onClick={onMenuButtonClicked} />}
			</div>
		);
	},
);
