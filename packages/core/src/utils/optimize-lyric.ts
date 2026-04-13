import type { LyricLine, OptimizeLyricOptions } from "../interfaces.ts";

const DEFAULT_OPTIMIZE_OPTIONS: OptimizeLyricOptions = {
	normalizeSpaces: true,
	resetLineTimestamps: true,
	convertExcessiveBackgroundLines: true,
	syncMainAndBackgroundLines: true,
	cleanUnintentionalOverlaps: true,
	tryAdvanceStartTime: true,
};

/**
 * 规范化歌词中的空格，将多个连续空格替换为一个空格
 */
function normalizeSpaces(lines: LyricLine[]) {
	for (const line of lines) {
		for (const word of line.words) {
			word.word = word.word.replace(/\s+/g, " ");
		}
	}
}

/**
 * 将行级时间戳强行设为字级时间戳
 */
function resetLineTimestamps(lines: LyricLine[]) {
	for (const line of lines) {
		// 主要是给 TTML 解析器打补丁，其解析逐行歌词时获得的词时间戳均为0
		// 如果只有一个词，且该词的起止时间均为0，且行时间戳不全为0，则将行时间戳同步给词时间戳
		if (
			line.words.length === 1 &&
			line.words[0].startTime === 0 &&
			line.words[0].endTime === 0 &&
			(line.startTime !== 0 || line.endTime !== 0)
		) {
			line.words[0].startTime = line.startTime;
			line.words[0].endTime = line.endTime;
		} else if (line.words.length > 0) {
			const firstWord = line.words[0];
			const lastWord = line.words[line.words.length - 1];

			line.startTime = firstWord.startTime;
			line.endTime = lastWord.endTime;
		}
	}
}

/**
 * 把多行背景人声转换为单行背景人声 + 主歌词行的形式
 */
function convertExcessiveBackgroundLines(lines: LyricLine[]) {
	let consecutiveBgCount = 0;

	for (const line of lines) {
		if (line.isBG) {
			consecutiveBgCount++;
			if (consecutiveBgCount > 1) {
				line.isBG = false;
			}
		} else {
			consecutiveBgCount = 0;
		}
	}
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
 * 如果重叠大于100ms 且 重叠超过下一行时长的10%，则视为刻意重叠，否则将结束时间设为下一行的开始时间
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
 * 尝试让歌词提前最多 600ms 开始，如果有重叠则尝试最多提前 400ms 或上一行时长的 30%
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
				targetAdvanceAmount = 600;
				safeBoundary = prevLine.endTime;
			} else {
				targetAdvanceAmount = 400;
				const prevDuration = prevLine.endTime - prevLine.startTime;
				safeBoundary = prevLine.startTime + prevDuration * 0.3;
			}
		} else {
			targetAdvanceAmount = 600;
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
 * @param options 优化的可选配置，默认全部开启
 */
export function optimizeLyricLines(
	lines: LyricLine[],
	options?: OptimizeLyricOptions,
): void {
	const config = { ...DEFAULT_OPTIMIZE_OPTIONS, ...options };

	if (config.normalizeSpaces) {
		normalizeSpaces(lines);
	}
	if (config.resetLineTimestamps) {
		resetLineTimestamps(lines);
	}
	if (config.convertExcessiveBackgroundLines) {
		convertExcessiveBackgroundLines(lines);
	}
	if (config.syncMainAndBackgroundLines) {
		syncMainAndBackgroundLines(lines);
	}
	if (config.cleanUnintentionalOverlaps) {
		cleanUnintentionalOverlaps(lines);
	}
	if (config.tryAdvanceStartTime) {
		tryAdvanceStartTime(lines);
	}
}
