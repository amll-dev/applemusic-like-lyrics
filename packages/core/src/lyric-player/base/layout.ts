export interface PlayerLayoutState {
	interludeDotsSize: [number, number];
	targetAlignIndex: number;
	lastInterludeState: boolean;
	alignAnchor: "top" | "bottom" | "center";
	alignPosition: number;
	overscanPx: number;
}
