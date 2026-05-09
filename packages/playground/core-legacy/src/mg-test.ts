/**
 * @fileoverview
 * 调试 MG 渲染器的测试脚本
 *
 * @author SteveXMH
 */
import GUI from "lil-gui";
import Stats from "stats.js";
import { MeshGradientRenderer } from "@applemusic-like-lyrics/core";

const debugValues = {
	image: new URL(location.href).searchParams.get("image") || "",
	controlPointSize: 4,
	subdivideDepth: 15,
	wireFrame: false,
};

const canvas = document.getElementById("bg")! as HTMLCanvasElement;
const mgRenderer = new MeshGradientRenderer(canvas);
mgRenderer.setManualControl(true);
mgRenderer.setRenderScale(1);
mgRenderer.setFPS(Number.POSITIVE_INFINITY);

function updateControlPointDraggers() {
	for (const el of document.querySelectorAll(".dragger")) {
		const x = Number.parseInt(el.getAttribute("x") ?? "", 10);
		const y = Number.parseInt(el.getAttribute("y") ?? "", 10);
		const point = mgRenderer.getControlPoint(x, y);
		if (point === undefined) return;
		const px = (point.location.x + 1) * 50;
		const py = (1 - point.location.y) * 50;
		(el as HTMLElement).style.left = `${px}%`;
		(el as HTMLElement).style.top = `${py}%`;

		// Update handles
		const uHandle = el.querySelector(".u-handle") as HTMLElement;
		const uLine = el.querySelector(".u-line") as HTMLElement;
		if (uHandle && uLine) {
			const uLen = point.uScale * 50;
			const uAngle = -point.uRot;
			uHandle.style.left = `${10 + Math.cos(uAngle) * uLen}px`;
			uHandle.style.top = `${10 + Math.sin(uAngle) * uLen}px`;
			uLine.style.width = `${uLen}px`;
			uLine.style.transform = `rotate(${uAngle}rad)`;
			uLine.style.left = "10px";
			uLine.style.top = "10px";
		}

		const vHandle = el.querySelector(".v-handle") as HTMLElement;
		const vLine = el.querySelector(".v-line") as HTMLElement;
		if (vHandle && vLine) {
			const vLen = point.vScale * 50;
			// vRot is relative to vertical axis (PI/2) in WebGL
			const vAngle = -(point.vRot + Math.PI / 2);
			vHandle.style.left = `${10 + Math.cos(vAngle) * vLen}px`;
			vHandle.style.top = `${10 + Math.sin(vAngle) * vLen}px`;
			vLine.style.width = `${vLen}px`;
			vLine.style.transform = `rotate(${vAngle}rad)`;
			vLine.style.left = "10px";
			vLine.style.top = "10px";
		}
	}
}

let draggerGui: GUI | undefined;
function setActiveDragger(x: number, y: number) {
	if (draggerGui) {
		draggerGui.destroy();
		draggerGui = undefined;
	}
	const point = mgRenderer.getControlPoint(x, y);
	if (point) {
		draggerGui = gui.addFolder(`控制点 (${x}, ${y})`);
		const obj = {
			uAngle: (point.uRot * 180) / Math.PI,
			vAngle: (point.vRot * 180) / Math.PI,
			uScale: point.uScale,
			vScale: point.vScale,
		};
		draggerGui
			.add(obj, "uAngle", -180, 180)
			.name("横向扭曲角度")
			.onChange((v: number) => {
				point.uRot = (v * Math.PI) / 180;
				updateControlPointDraggers();
				updateResult();
			});
		draggerGui
			.add(obj, "vAngle", -180, 180)
			.name("纵向扭曲角度")
			.onChange((v: number) => {
				point.vRot = (v * Math.PI) / 180;
				updateControlPointDraggers();
				updateResult();
			});
		draggerGui
			.add(obj, "uScale", 0.1, 10)
			.name("横向缩放")
			.onChange((v: number) => {
				point.uScale = v;
				updateControlPointDraggers();
				updateResult();
			});
		draggerGui
			.add(obj, "vScale", 0.1, 10)
			.name("纵向缩放")
			.onChange((v: number) => {
				point.vScale = v;
				updateControlPointDraggers();
				updateResult();
			});
	}
}

