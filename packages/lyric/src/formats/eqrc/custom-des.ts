/**
 * @internal
 * @module custom_des
 * @description
 * 本模块包含了为解密 QRC 歌词而移植的、非标准的类 DES 算法的底层实现。
 *
 * <h2>
 * <strong>警告：该 DES 实现并非标准实现！</strong>
 * </h2>
 *
 * 它是结构类似DES的、但完全私有的分组密码算法。
 * 本实现仅用于 QRC 歌词解密，不应用于实际安全目的。
 */

import {
	E_BOX_TABLE,
	KEY_COMPRESSION,
	KEY_PERM_C,
	KEY_PERM_D,
	KEY_RND_SHIFT,
	P_BOX,
	S_BOXES,
} from "./constants";

export enum Mode {
	Encrypt,
	Decrypt,
}

export type KeySchedule = Int32Array;

/**
 * 从8字节密钥中根据置换表提取位，生成一个 BigInt。
 *
 * 这个函数对应原始C代码中的天书BITNUM宏，模拟 QQ 音乐特有的非标准的字节序处理方式。
 * 其将 8 字节密钥视为两个独立的、小端序的32位整数拼接而成。
 *
 * 例如，要读取第0位（MSB），它实际访问的是 `key[3]` 的最高位。
 * 要读取第31位，它访问的是 `key[0]` 的最低位。
 *
 * @param key 8字节的密钥 Uint8Array
 * @param table 0-based 的位索引置换表
 */
function permuteFromKeyBytes(key: Uint8Array, table: number[]): bigint {
	let output = 0n;
	let currentBitMask = 1n << BigInt(table.length - 1);

	for (let i = 0; i < table.length; i++) {
		const pos = table[i];

		const wordIndex = pos >> 5;
		const bitInWord = pos & 31;
		const byteInWord = bitInWord >> 3;
		const bitInByte = bitInWord & 7;
		const byteIndex = wordIndex * 4 + 3 - byteInWord;

		const bit = (key[byteIndex] >> (7 - bitInByte)) & 1;

		if (bit) {
			output |= currentBitMask;
		}
		currentBitMask >>= 1n;
	}
	return output;
}

/**
 * 对一个存储在 BigInt 中的28位密钥部分进行循环左移。
 * @param value 包含28位数据的高位的 BigInt
 * @param amount 左移的位数
 */
function rotateLeft28Bit(value: bigint, amount: number): bigint {
	const BITS_28_MASK = 0xfffffff0n;
	const val = value & BITS_28_MASK;
	const shifted = (val << BigInt(amount)) | (val >> BigInt(28 - amount));
	return shifted & BITS_28_MASK;
}

/**
 * DES 密钥调度算法。
 * 从一个64位的主密钥（实际使用56位，每字节的最低位是奇偶校验位，被忽略）
 * 生成16个48位的轮密钥。
 *
 * @param key 8字节的DES密钥
 * @param mode 加密或解密模式
 */
export function keySchedule(key: Uint8Array, mode: Mode): KeySchedule {
	// 预先分配连续的内存空间
	const schedule = new Int32Array(32);

	// 应用 PC-1
	const c0 = permuteFromKeyBytes(key, KEY_PERM_C);
	const d0 = permuteFromKeyBytes(key, KEY_PERM_D);

	// 将28位的结果左移4位，以匹配 `rotateLeft28Bit` 对高位对齐的期望。
	let c = c0 << 4n;
	let d = d0 << 4n;

	for (let i = 0; i < 16; i++) {
		const shift = KEY_RND_SHIFT[i];
		c = rotateLeft28Bit(c, shift);
		d = rotateLeft28Bit(d, shift);

		const toGen = mode === Mode.Decrypt ? 15 - i : i;

		let subkey48bit = 0n;
		// 应用 PC-2
		for (let k = 0; k < KEY_COMPRESSION.length; k++) {
			const pos = KEY_COMPRESSION[k];

			const bitBigInt =
				pos < 28
					? (c >> BigInt(31 - pos)) & 1n
					: (d >> BigInt(31 - (pos - 27))) & 1n; // QQ 音乐特有的怪癖，该算法的规则就是pos - 27

			if (bitBigInt === 1n) {
				subkey48bit |= 1n << BigInt(47 - k);
			}
		}

		// 提取高 24 位 (由第 5, 4, 3 字节组成)
		const b5 = Number((subkey48bit >> 40n) & 0xffn);
		const b4 = Number((subkey48bit >> 32n) & 0xffn);
		const b3 = Number((subkey48bit >> 24n) & 0xffn);
		const high24 = (b5 << 16) | (b4 << 8) | b3;

		// 提取低 24 位 (由第 2, 1, 0 字节组成)
		const b2 = Number((subkey48bit >> 16n) & 0xffn);
		const b1 = Number((subkey48bit >> 8n) & 0xffn);
		const b0 = Number(subkey48bit & 0xffn);
		const low24 = (b2 << 16) | (b1 << 8) | b0;

		// 存储到一维数组中
		schedule[toGen * 2] = high24;
		schedule[toGen * 2 + 1] = low24;
	}

	return schedule;
}

