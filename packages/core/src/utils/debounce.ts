// biome-ignore lint/suspicious/noExplicitAny: for debounce function
export function debounce<T extends (...args: any) => any>(
	cb: T,
	wait = 20,
): (...args: Parameters<T>) => void {
	let h: ReturnType<typeof setTimeout> | undefined;
	const callable = (...args: Parameters<T>) => {
		clearTimeout(h);
		h = setTimeout(() => cb(...args), wait);
	};
	return callable;
}

// biome-ignore lint/suspicious/noExplicitAny: function can be any
export function debounceFrame<T extends (...args: any) => any>(
	cb: T,
	frameTime = 1,
): (...args: Parameters<T>) => void {
	let h = 0;
	let ft = frameTime;
	const callable = (...args: Parameters<T>) => {
		ft = frameTime;
		cancelAnimationFrame(h);
		const onCB = () => {
			if (--ft <= 0) {
				cb(...args);
			} else {
				h = requestAnimationFrame(onCB);
			}
		};
		h = requestAnimationFrame(onCB);
	};
	return callable;
}