window.addEventListener("resize", updateControlPointDraggers);

const resultTextArea = document.getElementById(
	"result",
)! as HTMLTextAreaElement;
resultTextArea.value = "// 控制点的设置代码将会在这里显示";
function updateResult() {
	const result = [
		`preset(${debugValues.controlPointSize}, ${debugValues.controlPointSize}, [`,
	];
	for (let y = 0; y < debugValues.controlPointSize; y++) {
		for (let x = 0; x < debugValues.controlPointSize; x++) {
			const point = mgRenderer.getControlPoint(x, y);
			if (point === undefined) continue;

			const px = Number(point.location.x.toFixed(4));
			const py = Number(point.location.y.toFixed(4));
			const ur = Number(point.uRot.toFixed(4));
			const vr = Number(point.vRot.toFixed(4));
			const up = Number(point.uScale.toFixed(4));
			const vp = Number(point.vScale.toFixed(4));

			let pStr = `	p(${x}, ${y}, ${px}, ${py}`;
			if (ur !== 0 || vr !== 0 || up !== 1 || vp !== 1) {
				pStr += `, ${ur}, ${vr}`;
				if (up !== 1 || vp !== 1) {
					pStr += `, ${up}, ${vp}`;
				}
			}
			pStr += `),`;
			result.push(pStr);
		}
	}
	result.push("]),");
	resultTextArea.value = result.join("\n");
}

