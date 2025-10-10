declare class RestrictionTarget {
	static fromElement(element: Element): Promise<RestrictionTarget>;
}

declare interface MediaStreamTrack {
	restrictTo(target: RestrictionTarget | null): Promise<void>;
}

declare interface MediaTrackConstraints {
	cursor?: "always" | "motion" | "never";
}
