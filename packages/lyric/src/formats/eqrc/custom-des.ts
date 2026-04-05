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

type SubKey = number[];
type KeySchedule = SubKey[];

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
	const outputLen = BigInt(table.length);

	for (let i = 0; i < table.length; i++) {
		const pos = table[i];

		const wordIndex = Math.floor(pos / 32);
		const bitInWord = pos % 32;
		const byteInWord = Math.floor(bitInWord / 8);
		const bitInByte = bitInWord % 8;
		const byteIndex = wordIndex * 4 + 3 - byteInWord;

		const bit = (key[byteIndex] >> (7 - bitInByte)) & 1;

		if (bit) {
			output |= 1n << (outputLen - 1n - BigInt(i));
		}
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
	const schedule: number[][] = Array.from({ length: 16 }, () =>
		Array(6).fill(0),
	);

	// 应用 PC-1
	const c0 = permuteFromKeyBytes(key, KEY_PERM_C);
	const d0 = permuteFromKeyBytes(key, KEY_PERM_D);

	// 将28位的结果左移4位，以匹配 `rotate_left_28bit_in_u32` 对高位对齐的期望。
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

		// 将48位的 BigInt 转换为6个字节的 Uint8Array
		const subkeyBytes = [];
		for (let j = 5; j >= 0; j--) {
			subkeyBytes.push(Number((subkey48bit >> BigInt(j * 8)) & 0xffn));
		}
		schedule[toGen] = subkeyBytes;
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

// 查找表生成
type PermutationTable = [number, number][]; // [left, right]

function generatePermutationTables(): {
	ipTable: PermutationTable[];
	invIpTable: bigint[][];
} {
	const ipTable: PermutationTable[] = Array.from({ length: 8 }, () =>
		Array(256).fill([0, 0]),
	);
	const invIpTable: bigint[][] = Array.from({ length: 8 }, () =>
		Array(256).fill(0n),
	);

	// 对单个 64 位 BigInt 应用置换
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
			ipTable[bytePos][byteVal] = [
				Number((permuted >> 32n) & 0xffffffffn),
				Number(permuted & 0xffffffffn),
			];
		}
	}

	// 生成 InvIP 结果查找表
	for (let blockPos = 0; blockPos < 8; blockPos++) {
		for (let blockVal = 0; blockVal < 256; blockVal++) {
			const input = BigInt(blockVal) << BigInt(56 - blockPos * 8);
			invIpTable[blockPos][blockVal] = applyPermutation(input, INV_IP_RULE);
		}
	}

	return { ipTable, invIpTable };
}

const { ipTable: IP_TABLE, invIpTable: INV_IP_TABLE } =
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

/**
 * 生成 S-P 盒合并查找表以提高性能。
 */
function generateSpTables(): number[][] {
	const spTables: number[][] = Array.from({ length: 8 }, () =>
		Array(64).fill(0),
	);
	for (let sBoxIdx = 0; sBoxIdx < 8; sBoxIdx++) {
		for (let sBoxInput = 0; sBoxInput < 64; sBoxInput++) {
			const sBoxIndex = calculateSboxIndex(sBoxInput);
			const fourBitOutput = S_BOXES[sBoxIdx][sBoxIndex];
			const prePBoxVal = fourBitOutput << (28 - sBoxIdx * 4);
			spTables[sBoxIdx][sBoxInput] = applyQqPboxPermutation(prePBoxVal);
		}
	}
	return spTables;
}

// 预先生成 S-P 查找表
const SP_TABLES = generateSpTables();

/**
 * 对一个32位整数应用 E-Box 扩展置换，生成一个48位的结果 (以BigInt表示)。
 * @param input 32位的右半部分数据 (R_i-1)
 */
function applyEBoxPermutation(input: number): bigint {
	let output = 0n;
	for (let i = 0; i < 48; i++) {
		const sourceBitPos = E_BOX_TABLE[i];
		const shiftAmount = 32 - sourceBitPos;
		const bit = (input >> shiftAmount) & 1;
		if (bit) {
			output |= 1n << BigInt(47 - i);
		}
	}
	return output;
}

/**
 * DES 的 F 函数。
 */
function fFunction(state: number, key: number[]): number {
	const keyU64 =
		(BigInt(key[0]) << 40n) |
		(BigInt(key[1]) << 32n) |
		(BigInt(key[2]) << 24n) |
		(BigInt(key[3]) << 16n) |
		(BigInt(key[4]) << 8n) |
		BigInt(key[5]);
	const expandedState = applyEBoxPermutation(state);
	const xorResult = expandedState ^ keyU64;

	return (
		SP_TABLES[0][Number((xorResult >> 42n) & 0x3fn)] |
		SP_TABLES[1][Number((xorResult >> 36n) & 0x3fn)] |
		SP_TABLES[2][Number((xorResult >> 30n) & 0x3fn)] |
		SP_TABLES[3][Number((xorResult >> 24n) & 0x3fn)] |
		SP_TABLES[4][Number((xorResult >> 18n) & 0x3fn)] |
		SP_TABLES[5][Number((xorResult >> 12n) & 0x3fn)] |
		SP_TABLES[6][Number((xorResult >> 6n) & 0x3fn)] |
		SP_TABLES[7][Number(xorResult & 0x3fn)]
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
		const [l, r] = IP_TABLE[i][input[i]];
		left |= l;
		right |= r;
	}

	for (let i = 0; i < 15; i++) {
		const temp = right;
		right = (left ^ fFunction(right, keySchedule[i])) >>> 0;
		left = temp;
	}
	left = (left ^ fFunction(right, keySchedule[15])) >>> 0;

	let result = 0n;
	for (let i = 0; i < 4; i++) {
		result |= INV_IP_TABLE[i][(left >> (24 - i * 8)) & 0xff];
		result |= INV_IP_TABLE[i + 4][(right >> (24 - i * 8)) & 0xff];
	}

	for (let i = 0; i < 8; i++) {
		output[i] = Number((result >> BigInt(56 - i * 8)) & 0xffn);
	}
}
