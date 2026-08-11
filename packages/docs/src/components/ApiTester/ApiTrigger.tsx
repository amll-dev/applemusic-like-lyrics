import { API_CONFIG } from "#core/configs/index.ts";
import { useHydratedTranslation } from "#core/i18n.ts";
import { openTesterWith } from "#core/store.ts";
import "./trigger.css";

interface ApiTriggerProps {
	actionId: keyof typeof API_CONFIG;
}

export function ApiTrigger({ actionId }: ApiTriggerProps) {
	const { t, mounted } = useHydratedTranslation();
	const config = API_CONFIG[actionId];

	if (!config) {
		return <div className="amll-api-card error">Unknown API: {actionId}</div>;
	}

	return (
		<div className="amll-api-card">
			<div className="card-address-bar">
				<span className={`method ${config.method.toLowerCase()}`}>
					{config.method}
				</span>
				<span className="card-path">{config.path}</span>
			</div>
			<button
				className="card-debug-btn"
				onClick={() => openTesterWith(actionId, config)}
			>
				{mounted ? (
					t("apiTester.debug")
				) : (
					<span className="amll-btn-skeleton" aria-hidden="true" />
				)}
			</button>
		</div>
	);
}
