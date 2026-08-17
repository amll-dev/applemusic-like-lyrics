declare const DURATION_BRAND: unique symbol;
declare const MEDIA_TIME_BRAND: unique symbol;

/**
 * 一段时长，内部以毫秒浮点数表示
 */
export type Duration = { readonly [DURATION_BRAND]: true };

/**
 * 媒体时间轴上的一个时间点，内部以毫秒浮点数表示
 *
 * 原点为歌曲起始 0ms
 */
export type MediaTime = { readonly [MEDIA_TIME_BRAND]: true };

const toD = (ms: number): Duration => ms as unknown as Duration;
const toM = (ms: number): MediaTime => ms as unknown as MediaTime;
const toNum = (t: Duration | MediaTime): number => t as unknown as number;

export const Duration = {
	ZERO: toD(0) as Duration,
	fromMillis: (ms: number): Duration => toD(ms),
	fromSecs: (s: number): Duration => toD(s * 1000),
	asMillis: (d: Duration): number => toNum(d),
	asSecsF64: (d: Duration): number => toNum(d) / 1000,
	add: (a: Duration, b: Duration): Duration => toD(toNum(a) + toNum(b)),
	sub: (a: Duration, b: Duration): Duration => toD(toNum(a) - toNum(b)),
	saturatingSub: (a: Duration, b: Duration): Duration =>
		toD(Math.max(0, toNum(a) - toNum(b))),
	mulF64: (d: Duration, factor: number): Duration => toD(toNum(d) * factor),
	divDuration: (a: Duration, b: Duration): number => toNum(a) / toNum(b),
	min: (a: Duration, b: Duration): Duration => (a < b ? a : b),
	max: (a: Duration, b: Duration): Duration => (a > b ? a : b),
	clampPositive: (d: Duration): Duration => toD(Math.max(0, toNum(d))),
	isZero: (d: Duration): boolean => toNum(d) === 0,
	isFinite: (d: Duration): boolean => Number.isFinite(toNum(d)),
} as const;

export const MediaTime = {
	ZERO: toM(0) as MediaTime,
	fromMillis: (ms: number): MediaTime => toM(ms),
	asMillis: (t: MediaTime): number => toNum(t),
	since: (a: MediaTime, b: MediaTime): Duration => toD(toNum(a) - toNum(b)),
	saturatingSince: (a: MediaTime, b: MediaTime): Duration =>
		toD(Math.max(0, toNum(a) - toNum(b))),
	add: (t: MediaTime, d: Duration): MediaTime => toM(toNum(t) + toNum(d)),
	sub: (t: MediaTime, d: Duration): MediaTime => toM(toNum(t) - toNum(d)),
	min: (a: MediaTime, b: MediaTime): MediaTime => (a < b ? a : b),
	max: (a: MediaTime, b: MediaTime): MediaTime => (a > b ? a : b),
	cmp: (a: MediaTime, b: MediaTime): number => toNum(a) - toNum(b),
	round: (t: MediaTime): MediaTime => toM(Math.round(toNum(t))),
} as const;
