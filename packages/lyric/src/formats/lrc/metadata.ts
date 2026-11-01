import type { LrcMetadata } from "./types";

const LRC_METADATA_REGEX = /^\[\s*(?<key>[a-zA-Z]+)\s*:\s*(?<value>.*?)\s*\]$/;

/**
 * 解析一行 LRC 元数据，如 `[ti:标题]`
 * @param line 已去除首尾空白的单行文本
 * @returns 元数据键值对，若不是元数据行则为 `null`
 */
export function parseLrcMetadataLine(line: string): LrcMetadata | null {
	const match = line.match(LRC_METADATA_REGEX);
	if (!match?.groups) return null;

	const key = match.groups.key.toLowerCase();
	const value = match.groups.value.trim();
	if (!value) return null;

	return [[key, [value]]];
}

/**
 * 将元数据合并进目标元数据表
 *
 * 同名键的取值会按顺序合并并去重
 * @param target 目标元数据表，会被就地修改
 * @param source 待合并的元数据表
 */
export function mergeMetadata(target: LrcMetadata, source: LrcMetadata): void {
	for (const [key, values] of source) {
		const existing = target.find(([targetKey]) => targetKey === key);
		if (!existing) {
			target.push([key, [...values]]);
			continue;
		}
		for (const value of values) {
			if (!existing[1].includes(value)) existing[1].push(value);
		}
	}
}

/**
 * 将元数据表生成为 LRC 元数据行
 * @param metadata 元数据表
 * @returns 元数据行数组，没有可输出的元数据时为空数组
 */
export function generateLrcMetadataLines(metadata: LrcMetadata): string[] {
	const lines: string[] = [];
	for (const [key, values] of metadata) {
		const printableValues = values.filter((value) => value.trim() !== "");
		if (!key.trim() || printableValues.length === 0) continue;
		lines.push(`[${key}:${printableValues.join("/")}]`);
	}
	return lines;
}
