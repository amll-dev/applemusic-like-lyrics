import Editor, { loader } from "@monaco-editor/react";
import { useStore } from "@nanostores/react";
import {
	Braces,
	CheckCircle2,
	Circle,
	Info,
	Key,
	Loader2,
	Send,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "#core/configs/index.ts";
import { useHydratedTranslation } from "#core/i18n.ts";
import { ToastContainer, toast } from "../Toast";
import { Tooltip } from "../Tooltip";

if (typeof window !== "undefined") {
	Promise.all([
		import("monaco-editor/esm/vs/editor/editor.api.js"),
		import(
			"monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js"
		),
		import("monaco-editor/esm/vs/languages/features/json/register.js"),
	]).then(([monaco]) => {
		loader.config({ monaco });
	});
}

import {
	bearerToken,
	createEmptyParam,
	currentEndpoint,
	type DynamicParam,
	drawerWidth,
	isDarkTheme,
	isDrawerDragging,
	isDrawerOpen,
	requestParams,
	requestPathParams,
	responseState,
} from "#core/store.ts";
import "./styles.css";

function formatBytes(bytes: number | null): string {
	if (bytes === null || bytes === undefined) return "0 B";
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatTime(ms: number | null): string {
	if (ms === null || ms === undefined) return "0 ms";
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(2)} s`;
	}
	return `${ms} ms`;
}

function formatElapsedTime(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

export function ApiDrawer() {
	const { t } = useHydratedTranslation();
	const open = useStore(isDrawerOpen);
	const endpoint = useStore(currentEndpoint);
	const params = useStore(requestParams);
	const res = useStore(responseState);
	const token = useStore(bearerToken);
	const isDark = useStore(isDarkTheme);
	const [requestUrl, setRequestUrl] = useState("");
	const [activeTab, setActiveTab] = useState<"body" | "headers">("body");
	const [monacoRef, setMonacoRef] = useState<
		typeof import("monaco-editor") | null
	>(null);
	const [elapsedTime, setElapsedTime] = useState<number>(0);
	const abortControllerRef = useRef<AbortController | null>(null);

	useEffect(() => {
		let timer: ReturnType<typeof setInterval>;
		if (res.loading) {
			const start = Date.now();
			setElapsedTime(0);
			timer = setInterval(() => {
				setElapsedTime(Date.now() - start);
			}, 50);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [res.loading]);

	const updateMonacoThemes = (
		monacoInstance: typeof import("monaco-editor"),
		darkState: boolean,
	) => {
		const style = getComputedStyle(document.documentElement);
		const bgInlineCode =
			style.getPropertyValue("--sl-color-bg-inline-code").trim() ||
			(darkState ? "#18181b" : "#f4f4f5");

		const cleanHex = (val: string, fallback: string) => {
			const cleaned = val.replace("#", "").trim();
			return cleaned.length >= 3 ? cleaned : fallback;
		};

		const accentHex = cleanHex(
			style.getPropertyValue("--sl-color-text-accent"),
			darkState ? "93c5fd" : "4338ca",
		);

		const mutedHex = darkState ? "a1a1aa" : "71717a";
		const numberHex = darkState ? "f472b6" : "db2777";
		const stringHex = darkState ? "fde047" : "b45309";

		monacoInstance.editor.defineTheme("amll-theme-dark", {
			base: "vs-dark",
			inherit: true,
			rules: [
				{ token: "string.key.json", foreground: accentHex, fontStyle: "bold" },
				{ token: "string.value.json", foreground: stringHex },
				{ token: "string", foreground: stringHex },
				{ token: "number", foreground: numberHex },
				{ token: "keyword", foreground: accentHex },
				{ token: "delimiter", foreground: mutedHex },
			],
			colors: {
				"editor.background": bgInlineCode,
				"editorGutter.background": bgInlineCode,
				"editor.lineHighlightBackground": "#ffffff0d",
				"editorIndentGuide.background": "#ffffff15",
				"editorIndentGuide.activeBackground": "#ffffff30",
				"menu.background": bgInlineCode,
				"menu.foreground": "#e4e4e7",
				"menu.selectionBackground": "#ffffff1a",
				"menu.selectionForeground": "#ffffff",
				"menu.separatorBackground": "#ffffff20",
				"menu.border": "#ffffff20",
				"list.hoverBackground": "#ffffff1a",
				"list.hoverForeground": "#ffffff",
				"list.activeSelectionBackground": "#ffffff25",
				"list.activeSelectionForeground": "#ffffff",
				"list.focusBackground": "#ffffff1a",
			},
		});

		monacoInstance.editor.defineTheme("amll-theme-light", {
			base: "vs",
			inherit: true,
			rules: [
				{ token: "string.key.json", foreground: accentHex, fontStyle: "bold" },
				{ token: "string.value.json", foreground: stringHex },
				{ token: "string", foreground: stringHex },
				{ token: "number", foreground: numberHex },
				{ token: "keyword", foreground: accentHex },
				{ token: "delimiter", foreground: mutedHex },
			],
			colors: {
				"editor.background": bgInlineCode,
				"editorGutter.background": bgInlineCode,
				"editor.lineHighlightBackground": "#0000000a",
				"editorIndentGuide.background": "#00000015",
				"editorIndentGuide.activeBackground": "#00000030",
				"menu.background": bgInlineCode,
				"menu.foreground": "#18181b",
				"menu.selectionBackground": "#00000012",
				"menu.selectionForeground": "#18181b",
				"menu.separatorBackground": "#00000015",
				"menu.border": "#00000015",
				"list.hoverBackground": "#00000012",
				"list.hoverForeground": "#18181b",
				"list.activeSelectionBackground": "#00000018",
				"list.activeSelectionForeground": "#18181b",
				"list.focusBackground": "#00000012",
			},
		});

		const activeTheme = darkState ? "amll-theme-dark" : "amll-theme-light";
		monacoInstance.editor.setTheme(activeTheme);
	};

	useEffect(() => {
		if (monacoRef) {
			requestAnimationFrame(() => {
				updateMonacoThemes(monacoRef, isDark);
			});
		}
	}, [isDark, monacoRef]);

	const pathParamsState = useStore(requestPathParams);

	useEffect(() => {
		if (endpoint) {
			let formattedPath = endpoint.path;
			if (endpoint.pathParams) {
				for (const p of endpoint.pathParams) {
					const val = pathParamsState[p.name] ?? "";
					formattedPath = formattedPath.replace(
						`{${p.name}}`,
						val ? encodeURIComponent(val) : `{${p.name}}`,
					);
				}
			}
			setRequestUrl(`${API_BASE_URL}${formattedPath}`);
		}
	}, [endpoint, pathParamsState]);

	const updatePathParam = (name: string, val: string) => {
		const newPathParams = { ...pathParamsState, [name]: val };
		requestPathParams.set(newPathParams);
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = drawerWidth.get();

		isDrawerDragging.set(true);
		document.body.style.cursor = "ew-resize";

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const deltaX = startX - moveEvent.clientX;
			const maxWidth = Math.min(800, window.innerWidth * 0.8);
			const newWidth = Math.max(320, Math.min(maxWidth, startWidth + deltaX));
			drawerWidth.set(newWidth);
		};

		const handleMouseUp = () => {
			isDrawerDragging.set(false);
			document.body.style.cursor = "";
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	};

	const updateParam = (
		id: string,
		field: keyof DynamicParam,
		val: string | boolean,
	) => {
		const newParams = [...params];
		const index = newParams.findIndex((p) => p.id === id);

		if (index > -1) {
			newParams[index] = { ...newParams[index], [field]: val };

			if (
				index === newParams.length - 1 &&
				(field === "key" || field === "value") &&
				val !== ""
			) {
				newParams[index].enabled = true;
				newParams.push(createEmptyParam());
			}
		}
		requestParams.set(newParams);
	};

	const removeParam = (id: string) => {
		const newParams = params.filter((p) => p.id !== id);
		if (
			newParams.length === 0 ||
			(newParams[newParams.length - 1].key !== "" &&
				newParams[newParams.length - 1].value !== "")
		) {
			newParams.push(createEmptyParam());
		}
		requestParams.set(newParams);
	};

	const handleCancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		responseState.set({
			loading: false,
			status: null,
			data: null,
			headers: null,
			time: null,
			size: null,
			error: null,
		});
	};

	const handleSend = async () => {
		if (!endpoint) return;

		if (/\{[a-zA-Z0-9_]+\}/.test(requestUrl)) {
			const missingMatches = requestUrl.match(/\{[a-zA-Z0-9_]+\}/g);
			const missingParams = missingMatches
				? missingMatches.map((m) => m.slice(1, -1)).join(", ")
				: "";
			toast.warning(t("apiTester.fillPathParams", { params: missingParams }));
			return;
		}

		let url: URL;
		try {
			url = new URL(requestUrl);
		} catch {
			toast.error(t("apiTester.invalidUrl"));
			return;
		}

		const controller = new AbortController();
		abortControllerRef.current = controller;

		responseState.set({
			loading: true,
			data: null,
			headers: null,
			status: null,
			time: null,
			size: null,
			error: null,
		});

		const startTime = performance.now();

		try {
			if (endpoint.method === "GET") {
				for (const param of params) {
					if (param.enabled && param.key.trim() !== "") {
						url.searchParams.append(param.key.trim(), param.value);
					}
				}
			}

			const headers: HeadersInit = {
				Accept: "application/json",
			};
			if (endpoint.authRequired && token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const response = await fetch(url.toString(), {
				method: endpoint.method,
				headers,
				signal: controller.signal,
			});

			const endTime = performance.now();
			const duration = Math.round(endTime - startTime);

			const headersObj: Record<string, string> = {};
			response.headers.forEach((val, key) => {
				headersObj[key] = val;
			});
			const headersFormatted = JSON.stringify(headersObj, null, 2);

			const rawText = await response.text();
			let dataFormatted = rawText;
			let dataSize = new TextEncoder().encode(rawText).byteLength;

			if (rawText.trim()) {
				try {
					const json = JSON.parse(rawText);
					dataFormatted = JSON.stringify(json, null, 2);
					dataSize = new TextEncoder().encode(dataFormatted).byteLength;
				} catch {
					dataFormatted = rawText;
				}
			}

			responseState.set({
				loading: false,
				status: response.status,
				data: dataFormatted,
				headers: headersFormatted,
				time: duration,
				size: dataSize,
				error: null,
			});
		} catch (error) {
			const endTime = performance.now();
			const duration = Math.round(endTime - startTime);
			if (error instanceof Error && error.name === "AbortError") {
				responseState.set({
					loading: false,
					status: null,
					data: null,
					headers: null,
					time: null,
					size: null,
					error: null,
				});
			} else {
				responseState.set({
					loading: false,
					status: 0,
					data: null,
					headers: null,
					time: duration,
					size: 0,
					error:
						error instanceof Error ? error.message : "Unknown Network Error",
				});
			}
		} finally {
			abortControllerRef.current = null;
		}
	};

	return (
		<>
			<ToastContainer />
			<div className={`amll-api-drawer ${open ? "open" : ""}`}>
				<div className="drawer-resize-handle" onMouseDown={handleMouseDown} />
				<div className="drawer-header">
					<h3>{t("apiTester.onlineTest")}</h3>
					<button
						className="close-btn"
						onClick={() => isDrawerOpen.set(false)}
						title={t("apiTester.close")}
					>
						<X size={20} strokeWidth={2.5} />
					</button>
				</div>

				{endpoint ? (
					<div className="drawer-content">
						<div className="address-bar-container">
							<div className="address-bar">
								<span className={`method ${endpoint.method.toLowerCase()}`}>
									{endpoint.method}
								</span>
								<input
									type="text"
									className="url-input"
									value={requestUrl}
									onChange={(e) => setRequestUrl(e.target.value)}
									placeholder="https://api.amll.dev/..."
								/>
							</div>
							<button
								className={`send-btn ${res.loading ? "cancel-mode" : ""}`}
								onClick={res.loading ? handleCancel : handleSend}
							>
								{res.loading ? (
									<>
										<Loader2 size={13} className="send-spinner spin" />
										{t("apiTester.cancel")}
									</>
								) : (
									t("apiTester.send")
								)}
							</button>
						</div>

						{endpoint.authRequired && (
							<div className="params-section">
								<h4>{t("apiTester.authParams")}</h4>
								<div className="params-table">
									<div className="params-table-row auth-row">
										<div className="col-chk">
											<Key size={14} className="auth-param-icon" />
										</div>
										<div className="col-key">
											<input
												type="text"
												value={t("apiTester.bearerToken")}
												disabled
												readOnly
												className="path-key-input"
											/>
										</div>
										<div className="col-val">
											<input
												type="password"
												value={token}
												onChange={(e) => bearerToken.set(e.target.value)}
												placeholder="4653679905858000d..."
											/>
										</div>
										<div className="col-action">
											<Tooltip
												content={t("apiTester.bearerTokenDesc")}
												required={true}
												placement="left"
											>
												<button
													type="button"
													className="row-info-btn is-required"
												>
													<Info size={15} />
												</button>
											</Tooltip>
										</div>
									</div>
								</div>
							</div>
						)}

						{endpoint.pathParams && endpoint.pathParams.length > 0 && (
							<div className="params-section">
								<h4>{t("apiTester.pathParams")}</h4>
								<div className="params-table">
									{endpoint.pathParams.map((p) => {
										const paramKey = `apiParams.${endpoint.id}.${p.name}`;
										const translatedDesc = t(paramKey);
										const description =
											(translatedDesc !== paramKey ? translatedDesc : "") ||
											p.placeholder ||
											"";
										return (
											<div className="params-table-row path-row" key={p.name}>
												<div className="col-chk">
													<Braces size={14} className="path-param-icon" />
												</div>
												<div className="col-key">
													<input
														type="text"
														value={p.name}
														disabled
														readOnly
														className="path-key-input"
													/>
												</div>
												<div className="col-val">
													<input
														type="text"
														value={pathParamsState[p.name] ?? ""}
														onChange={(e) =>
															updatePathParam(p.name, e.target.value)
														}
														placeholder={p.placeholder || t("apiTester.value")}
													/>
												</div>
												<div className="col-action">
													<Tooltip
														content={description}
														required={p.required}
														placement="left"
													>
														<button
															type="button"
															className={`row-info-btn ${p.required ? "is-required" : ""}`}
														>
															<Info size={15} />
														</button>
													</Tooltip>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						<div className="params-section">
							<h4>{t("apiTester.queryParams")}</h4>
							<div className="params-table">
								{params.map((p, index) => {
									const isLastEmptyRow = index === params.length - 1;
									const paramDef = endpoint.params?.find(
										(def) => def.name === p.key,
									);
									const isRequired = paramDef?.required ?? false;
									const paramKey = `apiParams.${endpoint.id}.${p.key}`;
									const translatedDesc = p.key ? t(paramKey) : "";
									const paramDescription =
										translatedDesc !== paramKey ? translatedDesc : "";
									const infoDescription = !isLastEmptyRow
										? paramDescription ||
											(p.key ? t("apiTester.customParam") : "")
										: "";

									const valuePlaceholder = isLastEmptyRow
										? ""
										: paramDef?.placeholder || t("apiTester.value");

									return (
										<div className="params-table-row" key={p.id}>
											<div className="col-chk">
												{!isLastEmptyRow && (
													<button
														className={`icon-checkbox ${p.enabled ? "checked" : ""}`}
														onClick={() =>
															updateParam(p.id, "enabled", !p.enabled)
														}
														title={
															p.enabled
																? t("apiTester.disableParam")
																: t("apiTester.enableParam")
														}
													>
														{p.enabled ? (
															<CheckCircle2 size={16} />
														) : (
															<Circle size={16} />
														)}
													</button>
												)}
											</div>
											<div className="col-key">
												<input
													type="text"
													value={p.key}
													onChange={(e) =>
														updateParam(p.id, "key", e.target.value)
													}
													placeholder={
														isLastEmptyRow
															? t("apiTester.addParam")
															: t("apiTester.key")
													}
												/>
											</div>
											<div className="col-val">
												<input
													type="text"
													value={p.value}
													onChange={(e) =>
														updateParam(p.id, "value", e.target.value)
													}
													placeholder={valuePlaceholder}
												/>
											</div>
											<div className="col-del">
												{!isLastEmptyRow && (
													<div className="row-actions-group">
														{infoDescription && (
															<Tooltip
																content={infoDescription}
																required={paramDef ? isRequired : false}
																placement="left"
															>
																<button
																	type="button"
																	className={`row-info-btn ${isRequired ? "is-required" : ""}`}
																>
																	<Info size={15} />
																</button>
															</Tooltip>
														)}
														<button
															type="button"
															className="row-del-btn"
															onClick={() => removeParam(p.id)}
															title={t("apiTester.delete")}
														>
															<Trash2 size={16} />
														</button>
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div className="response-section">
							<div className="response-header-bar">
								<div className="response-tabs">
									<button
										className={`tab-btn ${activeTab === "body" ? "active" : ""}`}
										onClick={() => setActiveTab("body")}
									>
										body
									</button>
									<button
										className={`tab-btn ${activeTab === "headers" ? "active" : ""}`}
										onClick={() => setActiveTab("headers")}
									>
										headers
									</button>
								</div>
								{res.status !== null && (
									<div className="response-metrics">
										<span className={`status s-${res.status}`}>
											{res.status}
										</span>
										<span className="dot-divider">·</span>
										<span className="metric-item">{formatTime(res.time)}</span>
										<span className="dot-divider">·</span>
										<span className="metric-item">{formatBytes(res.size)}</span>
									</div>
								)}
							</div>
							{(() => {
								const isUnsent =
									res.status === null &&
									!res.loading &&
									!res.data &&
									!res.error;
								const showPlaceholder = res.loading || isUnsent;
								const showBodyEditor = !showPlaceholder && activeTab === "body";
								const showHeadersTable =
									!showPlaceholder && activeTab === "headers";

								return (
									<div className="response-content-wrapper">
										{showPlaceholder && (
											<div
												className={`response-status-placeholder ${
													res.loading ? "loading" : "idle"
												}`}
											>
												{res.loading ? (
													<Loader2
														size={24}
														className="placeholder-icon spin"
													/>
												) : (
													<Send size={22} className="placeholder-icon" />
												)}
												<div className="placeholder-title">
													{res.loading
														? t("apiTester.waitingResponse")
														: t("apiTester.sendToDebug")}
												</div>
												{res.loading && (
													<div className="placeholder-subtitle">
														{formatElapsedTime(elapsedTime)}
													</div>
												)}
											</div>
										)}
										{(() => {
											const contentValue = res.data ?? res.error ?? "";
											const isJsonContent = (() => {
												if (!contentValue.trim()) return false;
												try {
													JSON.parse(contentValue);
													return true;
												} catch {
													return false;
												}
											})();

											return (
												<div
													className="response-editor-wrapper"
													style={{ display: showBodyEditor ? "block" : "none" }}
												>
													<Editor
														height="280px"
														defaultLanguage="json"
														language={isJsonContent ? "json" : "plaintext"}
														theme={
															isDark ? "amll-theme-dark" : "amll-theme-light"
														}
														beforeMount={(monaco) => {
															setMonacoRef(monaco);
															updateMonacoThemes(monaco, isDark);
														}}
														value={contentValue}
														onChange={(value) => {
															responseState.set({
																...res,
																data: value ?? "",
															});
														}}
														options={{
															minimap: { enabled: false },
															scrollBeyondLastLine: false,
															fontSize: 12,
															fontFamily:
																'var(--sl-font-mono), ui-monospace, "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
															wordWrap: "on",
															automaticLayout: true,
															tabSize: 2,
															lineNumbersMinChars: 3,
															folding: true,
														}}
													/>
												</div>
											);
										})()}

										<div
											className="response-headers-wrapper"
											style={{ display: showHeadersTable ? "block" : "none" }}
										>
											{(() => {
												let headerPairs: [string, string][] = [];
												if (res.headers) {
													try {
														headerPairs = Object.entries(
															JSON.parse(res.headers),
														);
													} catch {
														headerPairs = [];
													}
												}
												return headerPairs.length > 0 ? (
													<table className="headers-table">
														<thead>
															<tr>
																<th>Key</th>
																<th>Value</th>
															</tr>
														</thead>
														<tbody>
															{headerPairs.map(([key, val]) => (
																<tr key={key}>
																	<td className="header-key">{key}</td>
																	<td className="header-val">{val}</td>
																</tr>
															))}
														</tbody>
													</table>
												) : (
													<div className="headers-empty">
														{t("apiTester.noHeaders")}
													</div>
												);
											})()}
										</div>
									</div>
								);
							})()}
						</div>
					</div>
				) : (
					<div className="drawer-content empty">
						{t("apiTester.sendToDebug")}
					</div>
				)}
			</div>
		</>
	);
}
