import classNames from "classnames";
import { motion } from "framer-motion";
import type {
	ForwardRefExoticComponent,
	HTMLProps,
	Ref,
	RefAttributes,
} from "react";
import { forwardRef, useRef, useState } from "react";
import { useComposedRefs } from "../../utils/useComposedRefs";
import { useMotionElementRef } from "../../utils/useMotionElementRef";
import styles from "./index.module.css";

export type ControlThumbProps = {
	onClick?: () => void;
	/** Ref to the interactive button; the forwarded ref targets its container. */
	buttonRef?: Ref<HTMLButtonElement>;
	/** Accessible name for the collapse button. */
	buttonLabel?: string;
} & HTMLProps<HTMLDivElement>;

export const ControlThumb: ForwardRefExoticComponent<
	ControlThumbProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, ControlThumbProps>(
	({ onClick, className, buttonRef, buttonLabel, ...rest }, ref) => {
		const containerRef = useRef<HTMLDivElement>(null);
		const composedRef = useComposedRefs(containerRef, ref);
		const interactiveRef = useMotionElementRef(buttonRef);
		const hoveringRef = useRef(false);
		const [thumbOffset, setThumbOffset] = useState({
			x: -25,
			y: -4,
		});
		const onMouseMove = (e: MouseEvent) => {
			const container = containerRef.current;
			if (container && hoveringRef.current) {
				const rect = container.getBoundingClientRect();
				const left = (e.clientX - rect.left) / 2;
				const top = (e.clientY - rect.top) / 2;
				if (Math.abs(left) > 25 || Math.abs(top) > 25) {
					setThumbOffset({
						x: -25,
						y: -4,
					});
				} else {
					setThumbOffset({
						x: left - 25 / 2,
						y: top - 25 / 2,
					});
				}
			}
		};

		return (
			<div
				className={classNames(styles.controlThumb, className)}
				{...rest}
				ref={composedRef}
			>
				<motion.button
					type="button"
					ref={interactiveRef}
					aria-label={buttonLabel}
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
					animate={{
						...thumbOffset,
					}}
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
					onHoverStart={(evt) => {
						onMouseMove(evt);
						hoveringRef.current = true;
					}}
					onHoverEnd={() => {
						hoveringRef.current = false;
						setThumbOffset({
							x: -25,
							y: -4,
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
								marginLeft: 25,
								rotate: 0,
							},
							hover: {
								height: 2,
								width: 15,
								marginTop: -1,
								marginLeft: 5,
								rotate: 45,
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
								marginLeft: 25,
								rotate: 0,
							},
							hover: {
								height: 2,
								width: 15,
								marginTop: -1,
								marginLeft: 5,
								rotate: -45,
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
	},
);
