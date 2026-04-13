type seconds = number;

export interface LinearParams {
	duration: number; // Duration of the transition in seconds
}

export class Linear {
	private currentPosition = 0;
	private targetPosition = 0;
	private currentTime = 0;
	private params: Partial<LinearParams> = {};
	private currentSolver: (t: seconds) => number;
	private startTime = 0;
	private queueParams:
		| (Partial<LinearParams> & {
				time: number;
		  })
		| undefined;
	private queuePosition:
		| {
				time: number;
				position: number;
		  }
		| undefined;
	constructor(currentPosition = 0) {
		this.targetPosition = currentPosition;
		this.currentPosition = this.targetPosition;
		this.currentSolver = () => this.targetPosition;
	}
	private resetSolver() {
		this.currentTime = 0;
		this.startTime = 0;
		this.currentSolver = solveLinear(
			this.currentPosition,
			this.targetPosition,
			this.params,
		);
	}
	arrived(): boolean {
		return (
			Math.abs(this.targetPosition - this.currentPosition) < 0.01 &&
			this.queueParams === undefined &&
			this.queuePosition === undefined
		);
	}
	setPosition(targetPosition: number): void {
		this.targetPosition = targetPosition;
		this.currentPosition = targetPosition;
		this.currentSolver = () => this.targetPosition;
	}
	update(delta = 0): void {
		this.currentTime += delta;
		this.currentPosition = this.currentSolver(
			this.currentTime - this.startTime,
		);
		if (this.queueParams) {
			this.queueParams.time -= delta;
			if (this.queueParams.time <= 0) {
				this.updateParams({
					...this.queueParams,
				});
			}
		}
		if (this.queuePosition) {
			this.queuePosition.time -= delta;
			if (this.queuePosition.time <= 0) {
				this.setTargetPosition(this.queuePosition.position);
			}
		}
		if (this.arrived()) {
			this.setPosition(this.targetPosition);
		}
	}
	updateParams(params: Partial<LinearParams>, delay = 0): void {
		if (delay > 0) {
			this.queueParams = {
				...(this.queuePosition ?? {}),
				...params,
				time: delay,
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
	setTargetPosition(targetPosition: number, delay = 0): void {
		if (delay > 0) {
			this.queuePosition = {
				...(this.queuePosition ?? {}),
				position: targetPosition,
				time: delay,
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

function solveLinear(
	from: number,
	to: number,
	params?: Partial<LinearParams>,
): (t: seconds) => number {
	const duration = params?.duration ?? 1;
	const delta = to - from;
	return (t: seconds) => {
		if (t < 0) return from;
		if (t > duration) return to;
		return from + (delta * t) / duration;
	};
}
