import type { Disposable } from "../interfaces.ts";

/**
 * 着色器程序可用的渲染上下文。
 *
 * 目前的背景渲染器以 WebGL1 为主，但这个封装本身不依赖特定版本，所以两者
 * 都接受。
 */
export type GLRenderingContext = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * 对 WebGL 着色器程序的一层薄封装，负责编译、链接、缓存 uniform 位置。
 */
export class GLProgram implements Disposable {
	private gl: GLRenderingContext;
	program: WebGLProgram;
	private vertexShader: WebGLShader;
	private fragmentShader: WebGLShader;
	readonly attrs: { [name: string]: number };
	private uniformLocations = new Map<string, WebGLUniformLocation | null>();
	constructor(
		gl: GLRenderingContext,
		vertexShaderSource: string,
		fragmentShaderSource: string,
		private readonly label = "unknown",
	) {
		this.gl = gl;
		const vertexShader = this.createShader(
			gl.VERTEX_SHADER,
			vertexShaderSource,
		);
		let fragmentShader: WebGLShader | undefined;
		try {
			fragmentShader = this.createShader(
				gl.FRAGMENT_SHADER,
				fragmentShaderSource,
			);
			this.program = this.createProgram(vertexShader, fragmentShader);
		} catch (error) {
			gl.deleteShader(vertexShader);
			if (fragmentShader) gl.deleteShader(fragmentShader);
			throw error;
		}
		this.vertexShader = vertexShader;
		this.fragmentShader = fragmentShader;

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
	private createShader(type: number, source: string): WebGLShader {
		const gl = this.gl;
		const shader = gl.createShader(type);
		if (!shader) throw new Error("Failed to create shader");
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const error = new Error(
				`Failed to compile shader for type ${type} "${
					this.label
				}": ${gl.getShaderInfoLog(shader)}`,
			);
			gl.deleteShader(shader);
			throw error;
		}
		return shader;
	}
	private createProgram(
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader,
	): WebGLProgram {
		const gl = this.gl;
		const program = gl.createProgram();
		if (!program) throw new Error("Failed to create program");
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const errLog = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Failed to link program "${this.label}": ${errLog}`);
		}
		return program;
	}
	use(): void {
		const gl = this.gl;
		gl.useProgram(this.program);
	}
	private notFoundUniforms: Set<string> = new Set();
	private warnUniformNotFound(name: string): void {
		if (this.notFoundUniforms.has(name)) return;
		this.notFoundUniforms.add(name);
		console.warn(
			`Failed to get uniform location for program "${this.label}": ${name}`,
		);
	}
	/**
	 * 取 uniform 位置并缓存。逐帧设置几十个 uniform 时，省下的
	 * `getUniformLocation` 调用相当可观。
	 */
	private getUniformLocation(name: string): WebGLUniformLocation | null {
		let location = this.uniformLocations.get(name);
		if (location === undefined) {
			location = this.gl.getUniformLocation(this.program, name);
			this.uniformLocations.set(name, location);
		}
		if (location === null) this.warnUniformNotFound(name);
		return location;
	}
	setUniform1f(name: string, value: number): void {
		const location = this.getUniformLocation(name);
		if (location !== null) this.gl.uniform1f(location, value);
	}
	setUniform2f(name: string, value1: number, value2: number): void {
		const location = this.getUniformLocation(name);
		if (location !== null) this.gl.uniform2f(location, value1, value2);
	}
	setUniform3f(
		name: string,
		value1: number,
		value2: number,
		value3: number,
	): void {
		const location = this.getUniformLocation(name);
		if (location !== null) this.gl.uniform3f(location, value1, value2, value3);
	}
	setUniform4f(
		name: string,
		value1: number,
		value2: number,
		value3: number,
		value4: number,
	): void {
		const location = this.getUniformLocation(name);
		if (location !== null)
			this.gl.uniform4f(location, value1, value2, value3, value4);
	}
	setUniform1i(name: string, value: number): void {
		const location = this.getUniformLocation(name);
		if (location !== null) this.gl.uniform1i(location, value);
	}
	setUniform1fv(name: string, value: Float32Array): void {
		const location = this.getUniformLocation(name);
		if (location !== null) this.gl.uniform1fv(location, value);
	}
	setUniform3fv(name: string, value: Float32Array): void {
		const location = this.getUniformLocation(name);
		if (location !== null) this.gl.uniform3fv(location, value);
	}
	dispose(): void {
		const gl = this.gl;
		gl.deleteShader(this.vertexShader);
		gl.deleteShader(this.fragmentShader);
		gl.deleteProgram(this.program);
		this.uniformLocations.clear();
	}
}
