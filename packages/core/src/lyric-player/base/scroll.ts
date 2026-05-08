import { clamp } from "#utils/clamp.ts";

/**
 * 播放器滚动状态。
 *
 * 这部分状态描述用户手势/滚轮滚动产生的临时偏移，以及当前允许滚动的范围。
 * 改状态仅记录用户如何把当前视图上下拖动，不决定应该滚动到哪一行，
 * 后者由时间线状态与布局计算共同决定。
 */
export interface PlayerScrollState {
	/** 允许的滚动偏移范围 */
	scrollBoundary: {
		/** 允许的最小偏移量 */
		minOffset: number;
		/** 允许的最大偏移量 */
		maxOffset: number;
	};
	/** 当前用户滚动带来的额外偏移量 */
	scrollOffset: number;
	/** 是否允许用户通过手势或滚轮滚动歌词视图 */
	allowScroll: boolean;
	/** 是否处于用户滚动过，尚未回归自动对齐的状态 */
	isScrolled: boolean;
	/** 是否正在进行滚动交互或惯性滚动 */
	isUserScrolling: boolean;
}

/**
 * 将滚动偏移量限制在当前允许的滚动边界内。
 *
 * 当手势滚动、滚轮滚动或惯性滚动更新了 {@link PlayerScrollState.scrollOffset}
 * 后，应调用本函数以避免视图越界。
 */
export function clampPlayerScrollOffset(scrollState: PlayerScrollState): void {
	scrollState.scrollOffset = clamp(
		scrollState.scrollOffset,
		scrollState.scrollBoundary.minOffset,
		scrollState.scrollBoundary.maxOffset,
	);
}

/**
 * 重置滚动状态到未发生用户滚动时的初始状态。
 *
 * 本函数会清除当前偏移，并结束“已滚动”与“正在滚动”的标记；
 * **不会清理**外部持有的计时器或事件监听器。
 */
export function resetPlayerScrollState(scrollState: PlayerScrollState): void {
	scrollState.isScrolled = false;
	scrollState.scrollOffset = 0;
	scrollState.isUserScrolling = false;
}

/**
 * {@link attachPlayerScrollHandlers} 所需的宿主回调。
 *
 * 这些回调将滚动模块与具体播放器实现解耦：
 * 滚动模块只负责处理输入事件和更新滚动状态，布局刷新、点击转发等副作用
 * 由宿主决定如何执行。
 */
export interface AttachPlayerScrollHandlersCallbacks {
	/** 开始一次滚动处理前调用，返回 `false` 可阻止本次滚动 */
	onBeginScroll: () => boolean;
	/** 一次滚动交互或惯性滚动结束时调用 */
	onEndScroll: () => void;
	/** 请求宿主重新布局 */
	onLayout: (sync: boolean, force: boolean) => void;
	/** 判断某个点击目标是否仍属于当前播放器视图 */
	containsTarget: (target: Node) => boolean;
	/** 将点击事件转发给命中的目标元素 */
	clickTarget: (target: HTMLElement) => void;
}

/**
 * 向指定元素挂载歌词滚动相关的交互处理器。
 *
 * 该函数会处理：
 * - 触摸拖拽滚动
 * - 触摸结束后的惯性滚动
 * - 滚轮滚动
 * - 轻触时的点击透传
 *
 * 只更新 {@link PlayerScrollState} 并通过回调通知宿主执行布局或其它副作用，
 * 不直接依赖具体的播放器类实现。
 */
export function attachPlayerScrollHandlers(
	element: HTMLElement,
	scrollState: PlayerScrollState,
	callbacks: AttachPlayerScrollHandlersCallbacks,
): void {
	let startScrollY = 0;

	let startTouchPosY = 0;
	let startTouchStartX = 0;
	let startTouchStartY = 0;

	let lastMoveY = 0;
	let startScrollTime = 0;
	let scrollSpeed = 0;
	let curScrollId = 0;

	element.addEventListener("touchstart", (evt) => {
		if (callbacks.onBeginScroll()) {
			scrollState.isUserScrolling = true;

			evt.preventDefault();
			startScrollY = scrollState.scrollOffset;

			startTouchPosY = evt.touches[0].screenY;
			lastMoveY = startTouchPosY;

			startTouchStartX = evt.touches[0].screenX;
			startTouchStartY = evt.touches[0].screenY;

			startScrollTime = Date.now();
			scrollSpeed = 0;

			callbacks.onLayout(true, true);
		}
	});

	element.addEventListener("touchmove", (evt) => {
		if (callbacks.onBeginScroll()) {
			evt.preventDefault();
			const currentY = evt.touches[0].screenY;

			const deltaY = currentY - startTouchPosY;
			scrollState.scrollOffset = startScrollY - deltaY;
			clampPlayerScrollOffset(scrollState);

			const now = Date.now();
			const dt = now - startScrollTime;
			if (dt > 0) {
				scrollSpeed = (currentY - lastMoveY) / dt;
			}
			lastMoveY = currentY;
			startScrollTime = now;

			callbacks.onLayout(true, true);
		}
	});

	element.addEventListener("touchend", (evt) => {
		if (callbacks.onBeginScroll()) {
			evt.preventDefault();

			const touch = evt.changedTouches[0];
			const moveX = Math.abs(touch.screenX - startTouchStartX);
			const moveY = Math.abs(touch.screenY - startTouchStartY);

			if (moveX < 10 && moveY < 10) {
				const target = document.elementFromPoint(touch.clientX, touch.clientY);
				if (target instanceof HTMLElement && callbacks.containsTarget(target)) {
					callbacks.clickTarget(target);
				}
				scrollState.isUserScrolling = false;
				callbacks.onEndScroll();
				return;
			}

			startTouchPosY = 0;
			const scrollId = ++curScrollId;

			if (Math.abs(scrollSpeed) < 0.1) scrollSpeed = 0;

			let lastFrameTime = performance.now();

			const onScrollFrame = (time: number) => {
				if (scrollId !== curScrollId) return;

				const dt = time - lastFrameTime;
				lastFrameTime = time;

				if (dt <= 0 || dt > 100) {
					requestAnimationFrame(onScrollFrame);
					return;
				}

				if (Math.abs(scrollSpeed) > 0.05) {
					scrollState.scrollOffset -= scrollSpeed * dt;

					clampPlayerScrollOffset(scrollState);

					const frictionFactor = 0.95 ** (dt / 16);
					scrollSpeed *= frictionFactor;

					callbacks.onLayout(true, true);

					requestAnimationFrame(onScrollFrame);
				} else {
					scrollState.isUserScrolling = false;
					callbacks.onEndScroll();
				}
			};

			requestAnimationFrame(onScrollFrame);
		} else {
			scrollState.isUserScrolling = false;
		}
	});

	element.addEventListener(
		"wheel",
		(evt) => {
			if (callbacks.onBeginScroll()) {
				evt.preventDefault();

				if (evt.deltaMode === evt.DOM_DELTA_PIXEL) {
					scrollState.scrollOffset += evt.deltaY;
					clampPlayerScrollOffset(scrollState);
					callbacks.onLayout(true, false);
				} else {
					scrollState.scrollOffset += evt.deltaY * 50;
					clampPlayerScrollOffset(scrollState);
					callbacks.onLayout(false, false);
				}
			}
		},
		{ passive: false },
	);
}
