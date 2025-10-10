import { type CSSProperties, type FC, useMemo } from "react";

// 没啥用
export const LinearBlurOverlay: FC<{
	direction: "column" | "row";
	size: number;
	radius: number;
}> = ({ direction, size, radius }) => {
	const styles = useMemo(() => {
		const filters = [];
		for (let blurLevel = 0.5; blurLevel <= radius; blurLevel *= 1.5) {
			const styles: CSSProperties = {};
			styles.backdropFilter = `blur(${blurLevel}px)`;
			filters.push(styles);
		}
		const maskStep = 100 / filters.length;
		filters.forEach((styles, i) => {
			styles.mask = `linear-gradient(to ${direction === "column" ? "top" : "right"}, rgba(0, 0, 0, 0) ${i * maskStep}%, rgba(0, 0, 0, 1) ${(i + 1) * maskStep}%, rgba(0, 0, 0, 1) ${(i + 2) * maskStep}%, rgba(0, 0, 0, 0) ${(i + 3) * maskStep}%)`;
			styles.zIndex = `${i + 1}`;
		});
		return filters;
	}, [radius, direction]);
	const mainAxis = direction === "column" ? "width" : "height";
	const crossAxis = direction === "column" ? "height" : "width";
	return (
		<div
			style={{
				flexDirection: direction,
				zIndex: 1,
				inset: 0,
				position: "absolute",
				pointerEvents: "none",
				[mainAxis]: "100%",
				[crossAxis]: `${size}px`,
			}}
		>
			{styles.map((styles, index) => (
				<div
					key={`linear-blur-overlay-${index}`}
					style={{
						position: "absolute",
						[crossAxis]: `${size}px`,
						[mainAxis]: "100%",
						...styles,
					}}
				/>
			))}
		</div>
	);
};
