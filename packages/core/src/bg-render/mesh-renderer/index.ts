/**
 * @fileoverview
 * 基于 Mesh Gradient 渐变渲染的渲染器
 * 此渲染应该是 Apple Music 使用的背景渲染方式了
 * 参考内容 https://movingparts.io/gradient-meshes
 */

import { Mat4, Vec2, Vec3, Vec4 } from "gl-matrix";
import type { Disposable } from "../../interfaces.ts";
import {
	loadResourceFromElement,
	loadResourceFromUrl,
} from "../../utils/resource.ts";
import { BaseRenderer } from "../base.ts";
import { blurImage } from "../img.ts";
import { generateControlPoints } from "./cp-generate.ts";
import { CONTROL_POINT_PRESETS } from "./cp-presets.ts";
import meshFragShader from "./mesh.frag.glsl?raw";
import meshVertShader from "./mesh.vert.glsl?raw";

const quadVertShader = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_pos * 0.5 + 0.5;
}
`;

const quadFragShader = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_alpha;
void main() {
    vec4 color = texture2D(u_texture, v_uv);
    gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`;

function easeInOutSine(x: number): number {
	return -(Math.cos(Math.PI * x) - 1) / 2;
}

type RenderingContext = WebGLRenderingContext;

class GLProgram implements Disposable {
	private gl: RenderingContext;
	program: WebGLProgram;
	private vertexShader: WebGLShader;
	private fragmentShader: WebGLShader;
	readonly attrs: { [name: string]: number };
	constructor(
		gl: RenderingContext,
		vertexShaderSource: string,
		fragmentShaderSource: string,
		private readonly label = "unknown",
	) {
		this.gl = gl;
		this.vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
		this.fragmentShader = this.createShader(
			gl.FRAGMENT_SHADER,
			fragmentShaderSource,
		);
		this.program = this.createProgram();

		const num = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
		const attrs: { [name: string]: number } = {};
		for (let i = 0; i < num; i++) {
			const info = gl.getActiveAttrib(this.program, i);
			if (!info) continue;
			const location = gl.getAttribLocation(this.program, info.name);
			if (location === -1) continue;
			attrs[info.name] = location;
		}
		this.attrs = attrs;
	}
	private createShader(type: number, source: string) {
		const gl = this.gl;
		const shader = gl.createShader(type);
		if (!shader) throw new Error("Failed to create shader");
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(
				`Failed to compile shader for type ${type} "${
					this.label
				}": ${gl.getShaderInfoLog(shader)}`,
			);
		}
		return shader;
	}
	private createProgram() {
		const gl = this.gl;
		const program = gl.createProgram();
		if (!program) throw new Error("Failed to create program");
		gl.attachShader(program, this.vertexShader);
		gl.attachShader(program, this.fragmentShader);
		gl.linkProgram(program);
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const errLog = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Failed to link program "${this.label}": ${errLog}`);
		}
		return program;
	}
	use() {
		const gl = this.gl;
		gl.useProgram(this.program);
	}
	private notFoundUniforms: Set<string> = new Set();
	private warnUniformNotFound(name: string) {
		if (this.notFoundUniforms.has(name)) return;
		this.notFoundUniforms.add(name);
		console.warn(
			`Failed to get uniform location for program "${this.label}": ${name}`,
		);
	}
	setUniform1f(name: string, value: number) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform1f(location, value);
	}
	setUniform2f(name: string, value1: number, value2: number) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform2f(location, value1, value2);
	}
	setUniform1i(name: string, value: number) {
		const gl = this.gl;
		const location = gl.getUniformLocation(this.program, name);
		if (!location) this.warnUniformNotFound(name);
		else gl.uniform1i(location, value);
	}
	dispose() {
		const gl = this.gl;
		gl.deleteShader(this.vertexShader);
		gl.deleteShader(this.fragmentShader);
		gl.deleteProgram(this.program);
	}
}

class Mesh implements Disposable {
	protected vertexWidth = 0;
	protected vertexHeight = 0;
	private vertexBuffer: WebGLBuffer;
	private indexBuffer: WebGLBuffer;
	private vertexData: Float32Array;
	private indexData: Uint16Array;
	private vertexIndexLength = 0;
	// 调试用途，开启线框模式
	private wireFrame = false;
	constructor(
		private readonly gl: RenderingContext,
		private readonly attrPos: number | undefined,
		private readonly attrColor: number | undefined,
		private readonly attrUV: number | undefined,
	) {
		const vertexBuf = gl.createBuffer();
		if (!vertexBuf) throw new Error("Failed to create vertex buffer");
		this.vertexBuffer = vertexBuf;
		const indexBuf = gl.createBuffer();
		if (!indexBuf) throw new Error("Failed to create index buffer");
		this.indexBuffer = indexBuf;

		this.bind();

		this.vertexData = new Float32Array(0);
		this.indexData = new Uint16Array(0);

		this.resize(2, 2);
		this.update();
	}

	setWireFrame(enable: boolean) {
		this.wireFrame = enable;
		this.resize(this.vertexWidth, this.vertexHeight);
	}

	setVertexPos(vx: number, vy: number, x: number, y: number): void {
		const idx = (vx + vy * this.vertexWidth) * 7;
		if (idx >= this.vertexData.length - 1) {
			console.warn("Vertex position out of range", idx, this.vertexData.length);
			return;
		}
		this.vertexData[idx] = x;
		this.vertexData[idx + 1] = y;
	}

	setVertexColor(
		vx: number,
		vy: number,
		r: number,
		g: number,
		b: number,
	): void {
		const idx = (vx + vy * this.vertexWidth) * 7 + 2;
		if (idx >= this.vertexData.length - 2) {
			console.warn("Vertex color out of range", idx, this.vertexData.length);
			return;
		}
		this.vertexData[idx] = r;
		this.vertexData[idx + 1] = g;
		this.vertexData[idx + 2] = b;
	}

	setVertexUV(vx: number, vy: number, x: number, y: number): void {
		const idx = (vx + vy * this.vertexWidth) * 7 + 5;
		if (idx >= this.vertexData.length - 1) {
			console.warn("Vertex UV out of range", idx, this.vertexData.length);
			return;
		}
		this.vertexData[idx] = x;
		this.vertexData[idx + 1] = y;
	}

	// 批量设置顶点数据的优化方法
	setVertexData(
		vx: number,
		vy: number,
		x: number,
		y: number,
		r: number,
		g: number,
		b: number,
		u: number,
		v: number,
	): void {
		const idx = (vx + vy * this.vertexWidth) * 7;
		if (idx >= this.vertexData.length - 6) {
			console.warn("Vertex data out of range", idx, this.vertexData.length);
			return;
		}
		const data = this.vertexData;
		data[idx] = x;
		data[idx + 1] = y;
		data[idx + 2] = r;
		data[idx + 3] = g;
		data[idx + 4] = b;
		data[idx + 5] = u;
		data[idx + 6] = v;
	}

	getVertexIndexLength(): number {
		return this.vertexIndexLength;
	}

	draw() {
		const gl = this.gl;

		if (this.wireFrame) {
			gl.drawElements(gl.LINES, this.vertexIndexLength, gl.UNSIGNED_SHORT, 0);
		} else {
			gl.drawElements(
				gl.TRIANGLES,
				this.vertexIndexLength,
				gl.UNSIGNED_SHORT,
				0,
			);
		}
	}

	resize(vertexWidth: number, vertexHeight: number): void {
		this.vertexWidth = vertexWidth;
		this.vertexHeight = vertexHeight;
		// 2 个顶点坐标 + 3 个颜色值 + 2 个 UV 坐标
		this.vertexIndexLength = vertexWidth * vertexHeight * 6;
		if (this.wireFrame) {
			this.vertexIndexLength = vertexWidth * vertexHeight * 10;
		}
		const vertexData = new Float32Array(
			vertexWidth * vertexHeight * (2 + 3 + 2),
		);
		const indexData = new Uint16Array(this.vertexIndexLength);
		this.vertexData = vertexData;
		this.indexData = indexData;
		for (let y = 0; y < vertexHeight; y++) {
			for (let x = 0; x < vertexWidth; x++) {
				const px = (x / (vertexWidth - 1)) * 2 - 1;
				const py = (y / (vertexHeight - 1)) * 2 - 1;
				this.setVertexPos(x, y, px || 0, py || 0);
				this.setVertexColor(x, y, 1, 1, 1);
				this.setVertexUV(x, y, x / (vertexWidth - 1), y / (vertexHeight - 1));
			}
		}
		for (let y = 0; y < vertexHeight - 1; y++) {
			for (let x = 0; x < vertexWidth - 1; x++) {
				if (this.wireFrame) {
					const idx = (y * vertexWidth + x) * 10;

					indexData[idx] = y * vertexWidth + x;
					indexData[idx + 1] = y * vertexWidth + x + 1;

					indexData[idx + 2] = y * vertexWidth + x + 1;
					indexData[idx + 3] = (y + 1) * vertexWidth + x;

					indexData[idx + 4] = (y + 1) * vertexWidth + x;
					indexData[idx + 5] = (y + 1) * vertexWidth + x + 1;

					indexData[idx + 6] = (y + 1) * vertexWidth + x + 1;
					indexData[idx + 7] = y * vertexWidth + x + 1;

					indexData[idx + 8] = y * vertexWidth + x;
					indexData[idx + 9] = (y + 1) * vertexWidth + x;
				} else {
					const idx = (y * vertexWidth + x) * 6;
					indexData[idx] = y * vertexWidth + x;
					indexData[idx + 1] = y * vertexWidth + x + 1;
					indexData[idx + 2] = (y + 1) * vertexWidth + x;
					indexData[idx + 3] = y * vertexWidth + x + 1;
					indexData[idx + 4] = (y + 1) * vertexWidth + x + 1;
					indexData[idx + 5] = (y + 1) * vertexWidth + x;
				}
			}
		}
		const gl = this.gl;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
	}

	bind() {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

		if (this.attrPos !== undefined) {
			gl.vertexAttribPointer(this.attrPos, 2, gl.FLOAT, false, 4 * 7, 0);
			gl.enableVertexAttribArray(this.attrPos);
		}
		if (this.attrColor !== undefined) {
			gl.vertexAttribPointer(this.attrColor, 3, gl.FLOAT, false, 4 * 7, 4 * 2);
			gl.enableVertexAttribArray(this.attrColor);
		}
		if (this.attrUV !== undefined) {
			gl.vertexAttribPointer(this.attrUV, 2, gl.FLOAT, false, 4 * 7, 4 * 5);
			gl.enableVertexAttribArray(this.attrUV);
		}
	}

	update() {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.DYNAMIC_DRAW);
	}

	dispose(): void {
		this.gl.deleteBuffer(this.vertexBuffer);
		this.gl.deleteBuffer(this.indexBuffer);
	}
}

class ControlPoint {
	color: Vec3 = Vec3.fromValues(1, 1, 1);
	location: Vec2 = Vec2.fromValues(0, 0);
	uTangent: Vec2 = Vec2.fromValues(0, 0);
	vTangent: Vec2 = Vec2.fromValues(0, 0);
	private _uRot = 0;
	private _vRot = 0;
	private _uScale = 1;
	private _vScale = 1;

	constructor() {
		Object.seal(this);
	}

	get uRot() {
		return this._uRot;
	}

	get vRot() {
		return this._vRot;
	}

	set uRot(value: number) {
		this._uRot = value;
		this.updateUTangent();
	}

	set vRot(value: number) {
		this._vRot = value;
		this.updateVTangent();
	}

	get uScale() {
		return this._uScale;
	}

	get vScale() {
		return this._vScale;
	}

	set uScale(value: number) {
		this._uScale = value;
		this.updateUTangent();
	}

	set vScale(value: number) {
		this._vScale = value;
		this.updateVTangent();
	}

	private updateUTangent() {
		this.uTangent[0] = Math.cos(this._uRot) * this._uScale;
		this.uTangent[1] = Math.sin(this._uRot) * this._uScale;
	}

	private updateVTangent() {
		this.vTangent[0] = -Math.sin(this._vRot) * this._vScale;
		this.vTangent[1] = Math.cos(this._vRot) * this._vScale;
	}
}

const H = Mat4.fromValues(2, -2, 1, 1, -3, 3, -2, -1, 0, 0, 1, 0, 1, 0, 0, 0);
const H_T = Mat4.clone(H).transpose();

function meshCoefficients(
	p00: ControlPoint,
	p01: ControlPoint,
	p10: ControlPoint,
	p11: ControlPoint,
	axis: "x" | "y",
	output = Mat4.create(),
): Mat4 {
	const l = (p: ControlPoint) => p.location[axis];
	const u = (p: ControlPoint) => p.uTangent[axis];
	const v = (p: ControlPoint) => p.vTangent[axis];

	output[0] = l(p00);
	output[1] = l(p01);
	output[2] = v(p00);
	output[3] = v(p01);
	output[4] = l(p10);
	output[5] = l(p11);
	output[6] = v(p10);
	output[7] = v(p11);
	output[8] = u(p00);
	output[9] = u(p01);
	output[10] = 0;
	output[11] = 0;
	output[12] = u(p10);
	output[13] = u(p11);
	output[14] = 0;
	output[15] = 0;

	return output;
}

function colorCoefficients(
	p00: ControlPoint,
	p01: ControlPoint,
	p10: ControlPoint,
	p11: ControlPoint,
	axis: "r" | "g" | "b",
	output = Mat4.create(),
): Mat4 {
	const c = (p: ControlPoint) => p.color[axis];
	output.fill(0);
	output[0] = c(p00);
	output[1] = c(p01);
	output[4] = c(p10);
	output[5] = c(p11);
	// return Mat4.fromValues(
	//     c(p00), c(p01), 0, 0,
	//     c(p10), c(p11), 0, 0,
	//     0, 0, 0, 0,
	//     0, 0, 0, 0,
	// );
	return output;
}

class Map2D<T> {
	private _width = 0;
	private _height = 0;
	private _data: T[] = [];
	constructor(width: number, height: number) {
		this.resize(width, height);
		Object.seal(this);
	}
	resize(width: number, height: number) {
		this._width = width;
		this._height = height;
		this._data = new Array(width * height).fill(0);
	}
	set(x: number, y: number, value: T) {
		this._data[x + y * this._width] = value;
	}
	get(x: number, y: number) {
		return this._data[x + y * this._width];
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
}

// Bicubic Hermite Patch Mesh
class BHPMesh extends Mesh {
	/**
	 * 细分级别，越大曲线越平滑，但是性能消耗也越大
	 */
	private _subDivisions = 10;
	private _controlPoints: Map2D<ControlPoint> = new Map2D(3, 3);

	constructor(
		gl: RenderingContext,
		attrPos: number,
		attrColor: number,
		attrUV: number,
	) {
		super(gl, attrPos, attrColor, attrUV);
		this.resizeControlPoints(3, 3);
		Object.seal(this);
	}
	override setWireFrame(enable: boolean) {
		super.setWireFrame(enable);
		this.updateMesh();
	}
	/**
	 * 以当前的控制点矩阵大小和细分级别为参考重新设置细分级别，此操作不会重设控制点数据
	 * @param subDivisions 细分级别
	 */
	resetSubdivition(subDivisions: number) {
		this._subDivisions = subDivisions;
		super.resize(
			(this._controlPoints.width - 1) * subDivisions,
			(this._controlPoints.height - 1) * subDivisions,
		);
	}
	/**
	 * 重设控制点矩阵尺寸，将会重置所有控制点的颜色和坐标数据
	 * 请在调用此方法后重新设置颜色和坐标，并调用 updateMesh 方法更新网格
	 * @param width 控制点宽度数量，必须大于等于 2
	 * @param height 控制点高度数量，必须大于等于 2
	 */
	resizeControlPoints(width: number, height: number) {
		if (!(width >= 2 && height >= 2)) {
			throw new Error("Control points must be larger than 3x3 or equal");
		}
		this._controlPoints.resize(width, height);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const point = new ControlPoint();
				point.location.x = (x / (width - 1)) * 2 - 1;
				point.location.y = (y / (height - 1)) * 2 - 1;
				point.uTangent.x = 2 / (width - 1);
				point.vTangent.y = 2 / (height - 1);
				this._controlPoints.set(x, y, point);
			}
		}
		this.resetSubdivition(this._subDivisions);
	}
	/**
	 * 获取指定位置的控制点，然后可以设置颜色和坐标属性
	 * 留意颜色属性和坐标属性的值范围均参考 WebGL 的定义
	 * 即颜色各个组件取值 [0-1]，坐标取值 [-1, 1]
	 * 点的位置以画面左下角为原点 (0,0)
	 * @param x 需要获取的控制点的 x 坐标
	 * @param y 需要获取的控制点的 y 坐标
	 * @returns 控制点对象
	 */
	getControlPoint(x: number, y: number) {
		return this._controlPoints.get(x, y);
	}
	// 预分配重复使用的矩阵，避免频繁创建
	private tempX = Mat4.create();
	private tempY = Mat4.create();
	private tempR = Mat4.create();
	private tempG = Mat4.create();
	private tempB = Mat4.create();

	private tempXAcc = Mat4.create();
	private tempYAcc = Mat4.create();
	private tempRAcc = Mat4.create();
	private tempGAcc = Mat4.create();
	private tempBAcc = Mat4.create();

	private tempUx = Vec4.create();
	private tempUy = Vec4.create();
	private tempUr = Vec4.create();
	private tempUg = Vec4.create();
	private tempUb = Vec4.create();

	private precomputeMatrix(M: Mat4, output: Mat4) {
		output.copy(M).transpose();
		Mat4.mul(output, output, H);
		Mat4.mul(output, H_T, output);
		return output;
	}

	/**
	 * 更新最终呈现的网格数据，此方法应在所有控制点或细分参数的操作完成后调用
	 */
	updateMesh() {
		const subDivM1 = this._subDivisions - 1;
		const tW = subDivM1 * (this._controlPoints.height - 1);
		const tH = subDivM1 * (this._controlPoints.width - 1);
		const controlPointsWidth = this._controlPoints.width;
		const controlPointsHeight = this._controlPoints.height;
		const subDivisions = this._subDivisions;

		// 预计算常用值
		const invSubDivM1 = 1 / subDivM1;
		const invTH = 1 / tH;
		const invTW = 1 / tW;

		// 预计算 u 和 v 的幂次
		const normPowers = new Float32Array(subDivisions * 4);
		for (let i = 0; i < subDivisions; i++) {
			const norm = i * invSubDivM1;
			const idx = i * 4;
			normPowers[idx] = norm ** 3;
			normPowers[idx + 1] = norm ** 2;
			normPowers[idx + 2] = norm;
			normPowers[idx + 3] = 1;
		}

		for (let x = 0; x < controlPointsWidth - 1; x++) {
			for (let y = 0; y < controlPointsHeight - 1; y++) {
				const p00 = this._controlPoints.get(x, y);
				const p01 = this._controlPoints.get(x, y + 1);
				const p10 = this._controlPoints.get(x + 1, y);
				const p11 = this._controlPoints.get(x + 1, y + 1);

				// 复用预分配的矩阵
				meshCoefficients(p00, p01, p10, p11, "x", this.tempX);
				meshCoefficients(p00, p01, p10, p11, "y", this.tempY);
				colorCoefficients(p00, p01, p10, p11, "r", this.tempR);
				colorCoefficients(p00, p01, p10, p11, "g", this.tempG);
				colorCoefficients(p00, p01, p10, p11, "b", this.tempB);

				// 预计算累加矩阵
				this.precomputeMatrix(this.tempX, this.tempXAcc);
				this.precomputeMatrix(this.tempY, this.tempYAcc);
				this.precomputeMatrix(this.tempR, this.tempRAcc);
				this.precomputeMatrix(this.tempG, this.tempGAcc);
				this.precomputeMatrix(this.tempB, this.tempBAcc);

				const sX = x / (controlPointsWidth - 1);
				const sY = y / (controlPointsHeight - 1);
				const baseVx = y * subDivisions;
				const baseVy = x * subDivisions;

				for (let u = 0; u < subDivisions; u++) {
					const vxOffset = baseVx + u;
					const uIdx = u * 4;

					this.tempUx[0] = normPowers[uIdx];
					this.tempUx[1] = normPowers[uIdx + 1];
					this.tempUx[2] = normPowers[uIdx + 2];
					this.tempUx[3] = normPowers[uIdx + 3];
					Vec4.transformMat4(this.tempUx, this.tempUx, this.tempXAcc);

					this.tempUy[0] = normPowers[uIdx];
					this.tempUy[1] = normPowers[uIdx + 1];
					this.tempUy[2] = normPowers[uIdx + 2];
					this.tempUy[3] = normPowers[uIdx + 3];
					Vec4.transformMat4(this.tempUy, this.tempUy, this.tempYAcc);

					this.tempUr[0] = normPowers[uIdx];
					this.tempUr[1] = normPowers[uIdx + 1];
					this.tempUr[2] = normPowers[uIdx + 2];
					this.tempUr[3] = normPowers[uIdx + 3];
					Vec4.transformMat4(this.tempUr, this.tempUr, this.tempRAcc);

					this.tempUg[0] = normPowers[uIdx];
					this.tempUg[1] = normPowers[uIdx + 1];
					this.tempUg[2] = normPowers[uIdx + 2];
					this.tempUg[3] = normPowers[uIdx + 3];
					Vec4.transformMat4(this.tempUg, this.tempUg, this.tempGAcc);

					this.tempUb[0] = normPowers[uIdx];
					this.tempUb[1] = normPowers[uIdx + 1];
					this.tempUb[2] = normPowers[uIdx + 2];
					this.tempUb[3] = normPowers[uIdx + 3];
					Vec4.transformMat4(this.tempUb, this.tempUb, this.tempBAcc);

					for (let v = 0; v < subDivisions; v++) {
						const vy = baseVy + v;
						const vIdx = v * 4;

						const v0 = normPowers[vIdx];
						const v1 = normPowers[vIdx + 1];
						const v2 = normPowers[vIdx + 2];
						const v3 = normPowers[vIdx + 3];

						const px =
							v0 * this.tempUx[0] +
							v1 * this.tempUx[1] +
							v2 * this.tempUx[2] +
							v3 * this.tempUx[3];
						const py =
							v0 * this.tempUy[0] +
							v1 * this.tempUy[1] +
							v2 * this.tempUy[2] +
							v3 * this.tempUy[3];
						const pr =
							v0 * this.tempUr[0] +
							v1 * this.tempUr[1] +
							v2 * this.tempUr[2] +
							v3 * this.tempUr[3];
						const pg =
							v0 * this.tempUg[0] +
							v1 * this.tempUg[1] +
							v2 * this.tempUg[2] +
							v3 * this.tempUg[3];
						const pb =
							v0 * this.tempUb[0] +
							v1 * this.tempUb[1] +
							v2 * this.tempUb[2] +
							v3 * this.tempUb[3];

						const uvX = sX + v * invTH;
						const uvY = 1 - sY - u * invTW;

						// 使用批量设置方法减少数组访问次数
						this.setVertexData(vxOffset, vy, px, py, pr, pg, pb, uvX, uvY);
					}
				}
			}
		}
		this.update();
	}
}

class GLTexture implements Disposable {
	readonly tex: WebGLTexture;

	constructor(
		private gl: WebGLRenderingContext,
		albumImageData: ImageData,
	) {
		const albumTexture = gl.createTexture();
		if (!albumTexture) throw new Error("Failed to create texture");
		this.tex = albumTexture;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, albumTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			albumImageData,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
	}

	bind() {
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
	}

	dispose(): void {
		this.gl.deleteTexture(this.tex);
	}
}

function createOffscreenCanvas(width: number, height: number) {
	if ("OffscreenCanvas" in window) return new OffscreenCanvas(width, height);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

interface MeshState {
	mesh: BHPMesh;
	texture: GLTexture;
	alpha: number;
}

export class MeshGradientRenderer extends BaseRenderer {
	private gl: RenderingContext;
	private lastFrameTime = 0;
	private frameTime = 0;
	// private currentImageData?: ImageData;
	private lastTickTime = 0;
	private smoothedVolume = 0;
	private volume = 0;
	private tickHandle = 0;
	private maxFPS = 60;
	private paused = false;
	private staticMode = false;
	private mainProgram: GLProgram;
	private quadProgram: GLProgram;
	private quadBuffer: WebGLBuffer;
	private fbo: WebGLFramebuffer | null = null;
	private fboTexture: WebGLTexture | null = null;
	private manualControl = false;
	private reduceImageSizeCanvas = createOffscreenCanvas(
		32,
		32,
	) as HTMLCanvasElement;
	private targetSize = Vec2.fromValues(0, 0);
	private currentSize = Vec2.fromValues(0, 0);
	private isNoCover = true;
	private meshStates: MeshState[] = [];
	private _disposed = false;
	// 性能监控
	private frameCount = 0;
	private lastFPSUpdate = 0;
	private currentFPS = 0;
	private enablePerformanceMonitoring = false;

	setManualControl(enable: boolean): void {
		this.manualControl = enable;
	}

	setWireFrame(enable: boolean): void {
		for (const state of this.meshStates) {
			state.mesh.setWireFrame(enable);
		}
	}

	getControlPoint(x: number, y: number): ControlPoint | undefined {
		return this.meshStates[this.meshStates.length - 1]?.mesh?.getControlPoint(
			x,
			y,
		);
	}

	resizeControlPoints(width: number, height: number): void {
		this.meshStates[this.meshStates.length - 1]?.mesh?.resizeControlPoints(
			width,
			height,
		);
	}

	resetSubdivition(subDivisions: number): void {
		this.meshStates[this.meshStates.length - 1]?.mesh?.resetSubdivition(
			subDivisions,
		);
	}

	private onTick(tickTime: number) {
		this.tickHandle = 0;
		if (this.paused) return;
		if (this._disposed) return;

		// 更新性能统计
		this.updatePerformanceStats(tickTime);

		const interval = 1000 / this.maxFPS;
		const delta = tickTime - this.lastTickTime;
		if (delta < interval) {
			this.requestTick();
			return;
		}

		if (Number.isNaN(this.lastFrameTime)) {
			this.lastFrameTime = tickTime;
		}
		const frameDelta = tickTime - this.lastFrameTime;
		this.lastFrameTime = tickTime;
		// 减去多余的时间，避免帧率漂移（例如高刷显示器限制低帧率时）
		this.lastTickTime = tickTime - (delta % interval);

		this.frameTime += frameDelta * this.flowSpeed;

		if (!(this.onRedraw(this.frameTime, frameDelta) && this.staticMode)) {
			this.requestTick();
		} else if (this.staticMode) {
			this.lastFrameTime = Number.NaN;
		}
	}

	private checkIfResize() {
		const [tW, tH] = [this.targetSize.x, this.targetSize.y];
		const [cW, cH] = [this.currentSize.x, this.currentSize.y];
		if (tW !== cW || tH !== cH) {
			super.onResize(tW, tH);
			const gl = this.gl;
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, tW, tH);
			this.currentSize.x = tW;
			this.currentSize.y = tH;
			if (tW > 0 && tH > 0) {
				this.updateFBO(tW, tH);
			}
		}
	}

	private updateFBO(width: number, height: number) {
		const gl = this.gl;
		if (this.fbo) gl.deleteFramebuffer(this.fbo);
		if (this.fboTexture) gl.deleteTexture(this.fboTexture);

		this.fboTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			width,
			height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		this.fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.fboTexture,
			0,
		);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	private onRedraw(tickTime: number, delta: number) {
		const latestMeshState = this.meshStates[this.meshStates.length - 1];
		let canBeStatic = false;

		// 预计算常用值
		const deltaFactor = delta / 500;

		if (latestMeshState) {
			latestMeshState.mesh.bind();
			// 考虑到我们并不逐帧更新网格控制点，因此也不需要重复调用 updateMesh
			if (this.manualControl) latestMeshState.mesh.updateMesh();

			if (this.isNoCover) {
				// 批量处理alpha更新，减少循环开销
				let hasActiveStates = false;
				for (let i = this.meshStates.length - 1; i >= 0; i--) {
					const state = this.meshStates[i];
					// 增加一个小的容错范围，避免浮点误差导致的过早删除
					if (state.alpha <= -0.1) {
						// 立即释放资源
						state.mesh.dispose();
						state.texture.dispose();
						this.meshStates.splice(i, 1);
					} else {
						state.alpha = Math.max(-0.1, state.alpha - deltaFactor);
						hasActiveStates = true;
					}
				}
				canBeStatic = !hasActiveStates;
			} else {
				// 同样增加容错范围，允许稍微超过1以确保完全过渡完成
				if (latestMeshState.alpha >= 1.1) {
					// 批量清理旧状态
					const deleted = this.meshStates.splice(0, this.meshStates.length - 1);
					for (const state of deleted) {
						state.mesh.dispose();
						state.texture.dispose();
					}
				} else {
					latestMeshState.alpha = Math.min(
						1.1,
						latestMeshState.alpha + deltaFactor,
					);
				}
				canBeStatic =
					this.meshStates.length === 1 && latestMeshState.alpha >= 1.1;
			}
		}

		const gl = this.gl;
		this.checkIfResize();

		if (!this.fbo) return canBeStatic;

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const lerpFactor = Math.min(1.0, delta / 100.0);
		this.smoothedVolume += (this.volume - this.smoothedVolume) * lerpFactor;

		// 渲染所有网格状态
		for (const state of this.meshStates) {
			// 1. 渲染到 FBO
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
			gl.disable(gl.BLEND);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			this.mainProgram.use();
			gl.activeTexture(gl.TEXTURE0);
			this.mainProgram.setUniform1f("u_time", tickTime / 10000);
			this.mainProgram.setUniform1f(
				"u_aspect",
				this.manualControl ? 1 : this.canvas.width / this.canvas.height,
			);
			this.mainProgram.setUniform1i("u_texture", 0);
			this.mainProgram.setUniform1f("u_volume", this.volume);
			this.mainProgram.setUniform1f("u_alpha", 1.0);

			state.texture.bind();
			state.mesh.bind();
			state.mesh.draw();

			// 2. 渲染 FBO 到屏幕
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(
				gl.SRC_ALPHA,
				gl.ONE_MINUS_SRC_ALPHA,
				gl.ONE,
				gl.ONE_MINUS_SRC_ALPHA,
			);
			this.quadProgram.use();
			this.quadProgram.setUniform1i("u_texture", 0);
			this.quadProgram.setUniform1f(
				"u_alpha",
				easeInOutSine(Math.min(1, Math.max(0, state.alpha))),
			);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
			const a_pos = this.quadProgram.attrs.a_pos;
			gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(a_pos);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			gl.disableVertexAttribArray(a_pos);
		}

		gl.flush();

		return canBeStatic;
	}

	private onTickBinded = this.onTick.bind(this);

	private requestTick() {
		if (this._disposed) return;
		if (this.tickHandle === 0)
			this.tickHandle = requestAnimationFrame(this.onTickBinded);
	}

	// private supportTextureFloat = true;

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);

		const gl = canvas.getContext("webgl", { antialias: true });
		if (!gl) throw new Error("WebGL not supported");
		if (!gl.getExtension("EXT_color_buffer_float"))
			console.warn("EXT_color_buffer_float not supported");
		if (!gl.getExtension("EXT_float_blend")) {
			console.warn("EXT_float_blend not supported");
			// this.supportTextureFloat = false;
		}
		if (!gl.getExtension("OES_texture_float_linear"))
			console.warn("OES_texture_float_linear not supported");
		if (!gl.getExtension("OES_texture_float")) {
			// this.supportTextureFloat = false;
			console.warn("OES_texture_float not supported");
		}

		this.gl = gl;
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(
			gl.SRC_ALPHA,
			gl.ONE_MINUS_SRC_ALPHA,
			gl.ONE,
			gl.ONE_MINUS_SRC_ALPHA,
		);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.ALWAYS);

		this.mainProgram = new GLProgram(
			gl,
			meshVertShader,
			meshFragShader,
			"main-program-mg",
		);

		this.quadProgram = new GLProgram(
			gl,
			quadVertShader,
			quadFragShader,
			"quad-program",
		);
		const quadBuffer = gl.createBuffer();
		if (!quadBuffer) throw new Error("Failed to create quad buffer");
		this.quadBuffer = quadBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);

		this.requestTick();
	}

	protected override onResize(width: number, height: number): void {
		this.targetSize.x = Math.ceil(width);
		this.targetSize.y = Math.ceil(height);
		this.requestTick();
	}

	override setStaticMode(enable: boolean): void {
		this.staticMode = enable;
		this.lastFrameTime = performance.now();
		this.requestTick();
	}
	override setFPS(fps: number): void {
		this.maxFPS = fps;
	}
	override pause(): void {
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this.paused = true;
	}
	override resume(): void {
		this.paused = false;
		this.requestTick();
	}
	override async setAlbum(
		albumSource?: string | HTMLImageElement | HTMLVideoElement,
		isVideo?: boolean,
	): Promise<void> {
		if (
			albumSource === undefined ||
			(typeof albumSource === "string" && albumSource.trim().length === 0)
		) {
			this.isNoCover = true;
			return;
		}
		let res: HTMLImageElement | HTMLVideoElement | null = null;
		let blob: Blob | null = null;
		let remainRetryTimes = 5;
		while (!res && remainRetryTimes > 0) {
			try {
				if (typeof albumSource === "string") {
					if (!isVideo && "createImageBitmap" in window) {
						// 如果支持 createImageBitmap 且是图片，直接 fetch blob
						const response = await fetch(albumSource);
						blob = await response.blob();
						// 仍然需要一个 HTMLImageElement 来获取原始宽高（如果后续需要）
						// 但这里我们主要依赖 blob 来创建 bitmap
						res = await loadResourceFromUrl(URL.createObjectURL(blob), false);
					} else {
						res = await loadResourceFromUrl(albumSource, isVideo);
					}
				} else {
					res = await loadResourceFromElement(albumSource);
				}
			} catch (error) {
				console.warn(
					`failed on loading album resource, retrying (${remainRetryTimes})`,
					{
						albumSource,
						error,
					},
				);
				remainRetryTimes--;
			}
		}
		if (!res) {
			console.error("Failed to load album resource", albumSource);
			this.isNoCover = true;
			return;
		}
		this.isNoCover = false;
		// resize image
		const c = this.reduceImageSizeCanvas;
		const ctx = c.getContext("2d", {
			willReadFrequently: true,
		});
		if (!ctx) throw new Error("Failed to create canvas context");
		ctx.clearRect(0, 0, c.width, c.height);
		// Safari 不支持 filter
		// ctx.filter = baseFilter;
		const imgw =
			res instanceof HTMLVideoElement ? res.videoWidth : res.naturalWidth;
		const imgh =
			res instanceof HTMLVideoElement ? res.videoHeight : res.naturalHeight;
		if (imgw * imgh === 0) throw new Error("Invalid image size");

		let bitmap: ImageBitmap | null = null;
		try {
			if ("createImageBitmap" in window) {
				// 避免在主线程进行同步解码，使用 fetch 获取 blob 后再创建 ImageBitmap
				if (blob) {
					bitmap = await createImageBitmap(blob, {
						resizeWidth: c.width,
						resizeHeight: c.height,
						resizeQuality: "low",
					});
					URL.revokeObjectURL(res.src); // 释放 object URL
				} else {
					bitmap = await createImageBitmap(res, {
						resizeWidth: c.width,
						resizeHeight: c.height,
						resizeQuality: "low",
					});
				}
			}
		} catch (e) {
			console.warn("createImageBitmap failed", e);
		}

		if (bitmap) {
			ctx.drawImage(bitmap, 0, 0);
			bitmap.close();
		} else {
			ctx.drawImage(res, 0, 0, imgw, imgh, 0, 0, c.width, c.height);
		}

		const imageData = ctx.getImageData(0, 0, c.width, c.height);

		// 合并对比度、饱和度、亮度的处理，减少循环次数
		const pixels = imageData.data;
		for (let i = 0; i < pixels.length; i += 4) {
			let r = pixels[i];
			let g = pixels[i + 1];
			let b = pixels[i + 2];

			// contrast 0.4
			r = (r - 128) * 0.4 + 128;
			g = (g - 128) * 0.4 + 128;
			b = (b - 128) * 0.4 + 128;

			// saturate 3.0
			const gray = r * 0.3 + g * 0.59 + b * 0.11;
			r = gray * -2.0 + r * 3.0;
			g = gray * -2.0 + g * 3.0;
			b = gray * -2.0 + b * 3.0;

			// contrast 1.7
			r = (r - 128) * 1.7 + 128;
			g = (g - 128) * 1.7 + 128;
			b = (b - 128) * 1.7 + 128;

			// brightness 0.75
			pixels[i] = r * 0.75;
			pixels[i + 1] = g * 0.75;
			pixels[i + 2] = b * 0.75;
		}

		blurImage(imageData, 2, 4);

		if (this.manualControl && this.meshStates.length > 0) {
			this.meshStates[0].texture.dispose();
			this.meshStates[0].texture = new GLTexture(this.gl, imageData);
		} else {
			const newMesh = new BHPMesh(
				this.gl,
				this.mainProgram.attrs.a_pos,
				this.mainProgram.attrs.a_color,
				this.mainProgram.attrs.a_uv,
			);
			newMesh.resetSubdivition(50);

			const chosenPreset =
				Math.random() > 0.8
					? generateControlPoints(6, 6)
					: CONTROL_POINT_PRESETS[
							Math.floor(Math.random() * CONTROL_POINT_PRESETS.length)
						];

			newMesh.resizeControlPoints(chosenPreset.width, chosenPreset.height);
			const uPower = 2 / (chosenPreset.width - 1);
			const vPower = 2 / (chosenPreset.height - 1);
			for (const cp of chosenPreset.conf) {
				const p = newMesh.getControlPoint(cp.cx, cp.cy);
				p.location.x = cp.x;
				p.location.y = cp.y;
				p.uRot = (cp.ur * Math.PI) / 180;
				p.vRot = (cp.vr * Math.PI) / 180;
				p.uScale = uPower * cp.up;
				p.vScale = vPower * cp.vp;
			}

			newMesh.updateMesh();
			// this.currentImageData = imageData;

			const albumTexture = new GLTexture(this.gl, imageData);
			const newState: MeshState = {
				mesh: newMesh,
				texture: albumTexture,
				alpha: 0,
			};
			this.meshStates.push(newState);
		}

		this.requestTick();
	}
	override setLowFreqVolume(volume: number): void {
		this.volume = volume / 10;
	}
	override setHasLyric(_hasLyric: boolean): void {
		// 不再考虑实现
	}

	override dispose(): void {
		super.dispose();
		if (this.tickHandle) {
			cancelAnimationFrame(this.tickHandle);
			this.tickHandle = 0;
		}
		this._disposed = true;
		this.mainProgram.dispose();
		this.quadProgram.dispose();
		this.gl.deleteBuffer(this.quadBuffer);
		if (this.fbo) this.gl.deleteFramebuffer(this.fbo);
		if (this.fboTexture) this.gl.deleteTexture(this.fboTexture);
		for (const state of this.meshStates) {
			state.mesh.dispose();
			state.texture.dispose();
		}
	}

	enablePerformanceMonitor(enable: boolean): void {
		this.enablePerformanceMonitoring = enable;
		if (enable) {
			this.frameCount = 0;
			this.lastFPSUpdate = performance.now();
		}
	}

	getCurrentFPS(): number {
		return this.currentFPS;
	}

	private updatePerformanceStats(tickTime: number) {
		if (!this.enablePerformanceMonitoring) return;

		this.frameCount++;
		if (tickTime - this.lastFPSUpdate > 1000) {
			this.currentFPS = this.frameCount;
			this.frameCount = 0;
			this.lastFPSUpdate = tickTime;
		}
	}
}
