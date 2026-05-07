import type { LyricLine } from "#src/interfaces.ts";

/** {@link computePlayerTimeState} 的参数类型 */
export interface ComputePlayerTimeStateInput {
	time: number;
	processedLines: LyricLine[];
	hotLines: ReadonlySet<number>;
	bufferedLines: ReadonlySet<number>;
}

/** {@link computePlayerTimeState} 的返回类型 */
export interface ComputePlayerTimeStateResult {
	nextHotLines: Set<number>;
	addedIds: Set<number>;
	removedHotIds: Set<number>;
	removedBufferedIds: Set<number>;
}

/**
 * 计算指定时间点的热行/缓冲行状态转移的纯函数。其行为包括：
 *
 * - 根据当前时间和已有的热行状态，计算出新的热行状态，并返回应新增的热行 ID 和应移除的热行 ID
 * - 根据新的热行状态和已有的缓冲行状态，计算出应移除的缓冲行 ID
 */
export function computePlayerTimeState(
	input: ComputePlayerTimeStateInput,
): ComputePlayerTimeStateResult {
	const { time, processedLines } = input;
	const nextHotLines = new Set(input.hotLines);
	const addedIds = new Set<number>();
	const removedHotIds = new Set<number>();
	const removedBufferedIds = new Set<number>();

	for (const lastHotId of input.hotLines) {
		const line = processedLines[lastHotId];
		if (!line) {
			nextHotLines.delete(lastHotId);
			removedHotIds.add(lastHotId);
			continue;
		}
		if (line.isBG) continue;
		const nextLine = processedLines[lastHotId + 1];
		if (nextLine?.isBG) {
			const nextMainLine = processedLines[lastHotId + 2];
			const startTime = Math.min(line.startTime, nextLine.startTime);
			const endTime = Math.min(
				Math.max(line.endTime, nextMainLine?.startTime ?? Number.MAX_VALUE),
				Math.max(line.endTime, nextLine.endTime),
			);
			if (time < startTime || endTime <= time) {
				nextHotLines.delete(lastHotId);
				removedHotIds.add(lastHotId);
				nextHotLines.delete(lastHotId + 1);
				removedHotIds.add(lastHotId + 1);
			}
		} else if (time < line.startTime || line.endTime <= time) {
			nextHotLines.delete(lastHotId);
			removedHotIds.add(lastHotId);
		}
	}

	for (let id = 0; id < processedLines.length; id++) {
		const line = processedLines[id];
		if (!line || line.isBG) continue;
		if (
			line.startTime <= time &&
			line.endTime > time &&
			!nextHotLines.has(id)
		) {
			nextHotLines.add(id);
			addedIds.add(id);
			if (processedLines[id + 1]?.isBG) {
				nextHotLines.add(id + 1);
				addedIds.add(id + 1);
			}
		}
	}

	for (const id of input.bufferedLines) {
		if (!nextHotLines.has(id)) {
			removedBufferedIds.add(id);
		}
	}

	return {
		nextHotLines,
		addedIds,
		removedHotIds,
		removedBufferedIds,
	};
}

export function pickScrollToIndexForSeek(
	time: number,
	processedLines: LyricLine[],
	bufferedLines: ReadonlySet<number>,
): number {
	if (bufferedLines.size > 0) {
		return Math.min(...bufferedLines);
	}
	const foundIndex = processedLines.findIndex((line) => line.startTime >= time);
	return foundIndex === -1 ? processedLines.length : foundIndex;
}
