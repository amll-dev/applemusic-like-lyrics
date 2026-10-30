import { isCJK } from "./is-cjk.ts";

export interface ChildNodeInfo {
	width: number;
	text: string;
	isSpace: boolean;
}

/**
 * 单个词超过容器宽度时的大惩罚倍数
 */
const OVERFLOW_PENALTY_MULTIPLIER = 1000;
/**
 * 截断 CJK 词组边界的惩罚比例
 *
 * 相对于容器宽度
 */
const CJK_BREAK_PENALTY_RATIO = 0.15;
/**
 * 截断普通文本（非空格、非 CJK 词界）的惩罚比例
 */
const NORMAL_BREAK_PENALTY_RATIO = 0.5;
/**
 * 在缩略词附近断开的大惩罚比例
 */
const ABBREVIATION_BREAK_PENALTY_RATIO = 1;
/**
 * 在空格处断开的奖励比例
 */
const SPACE_BREAK_REWARD_RATIO = 0.4;
/**
 * 在标点符号处断开的奖励比例
 *
 * 比空格更高以便优先一点在标点处换行
 */
const PUNCTUATION_BREAK_REWARD_RATIO = 0.6;
const PUNCTUATION_REGEX = /[,;:!?，。；：！？、）】》」』’”)[\]}>~…]$/;
const ABBREVIATION_STEM_REGEX =
	/\b(?:Mr|Ms|Mrs|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K)$/i;
const INITIAL_STEM_REGEX = /\b[A-Z]$/;

/**
 * 计算平均行长度的断点位置
 * @param children 子节点信息
 * @param containerWidth 容器可用内容宽度
 * @param fullText 完整的行文本
 * @param segmenter 预创建的 Intl.Segmenter 分词器
 * @returns 需要在其前面插入 `<br>` 的子节点索引数组，升序
 */
export function calcBalancedBreaks(
	children: ChildNodeInfo[],
	containerWidth: number,
	fullText: string,
	segmenter: Intl.Segmenter,
): number[] {
	const n = children.length;
	if (n === 0 || containerWidth <= 0) {
		return [];
	}

	// 计算哪里是 CJK 词组的边界
	const cjkBoundaries = new Set<number>();
	let offset = 0;
	for (const { segment, isWordLike } of segmenter.segment(fullText)) {
		if (offset > 0 && isWordLike) {
			if ([...segment].some((ch) => isCJK(ch))) {
				cjkBoundaries.add(offset);
			}
		}
		offset += segment.length;
	}

	// 计算前缀宽和字符偏移量用于快速查询
	const charOffsets = new Int32Array(n + 1);
	const prefixWidth = new Float64Array(n + 1);
	for (let i = 0; i < n; i++) {
		charOffsets[i + 1] = charOffsets[i] + children[i].text.length;
		prefixWidth[i + 1] = prefixWidth[i] + children[i].width;
	}

	if (prefixWidth[n] <= containerWidth) {
		return [];
	}

	/**
	 * dp[i] 表示将 index i 到 n-1 的节点进行排版的最小代价
	 */
	const dp = new Float64Array(n + 1).fill(Number.POSITIVE_INFINITY);
	const nextBreak = new Int32Array(n + 1).fill(-1);
	dp[n] = 0;

	const PENALTY_CJK = (containerWidth * CJK_BREAK_PENALTY_RATIO) ** 2;
	const PENALTY_NORMAL = (containerWidth * NORMAL_BREAK_PENALTY_RATIO) ** 2;
	const PENALTY_ABBREVIATION =
		(containerWidth * ABBREVIATION_BREAK_PENALTY_RATIO) ** 2;

	// 不同粒度可能把缩略词和句点合并或拆开，因此要从全文上下文同时保护
	// 词干与句点之间、句点之后、句点后的空格之后这三处候选断点。
	// 只加大惩罚而不硬排除，以保留容器极窄、单词超宽时的断行兜底。
	const abbreviationBreaks = new Set<number>();
	for (let j = 1; j < n; j++) {
		const offset = charOffsets[j];
		const beforeBreak = fullText.slice(0, offset);
		const stem = beforeBreak.replace(/\.\s*$/, "");
		const hasPeriod = stem !== beforeBreak || fullText[offset] === ".";
		if (
			hasPeriod &&
			(ABBREVIATION_STEM_REGEX.test(stem) || INITIAL_STEM_REGEX.test(stem))
		) {
			abbreviationBreaks.add(j);
		}
	}

	for (let i = n - 1; i >= 0; i--) {
		for (let j = i + 1; j <= n; j++) {
			const w = prefixWidth[j] - prefixWidth[i];

			let lineCost = 0;

			if (w > containerWidth) {
				if (j === i + 1) {
					// 单个无法分割的词自身就比容器宽，被迫独立成行，给大惩罚
					lineCost = (w - containerWidth) ** 2 * OVERFLOW_PENALTY_MULTIPLIER;
				} else {
					// 行内包含多个超过物理宽度的词就跳过
					continue;
				}
			} else {
				// 迫使所有行的长度方差最小化
				lineCost = (containerWidth - w) ** 2;
			}

			let breakPenalty = 0;
			if (j < n) {
				const prevChild = children[j - 1];

				// 优先级：缩略词保护 > 标点 > 空格 > CJK 词界 > 普通文本
				if (abbreviationBreaks.has(j)) {
					breakPenalty = PENALTY_ABBREVIATION;
				} else if (PUNCTUATION_REGEX.test(prevChild.text)) {
					breakPenalty = -(
						(containerWidth * PUNCTUATION_BREAK_REWARD_RATIO) **
						2
					);
				} else if (prevChild.isSpace) {
					breakPenalty = -((containerWidth * SPACE_BREAK_REWARD_RATIO) ** 2);
				} else if (cjkBoundaries.has(charOffsets[j])) {
					breakPenalty = PENALTY_CJK;
				} else {
					breakPenalty = PENALTY_NORMAL;
				}
			}

			const totalCost = lineCost + breakPenalty + dp[j];

			if (totalCost < dp[i]) {
				dp[i] = totalCost;
				nextBreak[i] = j;
			}
		}
	}

	const breaks: number[] = [];
	let curr = 0;
	while (curr < n) {
		curr = nextBreak[curr];
		if (curr > 0 && curr < n) {
			breaks.push(curr);
		}
	}

	return breaks;
}
