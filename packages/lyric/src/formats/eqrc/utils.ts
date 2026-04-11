/// <reference types="node" />
/**
 * @module utils
 * @description
 *
 * 包含一些工具函数。
 */

/**
 * 将十六进制字符串转换为 Uint8Array。
 */
export function hexToUint8Array(hex: string): Uint8Array {
	if (typeof Buffer !== "undefined") {
		return Buffer.from(hex, "hex");
	}

	if (hex.length % 2 !== 0) {
		throw new Error("无效的十六进制字符串: 长度必须是偶数");
	}

	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

/**
 * 将 Uint8Array 转换为十六进制字符串。
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
	if (typeof Buffer !== "undefined") {
		return Buffer.from(bytes).toString("hex");
	}

	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
