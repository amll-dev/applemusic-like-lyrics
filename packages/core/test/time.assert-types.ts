import type { Duration, MediaTime } from "../src/utils/time.ts";

declare const d1: Duration;
declare const d2: Duration;
declare const m1: MediaTime;
declare const m2: MediaTime;
declare const n: number;

//#region 有效操作
export const _cmpD1: boolean = d1 < d2;
export const _cmpD2: boolean = d1 <= d2;
export const _cmpD3: boolean = d1 > d2;
export const _cmpD4: boolean = d1 >= d2;
export const _cmpD5: boolean = d1 === d2;
export const _cmpD6: boolean = d1 !== d2;
export const _cmpM1: boolean = m1 < m2;
export const _cmpM2: boolean = m1 <= m2;
export const _cmpM3: boolean = m1 > m2;
export const _cmpM4: boolean = m1 >= m2;
export const _cmpM5: boolean = m1 === m2;
export const _cmpM6: boolean = m1 !== m2;
//#endregion

//#region 无效操作
//#region 直接计算
// @ts-expect-error Operator '+' cannot be applied to types 'MediaTime' and '.MediaTime'.
export const _errAddMM: number = m1 + m2;

// @ts-expect-error Operator '+' cannot be applied to types 'Duration' and 'Duration'.
export const _errAddDD: number = d1 + d2;

// @ts-expect-error The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
export const _errSubMM: number = m1 - m2;

// @ts-expect-error The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
export const _errMulM: number = m1 * 2;

// @ts-expect-error The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
export const _errMulD: number = d1 * 2;
//#endregion

//#region 不同类型的比较
// @ts-expect-error Operator '<' cannot be applied to types 'Duration' and 'MediaTime'.
export const _errCmpDM: boolean = d1 < m1;

// @ts-expect-error Operator '>' cannot be applied to types 'MediaTime' and 'Duration'.
export const _errCmpMD: boolean = m1 > d1;

// @ts-expect-error Operator '<' cannot be applied to types 'MediaTime' and 'number'.
export const _errCmpMN: boolean = m1 < n;

// @ts-expect-error Operator '<' cannot be applied to types 'Duration' and 'number'.
export const _errCmpDN: boolean = d1 < n;
//#endregion

//#region 不兼容的赋值
// @ts-expect-error Property '[DURATION_BRAND]' is missing in type 'MediaTime' but required in type 'Duration'.
export const _errAssignMD: Duration = m1;

// @ts-expect-error Property '[MEDIA_TIME_BRAND]' is missing in type 'Duration' but required in type 'MediaTime'.
export const _errAssignDM: MediaTime = d1;

// @ts-expect-error Type 'number' is not assignable to type 'MediaTime'.
export const _errAssignNM: MediaTime = n;

// @ts-expect-error Type 'number' is not assignable to type 'Duration'.
export const _errAssignND: Duration = n;

// @ts-expect-error Type 'MediaTime' is not assignable to type 'number'.
export const _errAssignMN: number = m1;

// @ts-expect-error Type 'Duration' is not assignable to type 'number'.
export const _errAssignDN: number = d1;
//#endregion
//#endregion