// 初始置换规则。
const IP_RULE: number[] = [
	34, 42, 50, 58, 2, 10, 18, 26, 36, 44, 52, 60, 4, 12, 20, 28, 38, 46, 54, 62,
	6, 14, 22, 30, 40, 48, 56, 64, 8, 16, 24, 32, 33, 41, 49, 57, 1, 9, 17, 25,
	35, 43, 51, 59, 3, 11, 19, 27, 37, 45, 53, 61, 5, 13, 21, 29, 39, 47, 55, 63,
	7, 15, 23, 31,
];

// 逆初始置换规则。
const INV_IP_RULE: number[] = [
	37, 5, 45, 13, 53, 21, 61, 29, 38, 6, 46, 14, 54, 22, 62, 30, 39, 7, 47, 15,
	55, 23, 63, 31, 40, 8, 48, 16, 56, 24, 64, 32, 33, 1, 41, 9, 49, 17, 57, 25,
	34, 2, 42, 10, 50, 18, 58, 26, 35, 3, 43, 11, 51, 19, 59, 27, 36, 4, 44, 12,
	52, 20, 60, 28,
];

const IP_LEFT_TABLE = new Int32Array(2048);
const IP_RIGHT_TABLE = new Int32Array(2048);
const INV_IP_LEFT_TABLE = new Int32Array(2048);
const INV_IP_RIGHT_TABLE = new Int32Array(2048);

function generatePermutationTables(): void {
	const applyPermutation = (input: bigint, rule: number[]): bigint => {
		let output = 0n;
		for (let i = 0; i < 64; i++) {
			const srcBit1Based = rule[i];
			if ((input >> BigInt(64 - srcBit1Based)) & 1n) {
				output |= 1n << BigInt(63 - i);
			}
		}
		return output;
	};

	// 生成 IP 结果查找表
	for (let bytePos = 0; bytePos < 8; bytePos++) {
		for (let byteVal = 0; byteVal < 256; byteVal++) {
			const input = BigInt(byteVal) << BigInt(56 - bytePos * 8);
			const permuted = applyPermutation(input, IP_RULE);
			const idx = (bytePos << 8) | byteVal;
			IP_LEFT_TABLE[idx] = Number((permuted >> 32n) & 0xffffffffn);
			IP_RIGHT_TABLE[idx] = Number(permuted & 0xffffffffn);
		}
	}

	// 生成 InvIP 结果查找表 (一维 TypedArray，分为左右 32 位以避免 BigInt)
	for (let blockPos = 0; blockPos < 8; blockPos++) {
		for (let blockVal = 0; blockVal < 256; blockVal++) {
			const input = BigInt(blockVal) << BigInt(56 - blockPos * 8);
			const permuted = applyPermutation(input, INV_IP_RULE);
			const idx = (blockPos << 8) | blockVal;
			INV_IP_LEFT_TABLE[idx] = Number((permuted >> 32n) & 0xffffffffn);
			INV_IP_RIGHT_TABLE[idx] = Number(permuted & 0xffffffffn);
		}
	}
}
generatePermutationTables();

/**
 * 计算 DES S-盒的查找索引。
 * @param a 一个包含6位数据的 u8
 */
function calculateSboxIndex(a: number): number {
	return (a & 0x20) | ((a & 0x1f) >> 1) | ((a & 0x01) << 4);
}

/**
 * 对一个 32 位整数应用非标准的 P 盒置换规则。
 * @param input S-盒代换后的 32 位中间结果
 */
function applyQqPboxPermutation(input: number): number {
	let output = 0;
	for (let i = 0; i < 32; i++) {
		const sourceBit1Based = P_BOX[i];
		const destBitMask = 1 << (31 - i);
		const sourceBitMask = 1 << (32 - sourceBit1Based);
		if ((input & sourceBitMask) !== 0) {
			output |= destBitMask;
		}
	}
	return output;
}

const SP_TABLE = new Int32Array(512);

/**
 * 生成 S-P 盒合并查找表以提高性能。
 */
function generateSpTables(): void {
	for (let sBoxIdx = 0; sBoxIdx < 8; sBoxIdx++) {
		for (let sBoxInput = 0; sBoxInput < 64; sBoxInput++) {
			const sBoxIndex = calculateSboxIndex(sBoxInput);
			const fourBitOutput = S_BOXES[sBoxIdx][sBoxIndex];
			const prePBoxVal = fourBitOutput << (28 - sBoxIdx * 4);
			SP_TABLE[(sBoxIdx << 6) | sBoxInput] = applyQqPboxPermutation(prePBoxVal);
		}
	}
}
generateSpTables();

const EBOX_HIGH_TABLE = new Int32Array(1024);
const EBOX_LOW_TABLE = new Int32Array(1024);

