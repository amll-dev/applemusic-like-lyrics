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

export class Spring {
	private currentPosition = 0;
	private targetPosition = 0;
	private currentTime: Seconds = 0;
	private params: Partial<SpringParams> = {};
	private currentSolver: (t: Seconds) => number;
	private getV: (t: Seconds) => number;
	private getV2: (t: Seconds) => number;
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
}

function solveSpring(
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
