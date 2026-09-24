// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LineBrightness } from "#lyric/dom/line-brightness.ts";
import styles from "#styles/lyric-player.module.css";

function createFixture() {
	const parent = document.createElement("div");
	const main = document.createElement("div");
	parent.appendChild(main);
	document.body.appendChild(parent);

	const defaultStyleMap: Record<string, Partial<CSSStyleDeclaration>> = {
		parent: {
			paddingTop: "10px",
			paddingLeft: "15px",
			paddingRight: "20px",
		},
		main: {
			marginTop: "5px",
			marginLeft: "10px",
			marginRight: "15px",
		},
	};

	vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
		if (element === parent) {
			return (defaultStyleMap.parent ?? {}) as CSSStyleDeclaration;
		}
		if (element === main) {
			return (defaultStyleMap.main ?? {}) as CSSStyleDeclaration;
		}
		return {} as CSSStyleDeclaration;
	});

	return { parent, main, defaultStyleMap };
}

describe("LineBrightness", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("Geometry & Positioning", () => {
		it("calculates border-box offsets by summing parent padding and main margin", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();

			expect(brightness.isReady).toBe(true);
			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;
			expect(dim).toBeTruthy();

			// top = paddingTop(10) + marginTop(5) = 15px
			// left = paddingLeft(15) + marginLeft(10) = 25px
			// right = paddingRight(20) + marginRight(15) = 35px
			expect(dim.style.top).toBe("15px");
			expect(dim.style.left).toBe("25px");
			expect(dim.style.right).toBe("35px");
		});

		it("fails gracefully and does not build copy when parent is missing", () => {
			const orphanMain = document.createElement("div");
			const brightness = new LineBrightness(orphanMain);

			brightness.rebuild();

			expect(brightness.isReady).toBe(false);
			expect(orphanMain.classList.contains(styles.lyricMainLineBright)).toBe(
				false,
			);
		});

		it("fails gracefully when computed styles do not have valid px values", () => {
			const { main } = createFixture();
			vi.spyOn(window, "getComputedStyle").mockReturnValue({
				paddingTop: "auto",
				paddingLeft: "10px",
				paddingRight: "10px",
				marginTop: "0px",
				marginLeft: "0px",
				marginRight: "0px",
			} as unknown as CSSStyleDeclaration);

			const brightness = new LineBrightness(main);
			brightness.rebuild();

			expect(brightness.isReady).toBe(false);
		});

		it("updates existing dim element coordinates when captureGeometry is called", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;
			expect(dim.style.top).toBe("15px");

			// 模拟视口或字体变化导致的新样式
			vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
				if (element === parent) {
					return {
						paddingTop: "30px",
						paddingLeft: "40px",
						paddingRight: "50px",
					} as CSSStyleDeclaration;
				}
				return {
					marginTop: "2px",
					marginLeft: "4px",
					marginRight: "6px",
				} as CSSStyleDeclaration;
			});

			brightness.captureGeometry();

			expect(dim.style.top).toBe("32px");
			expect(dim.style.left).toBe("44px");
			expect(dim.style.right).toBe("56px");
		});
	});

	describe("DOM Cloning & Mask Cleansing", () => {
		it("sets accessibility and inert attributes on cloned dim element", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;
			expect(dim).toBeTruthy();
			expect(dim.getAttribute("aria-hidden")).toBe("true");
			expect(dim.inert).toBe(true);
		});

		it("removes mask styles from all cloned nodes in the dim copy", () => {
			const { main, parent } = createFixture();
			const wordSpan = document.createElement("span");
			wordSpan.style.setProperty("mask", "linear-gradient(red, blue)");
			wordSpan.style.setProperty("-webkit-mask", "linear-gradient(red, blue)");
			main.appendChild(wordSpan);

			const brightness = new LineBrightness(main);
			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;
			const clonedWord = dim.querySelector("span") as HTMLElement;

			expect(clonedWord).toBeTruthy();
			expect(clonedWord.style.getPropertyValue("mask")).toBe("");
			expect(clonedWord.style.getPropertyValue("-webkit-mask")).toBe("");
		});

		it("removes inherited inline transition suppression on the clone", () => {
			const { main, parent } = createFixture();
			main.style.transition = "none";

			const brightness = new LineBrightness(main);
			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;
			// 克隆时会显式调用 dim.style.removeProperty("transition")
			expect(dim.style.transition).toBe("");
		});
	});

	describe("Transition Suppression Mechanism", () => {
		it("sets main.style.transition to none synchronously and restores via rAF", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();

			// 切换为 bright 状态时，当帧内应当抑制过渡
			expect(main.classList.contains(styles.lyricMainLineBright)).toBe(true);
			expect(main.style.transition).toBe("none");

			// 前进一帧 (requestAnimationFrame)
			vi.advanceTimersToNextFrame();

			// 过渡抑制已恢复为空
			expect(main.style.transition).toBe("");
		});

		it("suppresses transition on state deactivate and restores via rAF", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();
			expect(main.style.transition).toBe("none");

			// 临时停用 (deactivate)：触发退出时的过渡抑制
			brightness.deactivate();
			expect(main.classList.contains(styles.lyricMainLineBright)).toBe(false);
			// 退出时同样需要抑制过渡以防图层剥离闪烁
			expect(main.style.transition).toBe("none");

			// 前进一帧以恢复过渡
			vi.advanceTimersToNextFrame();
			expect(main.style.transition).toBe("");
		});

		it("synchronously clears transition and cancels pending rAF when dispose is called", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();
			expect(main.style.transition).toBe("none");

			const rafSpy = vi.spyOn(window, "requestAnimationFrame");
			brightness.dispose();

			expect(brightness.disposed).toBe(true);
			expect(main.classList.contains(styles.lyricMainLineBright)).toBe(false);
			expect(main.style.transition).toBe("");
			expect(rafSpy).not.toHaveBeenCalled();

			// 后续即便推进一帧也不会有任何副作用
			vi.advanceTimersToNextFrame();
			expect(main.style.transition).toBe("");
		});

		it("does not schedule rAF and clears transition synchronously when main is not connected", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			// 模拟宿主元素从 DOM 中离架
			parent.remove();
			expect(main.isConnected).toBe(false);

			const rafSpy = vi.spyOn(window, "requestAnimationFrame");
			brightness.deactivate();

			expect(main.classList.contains(styles.lyricMainLineBright)).toBe(false);
			expect(main.style.transition).toBe("");
			expect(rafSpy).not.toHaveBeenCalled();
		});

		it("safeguards against rAF callback if node was detached before the next frame", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			// 处于挂载状态下停用，注册了 rAF
			brightness.deactivate();
			expect(main.style.transition).toBe("none");

			// 在下一帧到达前，宿主元素被移出 DOM
			parent.remove();
			expect(main.isConnected).toBe(false);

			// 推进到下一帧触发回调，守卫应直接将 transition 置空
			vi.advanceTimersToNextFrame();
			expect(main.style.transition).toBe("");
		});
	});

	describe("Lifecycle & Settle Window Management", () => {
		it("respects enabled=false in constructor and ignores rebuild", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main, false);

			brightness.rebuild();

			expect(brightness.isReady).toBe(false);
		});

		it("disposes immediately if syncState called when enabled is false", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main, true);
			brightness.rebuild();
			expect(brightness.isReady).toBe(true);

			// 重新通过 disabled 状态触发 syncState
			const disabledBrightness = new LineBrightness(main, false);
			// @ts-expect-error 测试私有属性
			disabledBrightness.dim = document.createElement("div");
			disabledBrightness.sync();
			expect(disabledBrightness.isReady).toBe(false);
		});

		it("does not rebuild if main element is not connected to DOM", () => {
			const unattachedParent = document.createElement("div");
			const unattachedMain = document.createElement("div");
			unattachedParent.appendChild(unattachedMain);

			const brightness = new LineBrightness(unattachedMain);
			brightness.sync();

			expect(brightness.isReady).toBe(false);
		});

		it("rebuilds when in window and connected", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.sync();
			expect(brightness.isReady).toBe(true);
		});

		it("forceRebuild recreates copy even if already ready", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.sync();
			const firstDim = parent.querySelector(`.${styles.lyricMainLineDim}`);

			brightness.sync(true);
			const secondDim = parent.querySelector(`.${styles.lyricMainLineDim}`);

			expect(firstDim).not.toBe(secondDim);
		});

		it("holds copy until BRIGHTNESS_SETTLE_MS passes after exiting highlight", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();
			expect(brightness.isReady).toBe(true);

			// 标记退出高亮时刻 (performance.now 记录)
			brightness.markHighlightExited();

			// 移出活跃窗口
			brightness.setInWindow(false);

			// 推进 300ms（未达到 500ms Settle 时间），副本依然保持
			vi.advanceTimersByTime(300);
			brightness.sync();
			expect(brightness.isReady).toBe(true);
			expect(parent.querySelector(`.${styles.lyricMainLineDim}`)).toBeTruthy();

			// 推进到 500ms，触发回收
			vi.advanceTimersByTime(200);
			brightness.sync();
			expect(brightness.isReady).toBe(false);
			expect(parent.querySelector(`.${styles.lyricMainLineDim}`)).toBeNull();
		});

		it("cleans up DOM when dispose is called", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			expect(brightness.isReady).toBe(true);

			brightness.dispose();

			expect(brightness.isReady).toBe(false);
			expect(parent.querySelector(`.${styles.lyricMainLineDim}`)).toBeNull();
			expect(main.classList.contains(styles.lyricMainLineBright)).toBe(false);
		});

		it("marks as disposed and ignores subsequent rebuild or sync calls after dispose", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();
			expect(brightness.isReady).toBe(true);

			brightness.dispose();
			expect(brightness.disposed).toBe(true);
			expect(brightness.isReady).toBe(false);

			// 销毁后再次调用 rebuild / syncState 均无动作
			brightness.rebuild();
			expect(brightness.isReady).toBe(false);

			brightness.sync();
			expect(brightness.isReady).toBe(false);
		});

		it("allows reactivating via rebuild/syncState after deactivate", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);

			brightness.rebuild();
			expect(brightness.isReady).toBe(true);

			brightness.deactivate();
			expect(brightness.isReady).toBe(false);
			expect(brightness.disposed).toBe(false);

			// 停用后重新进入窗口，支持再次唤醒 rebuild
			brightness.sync();
			expect(brightness.isReady).toBe(true);
			expect(parent.querySelector(`.${styles.lyricMainLineDim}`)).toBeTruthy();
		});
	});

	describe("Cold-start Activation Transition", () => {
		it("plays 300ms WAAPI opacity animations on both dim and main elements", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;
			expect(dim).toBeTruthy();

			const mainAnimateSpy = vi.spyOn(main, "animate");
			const dimAnimateSpy = vi.spyOn(dim, "animate");

			brightness.playActivationTransition();

			expect(dimAnimateSpy).toHaveBeenCalledWith(
				[{ opacity: 0.2 }, { opacity: 0 }],
				{ duration: 300, easing: "ease-out" },
			);
			expect(mainAnimateSpy).toHaveBeenCalledWith(
				[{ opacity: 0 }, { opacity: 1 }],
				{ duration: 300, easing: "ease-out" },
			);
		});

		it("cancels running activation animations on markHighlightExited", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;

			const cancelMain = vi.fn();
			const cancelDim = vi.fn();

			vi.spyOn(main, "animate").mockReturnValue({
				cancel: cancelMain,
			} as unknown as Animation);
			vi.spyOn(dim, "animate").mockReturnValue({
				cancel: cancelDim,
			} as unknown as Animation);

			brightness.playActivationTransition();
			brightness.markHighlightExited();

			expect(cancelDim).toHaveBeenCalled();
			expect(cancelMain).toHaveBeenCalled();
		});

		it("cancels running activation animations on deactivate or clearCopy", () => {
			const { main, parent } = createFixture();
			const brightness = new LineBrightness(main);
			brightness.rebuild();

			const dim = parent.querySelector(
				`.${styles.lyricMainLineDim}`,
			) as HTMLElement;

			const cancelMain = vi.fn();
			const cancelDim = vi.fn();

			vi.spyOn(main, "animate").mockReturnValue({
				cancel: cancelMain,
			} as unknown as Animation);
			vi.spyOn(dim, "animate").mockReturnValue({
				cancel: cancelDim,
			} as unknown as Animation);

			brightness.playActivationTransition();
			brightness.deactivate();

			expect(cancelDim).toHaveBeenCalled();
			expect(cancelMain).toHaveBeenCalled();
		});

		it("safely ignores playActivationTransition when not ready or disposed", () => {
			const { main } = createFixture();
			const brightness = new LineBrightness(main);
			const mainAnimateSpy = vi.spyOn(main, "animate");

			brightness.playActivationTransition();
			expect(mainAnimateSpy).not.toHaveBeenCalled();

			brightness.rebuild();
			brightness.dispose();

			brightness.playActivationTransition();
			expect(mainAnimateSpy).not.toHaveBeenCalled();
		});
	});
});