function resizeControlPoint() {
	document.querySelectorAll(".dragger").forEach((el) => {
		el.parentElement?.removeChild(el);
	});
	mgRenderer.resizeControlPoints(
		debugValues.controlPointSize,
		debugValues.controlPointSize,
	);
	mgRenderer.resetSubdivition(debugValues.subdivideDepth);

	for (let y = 0; y < debugValues.controlPointSize; y++) {
		for (let x = 0; x < debugValues.controlPointSize; x++) {
			const point = mgRenderer.getControlPoint(x, y);
			if (point === undefined) continue;
			const dragger = document.createElement("div");
			const draggerInput = document.createElement("input");
			draggerInput.type = "color";
			draggerInput.style.position = "absolute";
			draggerInput.style.visibility = "hidden";
			dragger.appendChild(draggerInput);
			dragger.setAttribute("x", `${x}`);
			dragger.setAttribute("y", `${y}`);
			dragger.className = "dragger";
			dragger.style.left = `${(x * 100) / (debugValues.controlPointSize - 1)}%`;
			dragger.style.top = `${
				((debugValues.controlPointSize - y - 1) * 100) /
				(debugValues.controlPointSize - 1)
			}%`;

			// Add U/V handles
			const uLine = document.createElement("div");
			uLine.className = "dragger-line u-line";
			const uHandle = document.createElement("div");
			uHandle.className = "dragger-handle u-handle";
			uHandle.style.backgroundColor = "#f44";

			const vLine = document.createElement("div");
			vLine.className = "dragger-line v-line";
			const vHandle = document.createElement("div");
			vHandle.className = "dragger-handle v-handle";
			vHandle.style.backgroundColor = "#4f4";

			dragger.appendChild(uLine);
			dragger.appendChild(uHandle);
			dragger.appendChild(vLine);
			dragger.appendChild(vHandle);

			// Handle U dragging
			uHandle.addEventListener("mousedown", (evt) => {
				if (point === undefined) return;
				evt.stopPropagation();
				const rect = dragger.getBoundingClientRect();
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;

				function onMouseMove(e: MouseEvent) {
					if (point === undefined) return;
					const dx = e.clientX - centerX;
					const dy = e.clientY - centerY;
					const dist = Math.sqrt(dx * dx + dy * dy);

					const isCorner =
						(x === 0 || x === debugValues.controlPointSize - 1) &&
						(y === 0 || y === debugValues.controlPointSize - 1);
					const isEdge =
						x === 0 ||
						x === debugValues.controlPointSize - 1 ||
						y === 0 ||
						y === debugValues.controlPointSize - 1;

					if (!isCorner) {
						if (isEdge) {
							// For edge points, only allow scaling, keep rotation at 0
							point.uRot = 0;
						} else {
							point.uRot = Math.atan2(-dy, dx);
						}
					}
					point.uScale = Math.max(0.1, dist / 50);

					updateControlPointDraggers();
					updateResult();
					if (draggerGui) {
						draggerGui.controllersRecursive().forEach((c) => {
							c.updateDisplay();
						});
					}
				}
				function onMouseUp() {
					window.removeEventListener("mousemove", onMouseMove);
					window.removeEventListener("mouseup", onMouseUp);
				}
				window.addEventListener("mousemove", onMouseMove);
				window.addEventListener("mouseup", onMouseUp);
			});

			// Handle V dragging
			vHandle.addEventListener("mousedown", (evt) => {
				if (point === undefined) return;
				evt.stopPropagation();
				const rect = dragger.getBoundingClientRect();
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;

				function onMouseMove(e: MouseEvent) {
					if (point === undefined) return;
					const dx = e.clientX - centerX;
					const dy = e.clientY - centerY;
					const dist = Math.sqrt(dx * dx + dy * dy);

					const isCorner =
						(x === 0 || x === debugValues.controlPointSize - 1) &&
						(y === 0 || y === debugValues.controlPointSize - 1);
					const isEdge =
						x === 0 ||
						x === debugValues.controlPointSize - 1 ||
						y === 0 ||
						y === debugValues.controlPointSize - 1;

					if (!isCorner) {
						if (isEdge) {
							// For edge points, only allow scaling, keep rotation at 0
							point.vRot = 0;
						} else {
							// vRot is relative to vertical axis
							point.vRot = Math.atan2(-dy, dx) - Math.PI / 2;
						}
					}
					point.vScale = Math.max(0.1, dist / 50);

					updateControlPointDraggers();
					updateResult();
					if (draggerGui) {
						draggerGui.controllersRecursive().forEach((c) => {
							c.updateDisplay();
						});
					}
				}
				function onMouseUp() {
					window.removeEventListener("mousemove", onMouseMove);
					window.removeEventListener("mouseup", onMouseUp);
				}
				window.addEventListener("mousemove", onMouseMove);
				window.addEventListener("mouseup", onMouseUp);
			});

			draggerInput.addEventListener("input", () => {
				// mgRenderer.getControlPoint(x, y).color = dragger.value;
				const c = draggerInput.value;
				console.log(c);
				dragger.style.backgroundColor = c;
				const color = c.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
				if (color) {
					point.color.r = Number.parseInt(color[1], 16) / 255;
					point.color.g = Number.parseInt(color[2], 16) / 255;
					point.color.b = Number.parseInt(color[3], 16) / 255;
					dragger.setAttribute("r", `${point.color.r}`);
					dragger.setAttribute("g", `${point.color.g}`);
					dragger.setAttribute("b", `${point.color.b}`);
					updateResult();
				}
			});
			let dragging = false;
			dragger.addEventListener("mousedown", (evt) => {
				evt.stopPropagation();
				const isCorner =
					(x === 0 || x === debugValues.controlPointSize - 1) &&
					(y === 0 || y === debugValues.controlPointSize - 1);

				function onMouseMove(evt: MouseEvent) {
					if (!isCorner) {
						dragger.style.left = `${Math.min(
							window.innerWidth,
							Math.max(0, evt.clientX),
						)}px`;
						dragger.style.top = `${Math.min(
							window.innerHeight,
							Math.max(0, evt.clientY),
						)}px`;
						if (point) {
							point.location.x = Math.max(
								-1,
								Math.min(1, (evt.clientX / window.innerWidth) * 2 - 1),
							);
							point.location.y = Math.max(
								-1,
								Math.min(1, -((evt.clientY / window.innerHeight) * 2 - 1)),
							);
						}
					}
					dragging = true;
					updateControlPointDraggers();
					updateResult();
					evt.stopPropagation();
				}
				function onMouseUp(evt: MouseEvent) {
					if (dragging) {
						dragging = false;
					} else if (dragger.classList.contains("active")) {
						draggerInput.click();
					} else {
						for (const el of document.querySelectorAll(".dragger.active")) {
							el.classList.remove("active");
						}
						dragger.classList.add("active");
						setActiveDragger(x, y);
					}
					window.removeEventListener("mousemove", onMouseMove);
					window.removeEventListener("mouseup", onMouseUp);
					evt.stopPropagation();
				}
				window.addEventListener("mousemove", onMouseMove);
				window.addEventListener("mouseup", onMouseUp);
			});
			document.body.appendChild(dragger);
		}
	}
	updateResult();
}

