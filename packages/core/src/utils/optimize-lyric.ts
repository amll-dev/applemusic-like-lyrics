import type { LyricLine } from "../interfaces.ts";

/**
 * 将行级时间戳强行设为字级时间戳
 */
function resetLineTimestamps(lines: LyricLine[]) {
	for (const line of lines) {
		if (line.words.length > 0) {
			const firstWord = line.words[0];
			const lastWord = line.words[line.words.length - 1];

			line.startTime = firstWord.startTime;
			line.endTime = lastWord.endTime;
		}
	}
}

/**
 * 把多行背景人声转换为单行背景人声 + 主歌词行的形式
 *
 * 注意：此函数现已禁用，允许多个背景行连续显示
 * 以支持多和声声部（如三重唱、四重唱）的场景
 */
function convertExcessiveBackgroundLines(_lines: LyricLine[]) {
	// 函数已禁用：不再限制背景行数量
	// 这样可以支持多个和声层同时显示
}

/**
 * 同步主歌词与背景人声的时间
 *
 * 取两者中最早的开始时间和最晚的结束时间，应用给双方
 */
function syncMainAndBackgroundLines(lines: LyricLine[]) {
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line.isBG) continue;

		const nextLine = lines[i + 1];
		if (nextLine?.isBG) {
			const allWords = [...line.words, ...nextLine.words].filter(
				(w) => w.word.trim().length > 0,
			);

			if (allWords.length > 0) {
				const minStart = Math.min(...allWords.map((w) => w.startTime));
				const maxEnd = Math.max(...allWords.map((w) => w.endTime));

				const finalStart = Math.min(
					minStart,
					line.startTime,
					nextLine.startTime,
				);
				const finalEnd = Math.max(maxEnd, line.endTime, nextLine.endTime);

				line.startTime = finalStart;
				line.endTime = finalEnd;
				nextLine.startTime = finalStart;
				nextLine.endTime = finalEnd;
			}
		}
	}
}

/**
 * 清洗非刻意的重叠
 *
 * 如果重叠大于100ms 且 重叠超过下一行时长的10%，则截断
 */
function cleanUnintentionalOverlaps(lines: LyricLine[]) {
	for (let i = 0; i < lines.length - 1; i++) {
		const line = lines[i];
		if (line.isBG) continue;

		let nextMainIndex = i + 1;
		while (nextMainIndex < lines.length && lines[nextMainIndex].isBG) {
			nextMainIndex++;
		}

		if (nextMainIndex < lines.length) {
			const nextLine = lines[nextMainIndex];
			const overlap = line.endTime - nextLine.startTime;

			if (overlap > 0) {
				const nextDuration = nextLine.endTime - nextLine.startTime;
				const percentageThreshold = nextDuration * 0.1;

				// 重叠大于100ms 且 重叠超过下一行时长的10%
				const isIntentionalOverlap =
					overlap > 100 && overlap > percentageThreshold;

				if (!isIntentionalOverlap) {
					line.endTime = nextLine.startTime;

					const attachedBgLine = lines[i + 1];
					if (attachedBgLine?.isBG) {
						attachedBgLine.endTime = nextLine.startTime;
					}
				}
			}
		}
	}
}

/**
 * 尝试让歌词提前最多 1 秒开始，如果有重叠则尝试最多提前 400ms 或上一行时长的 30%
 */
function tryAdvanceStartTime(lines: LyricLine[]) {
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line.isBG) continue;

		let prevLine: LyricLine | null = null;
		if (i > 0) {
			let prevIdx = i - 1;
			if (lines[prevIdx].isBG) {
				prevIdx--;
			}
			if (prevIdx >= 0) {
				prevLine = lines[prevIdx];
			}
		}

		let targetAdvanceAmount = 0;
		let safeBoundary = 0;

		if (prevLine) {
			const originallyHadGap = line.startTime >= prevLine.endTime;

			if (originallyHadGap) {
				targetAdvanceAmount = 1000;
				safeBoundary = prevLine.endTime;
			} else {
				targetAdvanceAmount = 400;
				const prevDuration = prevLine.endTime - prevLine.startTime;
				safeBoundary = prevLine.startTime + prevDuration * 0.3;
			}
		} else {
			targetAdvanceAmount = 1000;
			safeBoundary = 0;
		}

		const targetTime = line.startTime - targetAdvanceAmount;
		const newStartTime = Math.max(safeBoundary, targetTime);

		if (newStartTime < line.startTime) {
			line.startTime = newStartTime;
		}

		const nextLine = lines[i + 1];
		if (nextLine?.isBG) {
			nextLine.startTime = line.startTime;
		}
	}
}

/**
 * 优化歌词行的展示效果
 *
 * 注意会直接原地修改入参，确保你已经提前深克隆了歌词行数组
 * @param lines 歌词行数组
 */
export function optimizeLyricLines(lines: LyricLine[]) {
	for (const line of lines) {
		for (const word of line.words) {
			word.word = word.word.replace(/\s+/g, " ");
		}
	}

	resetLineTimestamps(lines);
	convertExcessiveBackgroundLines(lines);
	syncMainAndBackgroundLines(lines);
	cleanUnintentionalOverlaps(lines);
	tryAdvanceStartTime(lines);
}
