import type { LyricLine, OptimizeLyricOptions } from "../interfaces.ts";

const DEFAULT_OPTIMIZE_OPTIONS: OptimizeLyricOptions = {
	normalizeSpaces: true,
	resetLineTimestamps: true,
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
 * 确保背景人声前存在主歌词，并把多行背景人声转换为单行背景人声 + 主歌词行的形式
 */
function convertExcessiveBackgroundLines(lines: LyricLine[]) {
	let consecutiveBgCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.isBG) {
			consecutiveBgCount++;
			if (i === 0 || consecutiveBgCount > 1) {
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

			const finalStart = Math.min(
				line.startTime,
				nextLine.startTime,
				...allWords.map((w) => w.startTime),
			);
			const finalEnd = Math.max(
				line.endTime,
				nextLine.endTime,
				...allWords.map((w) => w.endTime),
			);

			line.startTime = finalStart;
			line.endTime = finalEnd;
			nextLine.startTime = finalStart;
			nextLine.endTime = finalEnd;
		}
	}
}

/**
 * 按主歌词的开始时间稳定排序，并保持主歌词与其背景人声的相对顺序
 */
function sortLyricLines(lines: LyricLine[]) {
	const groups: {
		lines: LyricLine[];
		startTime: number;
		originalIndex: number;
	}[] = [];

	for (let i = 0; i < lines.length; i++) {
		const mainLine = lines[i];
		const groupLines = [mainLine];

		if (!mainLine.isBG && lines[i + 1]?.isBG) {
			groupLines.push(lines[++i]);
		}

		groups.push({
			lines: groupLines,
			startTime: mainLine.startTime,
			originalIndex: groups.length,
		});
	}

	groups.sort((a, b) => {
		const timeDifference = a.startTime - b.startTime;
		return timeDifference || a.originalIndex - b.originalIndex;
	});

	let lineIndex = 0;
	for (const group of groups) {
		for (const line of group.lines) {
			lines[lineIndex++] = line;
		}
	}
}

/**
 * 清洗非刻意的重叠
 *
 * | 重叠情况                                   | 判定 |
 * | :------------------------------------------ | ---- |
 * | 重叠 ≥ 500ms                               | 有意 |
 * | 100ms < 重叠 < 500ms 且 > 下一行时长的 10% | 有意 |
 * | 重叠 ≤ 100ms 或 ≤ 下一行时长的 10%         | 无意 |
 *
 */
function cleanUnintentionalOverlaps(
	lines: LyricLine[],
	syncBackgroundLines: boolean,
) {
	for (let i = 0; i < lines.length - 1; i++) {
		const line = lines[i];
		if (line.isBG) continue;

		// 即使下一行是有意重叠，也继续检查后续仍重叠的歌词，避免不必要的多行高亮，例如：
		// A  0 - 3000
		// B  1000 - 2500
		// C  2950 - 3950
		// A 与 B 是有意重叠，但 A 与 C 只有 50ms 重叠，所以 A 最终被截断到 2950ms
		for (let j = i + 1; j < lines.length; j++) {
			const nextLine = lines[j];
			if (nextLine.isBG) continue;

			const overlap = line.endTime - nextLine.startTime;

			if (overlap <= 0) {
				break;
			}

			const nextDuration = nextLine.endTime - nextLine.startTime;
			const percentageThreshold = nextDuration * 0.1;

			const isIntentionalOverlap =
				overlap >= 500 || (overlap > 100 && overlap > percentageThreshold);

			if (!isIntentionalOverlap) {
				line.endTime = nextLine.startTime;

				const attachedBgLine = lines[i + 1];
				if (syncBackgroundLines && attachedBgLine?.isBG) {
					attachedBgLine.endTime = nextLine.startTime;
				}
				break;
			}
		}
	}
}

/**
 * 尝试让歌词提前最多 600ms 开始，如果有重叠则尝试提前 400ms，不够 400ms 的提前重叠时长的 70%
 */
