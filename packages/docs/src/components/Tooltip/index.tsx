import type React from "react";
import { useState } from "react";
import { useHydratedTranslation } from "#core/i18n.ts";

export interface TooltipProps {
	content: React.ReactNode;
	required?: boolean;
	children: React.ReactNode;
	placement?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
	content,
	required,
	children,
	placement = "top",
}: TooltipProps) {
	const { t } = useHydratedTranslation();
	const [visible, setVisible] = useState(false);

	if (!content) return <>{children}</>;

	return (
		<div
			className="amll-tooltip-wrapper"
			onMouseEnter={() => setVisible(true)}
			onMouseLeave={() => setVisible(false)}
			onFocus={() => setVisible(true)}
			onBlur={() => setVisible(false)}
		>
			{children}
			{visible && (
				<div
					className={`amll-tooltip-bubble placement-${placement}`}
					role="tooltip"
				>
					{required !== undefined && (
						<span
							className={`tooltip-badge ${required ? "required" : "optional"}`}
						>
							{required ? t("tooltip.required") : t("tooltip.optional")}
						</span>
					)}
					<span className="tooltip-content">{content}</span>
				</div>
			)}
		</div>
	);
}
