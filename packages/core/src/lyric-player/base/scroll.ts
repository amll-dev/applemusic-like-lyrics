export interface PlayerScrollState {
	scrollBoundary: [number, number];
	scrollOffset: number;
	allowScroll: boolean;
	isScrolled: boolean;
	isUserScrolling: boolean;
}

export function clampPlayerScrollOffset(scrollState: PlayerScrollState): void {
	scrollState.scrollOffset = Math.max(
		Math.min(scrollState.scrollBoundary[1], scrollState.scrollOffset),
		scrollState.scrollBoundary[0],
	);
}

export function resetPlayerScrollState(scrollState: PlayerScrollState): void {
	scrollState.isScrolled = false;
	scrollState.scrollOffset = 0;
	scrollState.isUserScrolling = false;
}

export interface AttachPlayerScrollHandlersCallbacks {
	onBeginScroll: () => boolean;
	onEndScroll: () => void;
	onLayout: (sync: boolean, force: boolean) => void;
	containsTarget: (target: Node) => boolean;
	clickTarget: (target: HTMLElement) => void;
}

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
