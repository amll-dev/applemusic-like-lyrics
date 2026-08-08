export type ScrollInputType = "touch" | "wheel";

export interface ScrollEngineHooks {
	/**
	 * 当滚动偏移量发生变化时高频触发
	 *
	 * @param offset 计算并钳制后的最新滚动偏移量
	 * @param isContinuous 当前是否为连续输入 (触摸或惯性 RAF)
	 *
	 * 一般的使用场景为：
	 * * 若是连续输入，上层应绕过弹簧动画效果直接照着偏移量重新布局；
	 * * 若是低频离散步进 (如滚轮)，则上层应保留弹簧效果以便在离散步进之间展示平滑的动画
	 */
	onScrollUpdate: (offset: number, isContinuous: boolean) => void;

	/**
	 * 用户明确产生滑动意图 (手指触摸超过 10px) 或使用滚轮时触发
	 *
	 * 一般在此暂停模糊效果、暂停自动跟随等
	 */
	onInteractionStart: (type: ScrollInputType) => void;

	/**
	 * 手指松开且惯性滚动完全停止时触发
	 *
	 * 一般用于标记交互停止
	 */
	onInteractionEnd: () => void;

	/**
	 * 物理静止后，5秒定时器到期时触发
	 *
	 * 一般在此执行重置操作 (如 resetScroll) 并恢复自动排版
	 */
	onAutoAlignResume: () => void;
}

export class ScrollInteractionEngine {
	private offset: number = 0;

	private minOffset: number = 0;
	private maxOffset: number = 0;

	private touchState = {
		startY: 0,
		startX: 0,
		lastY: 0,
		startOffset: 0,
		speed: 0,
		startTime: 0,
		/**
		 * 是否已经突破 10px 意图阈值
		 */
		isIntentConfirmed: false,
	};

	/**
	 * 记录 Touch 开始时被打断的既有状态
	 */
	private interruptedState = {
		hadInertia: false,
		hadTimer: false,
		wasInteracting: false,
	};

	private inertiaRafId: number = 0;
	private scrolledTimeoutId: number = 0;
	private isInteracting: boolean = false;
	private wheelEndTimeoutId: number = 0;

	private abortController = new AbortController();

	constructor(
		private container: HTMLElement,
		private hooks: ScrollEngineHooks,
	) {
		const signal = this.abortController.signal;

		this.container.addEventListener("touchstart", this.onTouchStart, {
			passive: false,
			signal,
		});
		this.container.addEventListener("touchmove", this.onTouchMove, {
			passive: false,
			signal,
		});
		this.container.addEventListener("touchend", this.onTouchEnd, {
			passive: false,
			signal,
		});
		this.container.addEventListener("touchcancel", this.onTouchCancel, {
			passive: false,
			signal,
		});
		this.container.addEventListener("wheel", this.onWheel, {
			passive: false,
			signal,
		});
	}

	//#region 生命周期控制
	private startInteraction(type: ScrollInputType): void {
		if (!this.isInteracting) {
			this.isInteracting = true;
			this.hooks.onInteractionStart(type);
		}
	}

	private endInteractionAndStartTimer(): void {
		if (this.isInteracting) {
			this.isInteracting = false;
			this.hooks.onInteractionEnd();
		}

		this.clearTimers();

		this.scrolledTimeoutId = window.setTimeout(() => {
			this.scrolledTimeoutId = 0;
			this.hooks.onAutoAlignResume();
		}, 5000);
	}
	//#endregion

	//#region 原生事件绑定
	private onTouchStart = (evt: TouchEvent) => {
		// 如果已经有手指在屏幕上，仅将基准点重锚定到最新的第一根手指，不重置交互状态
		if (evt.touches.length > 1) {
			const touch = evt.touches[0];
			const state = this.touchState;
			state.startY = touch.screenY;
			state.startX = touch.screenX;
			state.lastY = touch.screenY;
			state.startOffset = this.offset;
			state.startTime = Date.now();
			state.speed = 0;
			return;
		}

		this.interruptedState.hadInertia = this.inertiaRafId !== 0;
		this.interruptedState.hadTimer =
			this.scrolledTimeoutId !== 0 || this.wheelEndTimeoutId !== 0;
		this.interruptedState.wasInteracting = this.isInteracting;

		this.clearTimers();

		const touch = evt.touches[0];
		const state = this.touchState;

		state.startY = touch.screenY;
		state.startX = touch.screenX;
		state.lastY = touch.screenY;
		state.startOffset = this.offset;
		state.startTime = Date.now();
		state.speed = 0;
		state.isIntentConfirmed = false;
	};

	private onTouchMove = (evt: TouchEvent) => {
		const touch = evt.touches[0];
		const state = this.touchState;

		const deltaY = touch.screenY - state.startY;
		const deltaX = touch.screenX - state.startX;

		if (!state.isIntentConfirmed) {
			// 手指移动超过 10px，认为是滑动
			if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
				state.isIntentConfirmed = true;
				this.startInteraction("touch");
			} else {
				return;
			}
		}

		if (evt.cancelable) {
			evt.preventDefault();
		}

		const currentY = touch.screenY;
		this.offset = this.clampOffset(
			state.startOffset - (currentY - state.startY),
		);

		const now = Date.now();
		const dt = now - state.startTime;
		if (dt > 0) {
			state.speed = (currentY - state.lastY) / dt;
		}

		state.lastY = currentY;
		state.startTime = now;

