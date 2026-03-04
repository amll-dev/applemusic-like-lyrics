import classNames from "classnames";
import { type ComponentProps, type FC, memo, useState } from "react";
import styles from "./index.module.css";

export const MediaButton: FC<ComponentProps<"button">> = memo(
	({
		className,
		children,
		type = "button",
		onClick,
		onAnimationEnd,
		...rest
	}) => {
		const [isAnimating, setIsAnimating] = useState(false);

		const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
			setIsAnimating(true);
			onClick?.(e);
		};

		const handleAnimationEnd = (e: React.AnimationEvent<HTMLButtonElement>) => {
			setIsAnimating(false);
			onAnimationEnd?.(e);
		};

		return (
			<button
				className={classNames(
					styles.mediaButton,
					{ [styles.animate]: isAnimating },
					className,
				)}
				type={type}
				onClick={handleClick}
				onAnimationEnd={handleAnimationEnd}
				{...rest}
			>
				{children}
			</button>
		);
	},
);
