import classNames from "classnames";
import { motion, type Variants } from "framer-motion";
import { forwardRef, type HTMLProps, memo } from "react";
import IconDolbyAtmos from "./icon_dolby_atmos.svg?react";
import LoselessIcon from "./icon_loseless.svg?react";
import styles from "./index.module.css";

const COMMON_VARIENTS: Variants = {
	hide: {
		opacity: 0,
		scale: 0.8,
		transition: {
			duration: 0.25,
			ease: "circIn",
		},
	},
	show: {
		opacity: 1,
		scale: 1,
		transition: {
			duration: 1,
			ease: [0, 0.71, 0.2, 1.01],
		},
	},
	hover: {
		scale: 0.95,
	},
	active: {
		scale: 0.9,
	},
};

const DOLBY_VARIENTS: Variants = {
	hide: {
		opacity: 0,
		scale: 0.8,
		transition: {
			duration: 0.25,
			ease: "circIn",
		},
	},
	show: {
		opacity: [0, 1],
		scale: 1,
		transition: {
			duration: 1,
			ease: [0, 0.71, 0.2, 1.01],
		},
	},
	hover: {
		scale: 0.95,
	},
	active: {
		scale: 0.9,
	},
};

export const AudioQualityTag = memo(
	forwardRef<
		HTMLDivElement,
		{
			isDolbyAtmos?: boolean;
			tagText?: string;
			tagIcon?: boolean;
		} & HTMLProps<HTMLDivElement>
	>(({ tagText, tagIcon, isDolbyAtmos, className, onClick, ...rest }, ref) => {
		return (
			<div
				className={classNames(
					className,
					styles.audioQualityTag,
					onClick && styles.clickable,
				)}
				onClick={onClick}
				ref={ref}
				{...rest}
			>
				{isDolbyAtmos ? (
					<motion.div
						key="dolby-atmos"
						initial="hide"
						animate="show"
						whileHover={onClick ? "hover" : undefined}
						whileTap={onClick ? "active" : undefined}
						exit="hide"
						className={styles.dolbyLogo}
						variants={DOLBY_VARIENTS}
					>
						<IconDolbyAtmos className={styles.dolbyLogoGlow} />
						<IconDolbyAtmos />
					</motion.div>
				) : (
					<motion.div
						key={`common-tag-${tagIcon}-${tagText}`}
						initial="hide"
						animate="show"
						whileHover={onClick ? "hover" : undefined}
						whileTap={onClick ? "active" : undefined}
						exit="hide"
						variants={COMMON_VARIENTS}
					>
						<div className={styles.commonTag}>
							{tagIcon && <LoselessIcon height="11px" />}
							{tagText && <div className={styles.commonTagText}>{tagText}</div>}
						</div>
					</motion.div>
				)}
			</div>
		);
	}),
);
