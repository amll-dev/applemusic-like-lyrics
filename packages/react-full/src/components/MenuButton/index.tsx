import classNames from "classnames";
import { type HTMLProps, memo } from "react";
import IconMore from "./icon_more.svg?react";
import styles from "./index.module.css";

export const MenuButton: React.FC<HTMLProps<HTMLButtonElement>> = memo(
	({ className, type, ...rest }) => {
		return (
			<button
				className={classNames(styles.menuButton, className)}
				type="button"
				{...rest}
			>
				<IconMore />
			</button>
		);
	},
);
