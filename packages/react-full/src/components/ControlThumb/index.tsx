import { useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./index.module.css";
import type { HTMLProps, FC } from "react";
import classNames from "classnames";

export const ControlThumb: FC<
	{
		onClick?: () => void;
	} & HTMLProps<HTMLDivElement>
> = ({ onClick, className, ...rest }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const hoveringRef = useRef(false);
	const [thumbOffset, setThumbOffset] = useState({
		marginLeft: -25,
		marginTop: -4,
	});
	const onMouseMove = (e: MouseEvent) => {
		const container = containerRef.current;
		if (container && hoveringRef.current) {
			const rect = container.getBoundingClientRect();
			const left = (e.clientX - rect.left) / 2;
			const top = (e.clientY - rect.top) / 2;
			if (Math.abs(left) > 25 || Math.abs(top) > 25) {
				setThumbOffset({
					marginLeft: -25,
					marginTop: -4,
				});
			} else {
				setThumbOffset({
					marginLeft: left - 25 / 2,
					marginTop: top - 25 / 2,
				});
			}
		}
	};
	return (
		<div
			className={classNames(styles.controlThumb, className)}
			ref={containerRef}
			{...rest}
		>
			<motion.button
				type="button"
				variants={{
					rest: {
						width: 50,
						height: 8,
					},
					hover: {
						width: 25,
						height: 25,
					},
				}}
				animate={thumbOffset}
				whileTap={{
					scale: 0.9,
				}}
				whileHover="hover"
				initial="rest"
				transition={{
					type: "spring",
					duration: 0.5,
				}}
				onMouseMove={(evt) => {
					onMouseMove(evt.nativeEvent);
				}}
				onHoverStart={(evt, _info) => {
					onMouseMove(evt);
					hoveringRef.current = true;
				}}
				onHoverEnd={() => {
					hoveringRef.current = false;
					setThumbOffset({
						marginLeft: -25,
						marginTop: -4,
					});
				}}
				onClick={onClick}
			>
				<motion.div
					variants={{
						rest: {
							height: 0,
							width: 0,
							marginTop: 0,
							marginLeft: 50 / 2,
							transform: "rotate(0)",
						},
						hover: {
							height: 2,
							width: 15,
							marginTop: -1,
							marginLeft: 5,
							transform: "rotate(45deg)",
						},
					}}
					transition={{
						type: "spring",
						duration: 0.5,
					}}
				/>
				<motion.div
					variants={{
						rest: {
							height: 0,
							width: 0,
							marginTop: 0,
							marginLeft: 50 / 2,
							transform: "rotate(0)",
						},
						hover: {
							height: 2,
							width: 15,
							marginTop: -1,
							marginLeft: 5,
							transform: "rotate(-45deg)",
						},
					}}
					transition={{
						type: "spring",
						duration: 0.5,
					}}
				/>
			</motion.button>
		</div>
	);
};
