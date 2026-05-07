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
