import { getVelocity } from "./derivative.ts";
import { Duration } from "./time.ts";

/** MIT License github.com/pushkine/ */
export interface SpringParams {
	mass: number; // = 1.0
	damping: number; // = 10.0
	stiffness: number; // = 100.0
	soft: boolean; // = false
}

type Seconds = number;

/**
 * 弹簧输出的样式目标
 *
 * 描述弹簧的位置应该如何反映到元素上，由具体实现决定何时以及如何写入样式
 */
export interface SpringStyleTarget {
	/** 样式需要被写入的元素 */
	element: HTMLElement;
	/**
	 * 将弹簧当前位置映射为 CSS 声明
	 * @param position 弹簧当前位置
	 * @returns 键为驼峰式 CSS 属性名的声明集合
	 */
	frame(position: number): Record<string, string>;
}

export class Spring {
	protected currentPosition: number = 0;
	protected targetPosition: number = 0;
	protected currentTime: number = 0;
	protected params: Partial<SpringParams> = {};
	protected currentSolver: (t: number) => number;
	protected getV: (t: number) => number;
	protected getV2: (t: number) => number;
	private queueParams:
		| (Partial<SpringParams> & {
				time: Seconds;
		  })
		| undefined;
	private queuePosition:
		| {
				time: Seconds;
				position: number;
		  }
		| undefined;
	constructor(currentPosition = 0) {
		this.targetPosition = currentPosition;
		this.currentPosition = this.targetPosition;
		this.currentSolver = () => this.targetPosition;
		this.getV = () => 0;
		this.getV2 = () => 0;
	}
	private resetSolver() {
		const curV = this.getV(this.currentTime);
		this.currentTime = 0;
		this.currentSolver = solveSpring(
			this.currentPosition,
			curV,
			this.targetPosition,
			0,
			this.params,
		);
		this.getV = getVelocity(this.currentSolver);
		this.getV2 = getVelocity(this.getV);
	}
	arrived(): boolean {
		return (
			Math.abs(this.targetPosition - this.currentPosition) < 0.01 &&
			Math.abs(this.getV(this.currentTime)) < 0.01 &&
			Math.abs(this.getV2(this.currentTime)) < 0.01 &&
			this.queueParams === undefined &&
			this.queuePosition === undefined
		);
	}
	setPosition(targetPosition: number): void {
		this.targetPosition = targetPosition;
		this.currentPosition = targetPosition;
		this.currentSolver = () => this.targetPosition;
		this.getV = () => 0;
		this.getV2 = () => 0;
	}
	update(delta: Duration = Duration.ZERO): void {
		const dt = Duration.asSecsF64(delta);
		this.currentTime += dt;
		this.currentPosition = this.currentSolver(this.currentTime);
		if (this.queueParams) {
			this.queueParams.time -= dt;
			if (this.queueParams.time <= 0) {
				this.updateParams({
					...this.queueParams,
				});
			}
		}
		if (this.queuePosition) {
			this.queuePosition.time -= dt;
			if (this.queuePosition.time <= 0) {
				this.setTargetPosition(this.queuePosition.position);
			}
		}
		if (this.arrived()) {
			this.setPosition(this.targetPosition);
		}
	}
	updateParams(
		params: Partial<SpringParams>,
		delay: Duration = Duration.ZERO,
	): void {
		const delaySecs = Duration.asSecsF64(delay);
		if (delaySecs > 0) {
			this.queueParams = {
				...(this.queuePosition ?? {}),
				...params,
				time: delaySecs,
			};
		} else {
			this.queuePosition = undefined;
			this.params = {
				...this.params,
				...params,
			};
			this.resetSolver();
		}
	}
	setTargetPosition(
		targetPosition: number,
		delay: Duration = Duration.ZERO,
	): void {
		const delaySecs = Duration.asSecsF64(delay);
		if (
			delaySecs <= 0 &&
			Math.abs(this.targetPosition - targetPosition) < 0.001
		) {
			this.queuePosition = undefined;
			return;
		}

		if (delaySecs > 0) {
			this.queuePosition = {
				...(this.queuePosition ?? {}),
				position: targetPosition,
				time: delaySecs,
			};
		} else {
			this.queuePosition = undefined;
			this.targetPosition = targetPosition;
			this.resetSolver();
		}
	}
	getCurrentPosition(): number {
		return this.currentPosition;
	}

	/**
	 * 是否由弹簧自身负责把位置写入元素样式
	 *
	 * 逐帧实现始终由调用方负责写入，因此恒为 `false`
	 */
	get managesStyle(): boolean {
		return false;
	}

	/**
	 * 绑定或解绑弹簧的样式目标，对于需要逐帧应用样式的 DOM 操作
	 *
	 * 可以通过这个函数来注册每帧需要调用的回调函数，然后由开发者自行处理样式计算
	 */
	attach(_target: SpringStyleTarget | undefined): void {}

	/**
	 * 强制按当前状态重新生成样式输出
	 *
	 * 一般用于样式映射所依赖的外部量变化时，逐帧实现为空实现
	 */
	refresh(): void {}
}

export function solveSpring(
	from: number,
	velocity: number,
	to: number,
	delay: Seconds = 0,
	params?: Partial<SpringParams>,
): (t: Seconds) => number {
	const soft = params?.soft ?? false;
	const stiffness = params?.stiffness ?? 100;
	const damping = params?.damping ?? 10;
	const mass = params?.mass ?? 1;
	const delta = to - from;
	if (soft || 1.0 <= damping / (2.0 * Math.sqrt(stiffness * mass))) {
		const angular_frequency = -Math.sqrt(stiffness / mass);
		const leftover = -angular_frequency * delta - velocity;
		return (t: Seconds) => {
			t -= delay;
			if (t < 0) return from;
			return to - (delta + t * leftover) * Math.E ** (t * angular_frequency);
		};
	}
	const damping_frequency = Math.sqrt(4.0 * mass * stiffness - damping ** 2.0);
	const leftover =
		(damping * delta - 2.0 * mass * velocity) / damping_frequency;
	const dfm = (0.5 * damping_frequency) / mass;
	const dm = -(0.5 * damping) / mass;
	return (t: Seconds) => {
		t -= delay;
		if (t < 0) return from;
		return (
			to -
			(Math.cos(t * dfm) * delta + Math.sin(t * dfm) * leftover) *
				Math.E ** (t * dm)
		);
	};
}
