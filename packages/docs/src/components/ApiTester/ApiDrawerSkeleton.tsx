import { useEffect, useState } from "react";

export function ApiDrawerSkeleton() {
	const [active, setActive] = useState(false);

	useEffect(() => {
		const timer = requestAnimationFrame(() => {
			setActive(true);
		});
		return () => cancelAnimationFrame(timer);
	}, []);

	return (
		<div
			className={`amll-api-drawer skeleton-drawer ${active ? "open" : ""}`}
			aria-label="Loading drawer..."
		>
			<div className="drawer-resize-handle" />
			<div className="drawer-header">
				<div
					className="skeleton-pulse"
					style={{ width: "90px", height: "1.1rem", borderRadius: "0.25rem" }}
				/>
				<div
					className="skeleton-pulse"
					style={{ width: "20px", height: "20px", borderRadius: "50%" }}
				/>
			</div>
			<div className="drawer-content">
				<div className="address-bar-container">
					<div
						className="address-bar skeleton-pulse"
						style={{ height: "2.2rem", borderRadius: "0.3rem" }}
					/>
					<div
						className="skeleton-pulse"
						style={{ width: "65px", height: "2.2rem", borderRadius: "0.3rem" }}
					/>
				</div>
				<div className="params-section" style={{ marginTop: "0.5rem" }}>
					<div
						className="skeleton-pulse"
						style={{
							width: "70px",
							height: "0.9rem",
							marginBottom: "0.5rem",
							borderRadius: "0.2rem",
						}}
					/>
					<div
						className="skeleton-pulse"
						style={{ height: "90px", borderRadius: "0.4rem" }}
					/>
				</div>
				<div className="response-section" style={{ marginTop: "0.5rem" }}>
					<div className="response-header-bar">
						<div
							className="skeleton-pulse"
							style={{
								width: "110px",
								height: "1.2rem",
								borderRadius: "0.3rem",
							}}
						/>
					</div>
					<div
						className="skeleton-pulse"
						style={{ height: "280px", borderRadius: "0.4rem" }}
					/>
				</div>
			</div>
		</div>
	);
}
