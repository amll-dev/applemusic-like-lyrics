import classNames from "classnames";
import { type FC, type HTMLProps, memo, type ReactNode } from "react";
import airplayIcon from "../IconButton/airplay.svg";
import styles from "./index.module.css";
import lyricsOffIcon from "./lyrics_off.svg";
import lyricsOnIcon from "./lyrics_on.svg";
import playlistOffIcon from "./playlist_off.svg";
import playlistOnIcon from "./playlist_on.svg";
import { PrebuiltToggleIconButtonType } from "./prebuilt-enum";
import repeatOffIcon from "./repeat_off.svg";
import repeatOnNormalIcon from "./repeat_on_normal.svg";
import shuffleOffIcon from "./shuffle_off.svg";
import shuffleOnIcon from "./shuffle_on.svg";
import starIcon from "./star.svg";
import starFilledIcon from "./star_filled.svg";

export const ToggleIconButton: FC<
	{
		uncheckedIcon: ReactNode;
		checkedIcon: ReactNode;
		checked?: boolean;
	} & Omit<HTMLProps<HTMLButtonElement>, "type">
> = memo(({ uncheckedIcon, checkedIcon, checked, className, ...rest }) => {
	return (
		<button
			className={classNames(className, styles.toggleIconButton)}
			type="button"
			{...rest}
		>
			{checked ? checkedIcon : uncheckedIcon}
		</button>
	);
});

type IconComponent = typeof lyricsOffIcon;

const PREBUILT_ICONS_MAP: Record<
	PrebuiltToggleIconButtonType,
	[IconComponent, IconComponent]
> = {
	[PrebuiltToggleIconButtonType.Lyrics]: [lyricsOffIcon, lyricsOnIcon],
	[PrebuiltToggleIconButtonType.Playlist]: [playlistOffIcon, playlistOnIcon],
	[PrebuiltToggleIconButtonType.Repeat]: [repeatOffIcon, repeatOnNormalIcon],
	[PrebuiltToggleIconButtonType.Shuffle]: [shuffleOffIcon, shuffleOnIcon],
	[PrebuiltToggleIconButtonType.Star]: [starIcon, starFilledIcon],
	[PrebuiltToggleIconButtonType.AirPlay]: [airplayIcon, airplayIcon],
};

export const PrebuiltToggleIconButton: FC<
	{
		type: PrebuiltToggleIconButtonType;
		checked?: boolean;
	} & Omit<HTMLProps<HTMLButtonElement>, "type">
> = memo(({ type, checked, onClick, ...rest }) => {
	const [UncheckedIcon, CheckedIcon] = PREBUILT_ICONS_MAP[type];
	return (
		<ToggleIconButton
			uncheckedIcon={<UncheckedIcon />}
			checkedIcon={<CheckedIcon />}
			checked={checked ?? false}
			onClick={onClick}
			{...rest}
		/>
	);
});