		this.hooks.onScrollUpdate(this.offset, true);
	};

	private onTouchCancel = (_evt: TouchEvent) => {
		const state = this.touchState;

		if (!state.isIntentConfirmed) {
			const { hadInertia, hadTimer, wasInteracting } = this.interruptedState;

			if (hadInertia || hadTimer || wasInteracting) {
				this.endInteractionAndStartTimer();
			}

			return;
		}

		state.speed = 0;
		state.startY = 0;

		this.endInteractionAndStartTimer();
	};

	private onTouchEnd = (evt: TouchEvent) => {
		const state = this.touchState;

		// 如果屏幕上还有其他手指（例如抬起了双指中的第一根），将基准点重锚定到剩余的手指，
		// 让用户可以用剩下的手指继续平滑拖拽，暂不触发惯性动画
		if (evt.touches.length > 0) {
			const remainingTouch = evt.touches[0];
			state.startY = remainingTouch.screenY;
			state.startX = remainingTouch.screenX;
			state.lastY = remainingTouch.screenY;
			state.startOffset = this.offset;
			state.startTime = Date.now();
			state.speed = 0;
			return;
		}

		if (!state.isIntentConfirmed) {
			const { hadInertia, hadTimer, wasInteracting } = this.interruptedState;

			if (hadInertia || hadTimer || wasInteracting) {
				this.endInteractionAndStartTimer();
			}

			return;
		}

		state.isIntentConfirmed = false;

		if (evt.cancelable) {
			evt.preventDefault();
		}
		state.startY = 0;

		if (this.inertiaRafId) {
			cancelAnimationFrame(this.inertiaRafId);
			this.inertiaRafId = 0;
		}

		if (Math.abs(state.speed) < 0.1) {
			state.speed = 0;
		}

		if (Math.abs(state.speed) > 0.05) {
			let lastFrameTime = performance.now();

			const onScrollFrame = (time: number) => {
				const dt = time - lastFrameTime;
				lastFrameTime = time;

				if (dt <= 0 || dt > 100) {
					this.inertiaRafId = requestAnimationFrame(onScrollFrame);
					return;
				}

				if (Math.abs(state.speed) > 0.05) {
					this.offset -= state.speed * dt;
					this.offset = this.clampOffset(this.offset);

					state.speed *= 0.95 ** (dt / 16);

					this.hooks.onScrollUpdate(this.offset, true);
					this.inertiaRafId = requestAnimationFrame(onScrollFrame);
				} else {
					this.inertiaRafId = 0;
					this.endInteractionAndStartTimer();
				}
			};

			this.inertiaRafId = requestAnimationFrame(onScrollFrame);
		} else {
			this.endInteractionAndStartTimer();
		}
	};

	private onWheel = (evt: WheelEvent) => {
		this.clearTimers();
		this.startInteraction("wheel");

		if (evt.cancelable) {
			evt.preventDefault();
		}

		if (evt.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
			this.offset += evt.deltaY;
		} else {
			this.offset += evt.deltaY * 50;
		}

		this.offset = this.clampOffset(this.offset);
		this.hooks.onScrollUpdate(this.offset, false);

		this.wheelEndTimeoutId = window.setTimeout(() => {
			this.wheelEndTimeoutId = 0;
			this.endInteractionAndStartTimer();
		}, 150);
	};
	//#endregion

	//#region 工具
	/**
	 * 将给定的偏移量限制在当前的 [minOffset, maxOffset] 边界内
	 */
	private clampOffset(val: number): number {
		const min = Math.min(this.minOffset, this.maxOffset);
		const max = Math.max(this.minOffset, this.maxOffset);
		return Math.min(Math.max(val, min), max);
	}
	//#endregion

	//#region 外部干预逻辑
	/**
	 * 更新允许的滚动边界，并返回钳制后的实际 offset
	 *
	 * @description
	 * 在歌词发生排版变化，如页面 `resize`、加载了新歌词、展开背景歌词、歌词行高度改变时，
	 * 计算出当前视口内允许滚动的上限与下限，通过此方法传给滚动引擎以确保滚动不会越界
	 */
	public updateBoundary(min: number, max: number): number {
		this.minOffset = Math.min(0, min);
		this.maxOffset = Math.max(0, max);

		this.offset = this.clampOffset(this.offset);
		return this.offset;
	}

	/**
	 * 覆盖当前的滚动偏移量并终止正在进行的惯性动画或等待状态
	 *
	 * @description
	 * 当需要清空全部用户手势带来的临时滚动状态时，例如，用户点击了某行歌词触发了
	 * Seek、歌曲切歌、或者 5 秒倒计时到期恢复自动对齐时，调用此方法重置滚动引擎
	 */
	public resetScroll(targetOffset: number = 0): void {
		this.clearTimers();

		this.isInteracting = false;
		this.touchState.isIntentConfirmed = false;
		this.touchState.speed = 0;
		this.touchState.startY = 0;
		this.touchState.lastY = 0;
		this.touchState.startTime = 0;

		this.offset = this.clampOffset(targetOffset);
	}
	//#endregion

	//#region 清理
	private clearTimers(): void {
		if (this.inertiaRafId) {
			cancelAnimationFrame(this.inertiaRafId);
			this.inertiaRafId = 0;
		}
		if (this.scrolledTimeoutId) {
			clearTimeout(this.scrolledTimeoutId);
			this.scrolledTimeoutId = 0;
		}
		if (this.wheelEndTimeoutId) {
			window.clearTimeout(this.wheelEndTimeoutId);
			this.wheelEndTimeoutId = 0;
		}
	}

	public dispose(): void {
		this.abortController.abort();
		this.clearTimers();
	}
	//#endregion
}