function subdivide() {
	mgRenderer.resetSubdivition(debugValues.subdivideDepth);
}

function reloadImage() {
	mgRenderer
		.setAlbum(debugValues.image)
		.catch(() =>
			mgRenderer.setAlbum(
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAADUExURf///6fEG8gAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAKSURBVBjTY2AAAAACAAGYY2zXAAAAAElFTkSuQmCC",
			),
		)
		.finally(() => {
			resizeControlPoint();
			updateControlPointDraggers();
			subdivide();
		});
}

reloadImage();

const gui = new GUI();
gui.close();
gui.title("MG Renderer 调试页面");
gui.add(debugValues, "image").name("图片 URL").onFinishChange(reloadImage);
gui
	.add(debugValues, "controlPointSize", 3, 10, 1)
	.name("控制点矩阵大小")
	.onFinishChange(resizeControlPoint);
gui
	.add(debugValues, "subdivideDepth", 2, 50, 1)
	.name("细分深度")
	.onChange(subdivide);
gui
	.add(debugValues, "wireFrame")
	.name("线框模式")
	.onChange((v: boolean) => mgRenderer.setWireFrame(v));

const actions = {
	copyCode: () => {
		navigator.clipboard.writeText(resultTextArea.value).then(() => {
			alert("代码已复制到剪贴板");
		});
	},
	loadCode: () => {
		try {
			const code = resultTextArea.value;
			let loadedPreset: any = null;
			const preset = (width: number, height: number, conf: any[]) => {
				loadedPreset = { width, height, conf };
			};
			const p = (
				cx: number,
				cy: number,
				x: number,
				y: number,
				ur = 0,
				vr = 0,
				up = 1,
				vp = 1,
			) => ({ cx, cy, x, y, ur, vr, up, vp });

			// Remove trailing comma if exists
			const cleanCode = code.trim().replace(/,$/, "");

			const fn = new Function("preset", "p", `return ${cleanCode}`);
			fn(preset, p);

			if (loadedPreset) {
				debugValues.controlPointSize = loadedPreset.width;
				debugValues.controlPointSize = loadedPreset.height;
				gui.controllersRecursive().forEach((c) => {
					c.updateDisplay();
				});

				resizeControlPoint();

				for (const conf of loadedPreset.conf) {
					const point = mgRenderer.getControlPoint(conf.cx, conf.cy);
					if (point) {
						point.location.x = conf.x;
						point.location.y = conf.y;
						point.uRot = conf.ur;
						point.vRot = conf.vr;
						point.uScale = conf.up;
						point.vScale = conf.vp;
					}
				}
				updateControlPointDraggers();
				updateResult();
				alert("预设加载成功");
			}
		} catch (e) {
			alert(`加载失败，请检查代码格式是否正确\n${e}`);
		}
	},
};

gui.add(actions, "copyCode").name("复制预设代码");
gui.add(actions, "loadCode").name("从文本框加载预设");

const stats = new Stats();
stats.showPanel(0);
stats.dom.style.left = "50px";
document.body.appendChild(stats.dom);
const frame = () => {
	stats.end();
	stats.begin();
	requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