function generateEBoxTables(): void {
	for (let chunkIdx = 0; chunkIdx < 4; chunkIdx++) {
		const shiftIn32 = (3 - chunkIdx) * 8;

		for (let byteVal = 0; byteVal < 256; byteVal++) {
			let high24 = 0;
			let low24 = 0;
			const input = byteVal << shiftIn32;

			for (let i = 0; i < 24; i++) {
				const sourceBitPos = E_BOX_TABLE[i];
				const bit = (input >>> (32 - sourceBitPos)) & 1;
				if (bit) {
					high24 |= 1 << (23 - i);
				}
			}

			for (let i = 24; i < 48; i++) {
				const sourceBitPos = E_BOX_TABLE[i];
				const bit = (input >>> (32 - sourceBitPos)) & 1;
				if (bit) {
					low24 |= 1 << (47 - i);
				}
			}

			const tableIdx = (chunkIdx << 8) | byteVal;
			EBOX_HIGH_TABLE[tableIdx] = high24;
			EBOX_LOW_TABLE[tableIdx] = low24;
		}
	}
}
generateEBoxTables();

/**
 * DES 的 F 函数。
 */
function fFunction(state: number, keyHigh24: number, keyLow24: number): number {
	// 将 32 位状态拆分为 4 个字节，直接查表并进行按位或拼接
	const b0 = (state >>> 24) & 0xff;
	const b1 = (state >>> 16) & 0xff;
	const b2 = (state >>> 8) & 0xff;
	const b3 = state & 0xff;

	const eboxHigh24 =
		EBOX_HIGH_TABLE[b0] |
		EBOX_HIGH_TABLE[256 | b1] |
		EBOX_HIGH_TABLE[512 | b2] |
		EBOX_HIGH_TABLE[768 | b3];
	const eboxLow24 =
		EBOX_LOW_TABLE[b0] |
		EBOX_LOW_TABLE[256 | b1] |
		EBOX_LOW_TABLE[512 | b2] |
		EBOX_LOW_TABLE[768 | b3];

	const xorHigh24 = eboxHigh24 ^ keyHigh24;
	const xorLow24 = eboxLow24 ^ keyLow24;

	return (
		SP_TABLE[(xorHigh24 >>> 18) & 0x3f] |
		SP_TABLE[64 | ((xorHigh24 >>> 12) & 0x3f)] |
		SP_TABLE[128 | ((xorHigh24 >>> 6) & 0x3f)] |
		SP_TABLE[192 | (xorHigh24 & 0x3f)] |
		SP_TABLE[256 | ((xorLow24 >>> 18) & 0x3f)] |
		SP_TABLE[320 | ((xorLow24 >>> 12) & 0x3f)] |
		SP_TABLE[384 | ((xorLow24 >>> 6) & 0x3f)] |
		SP_TABLE[448 | (xorLow24 & 0x3f)]
	);
}

/**
 * DES 加密/解密单个64位数据块。
 *
 * @param input 8字节的输入数据块 (明文或密文)。
 * @param output 8字节的可变切片，用于存储输出数据块 (密文或明文)。
 * @param keySchedule 一个包含16个轮密钥的向量的引用，每个轮密钥是6字节。
 */
export function desCrypt(
	input: Uint8Array,
	output: Uint8Array,
	keySchedule: KeySchedule,
): void {
	let left = 0;
	let right = 0;
	for (let i = 0; i < 8; i++) {
		const idx = (i << 8) | input[i];
		left |= IP_LEFT_TABLE[idx];
		right |= IP_RIGHT_TABLE[idx];
	}

	for (let i = 0; i < 15; i++) {
		const temp = right;
		right =
			(left ^ fFunction(right, keySchedule[i * 2], keySchedule[i * 2 + 1])) >>>
			0;
		left = temp;
	}
	left = (left ^ fFunction(right, keySchedule[30], keySchedule[31])) >>> 0;

	let outLeft = 0;
	let outRight = 0;
	for (let i = 0; i < 4; i++) {
		// 分别计算左侧 32 位和右侧 32 位在 INV_IP 阶段的表现
		const idxL = (i << 8) | ((left >>> (24 - i * 8)) & 0xff);
		outLeft |= INV_IP_LEFT_TABLE[idxL];
		outRight |= INV_IP_RIGHT_TABLE[idxL];

		const idxR = ((i + 4) << 8) | ((right >>> (24 - i * 8)) & 0xff);
		outLeft |= INV_IP_LEFT_TABLE[idxR];
		outRight |= INV_IP_RIGHT_TABLE[idxR];
	}

	// 使用按位移位进行输出数组写入
	output[0] = (outLeft >>> 24) & 0xff;
	output[1] = (outLeft >>> 16) & 0xff;
	output[2] = (outLeft >>> 8) & 0xff;
	output[3] = outLeft & 0xff;
	output[4] = (outRight >>> 24) & 0xff;
	output[5] = (outRight >>> 16) & 0xff;
	output[6] = (outRight >>> 8) & 0xff;
	output[7] = outRight & 0xff;
}