function tryAdvanceStartTime(lines: LyricLine[], syncBackgroundLines: boolean) {
	/**
	 * 适用于第一行歌词或与上一行歌词存在充足间隔的提前量
	 */
	const defaultAdvanceAmount = 600;
	/**
	 * 适用于与上一行存在重叠的提前量
	 */
	const fallbackAdvanceAmount = 400;
	/**
	 * 与上一行重叠但重叠时长不够 400ms 时，按重叠时长提前的比率
	 */
	const fallbackAdvanceRatio = 0.7;

	let prevLineStartTime = 0;
	let prevLineEndTime = 0;
	let prevMainGroupStartTime = 0;
	let prevMainGroupEndTime = 0;
	let hasPrevLine = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.isBG) continue;

		const originalStartTime = line.startTime;
		const originalEndTime = line.endTime;

		let targetAdvanceAmount = 0;
		let safeBoundary = 0;

		if (hasPrevLine) {
			const originallyHadGap = originalStartTime >= prevLineEndTime;

			if (originallyHadGap) {
				// 与上一行有空隙或严丝合缝，最多提前 600ms，不超过上一行的结束时间
				targetAdvanceAmount = defaultAdvanceAmount;
				safeBoundary = prevMainGroupEndTime;
			} else {
				// 与上一行有重叠，尝试提前 400ms，重叠时长不足则提前重叠时长的 70%
				const overlapDuration = prevLineEndTime - originalStartTime;

				if (overlapDuration < fallbackAdvanceAmount) {
					targetAdvanceAmount = overlapDuration * fallbackAdvanceRatio;
				} else {
					targetAdvanceAmount = fallbackAdvanceAmount;
				}
				// 使用上一条主歌词的时间，不能依赖可能独立计时的背景行
				safeBoundary = prevLineStartTime;
			}
		} else {
			// 第一行歌词
			targetAdvanceAmount = defaultAdvanceAmount;
			safeBoundary = 0;
		}

		const targetTime = line.startTime - targetAdvanceAmount;
		const newStartTime = Math.max(safeBoundary, targetTime);

		if (newStartTime < line.startTime) {
			line.startTime = newStartTime;
		}

		// 启用时间同步时，给背景人声同步开始时间
		const nextLine = lines[i + 1];
		if (syncBackgroundLines && nextLine?.isBG) {
			nextLine.startTime = line.startTime;
		}

		// 为连续重叠的歌词行都加到一个组里，以便接下来不重叠的歌词行看到的是整个组的时间边界而不仅限于上一行的边界
		if (hasPrevLine) {
			const overlapsPrevGroup =
				originalStartTime < prevMainGroupEndTime &&
				originalEndTime > prevMainGroupStartTime;

			if (overlapsPrevGroup) {
				prevMainGroupStartTime = Math.min(
					prevMainGroupStartTime,
					originalStartTime,
				);
				prevMainGroupEndTime = Math.max(prevMainGroupEndTime, originalEndTime);
			} else {
				prevMainGroupStartTime = originalStartTime;
				prevMainGroupEndTime = originalEndTime;
			}
		} else {
			prevMainGroupStartTime = originalStartTime;
			prevMainGroupEndTime = originalEndTime;
		}

		prevLineStartTime = line.startTime;
		prevLineEndTime = originalEndTime;
		hasPrevLine = true;
	}
}

/**
 * 浅比对两个 OptimizeLyricOptions 的属性值是否完全一致
 */
export function areOptimizeOptionsEqual(
	a: OptimizeLyricOptions = {},
	b: OptimizeLyricOptions = {},
): boolean {
	const keysA = Object.keys(a) as (keyof OptimizeLyricOptions)[];
	const keysB = Object.keys(b) as (keyof OptimizeLyricOptions)[];
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (a[key] !== b[key]) return false;
	}
	return true;
}

/**
 * 优化歌词行的展示效果
 *
 * 注意会直接原地修改入参，确保你已经提前深克隆了歌词行数组
 * @param lines 歌词行数组
 * @param options 优化的可选配置，除已弃用选项外默认全部开启
 */
export function optimizeLyricLines(
	lines: LyricLine[],
	options?: OptimizeLyricOptions,
): void {
	const config = { ...DEFAULT_OPTIMIZE_OPTIONS, ...options };
	const syncBackgroundLines = config.syncMainAndBackgroundLines ?? true;

	if (config.normalizeSpaces) {
		normalizeSpaces(lines);
	}
	if (config.resetLineTimestamps) {
		resetLineTimestamps(lines);
	}
	convertExcessiveBackgroundLines(lines);
	if (syncBackgroundLines) {
		syncMainAndBackgroundLines(lines);
	}
	sortLyricLines(lines);
	if (config.cleanUnintentionalOverlaps) {
		cleanUnintentionalOverlaps(lines, syncBackgroundLines);
	}
	if (config.tryAdvanceStartTime) {
		tryAdvanceStartTime(lines, syncBackgroundLines);
	}
}
