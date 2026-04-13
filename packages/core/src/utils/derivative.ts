export function derivative(f: (x: number) => number) {
	const h = 0.001;
	return (x: number): number => (f(x + h) - f(x - h)) / (2 * h);
}

export function getVelocity(f: (t: number) => number): (t: number) => number {
	return derivative(f);
}
