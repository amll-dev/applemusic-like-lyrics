import type { LyricWord } from "../interfaces.ts";
import { isCJK } from "./is-cjk.ts";

const SPLIT_WHITESPACE_RE = /(\s+)/;
const WHITESPACE_RE = /\s/g;

/**
 * 用于按 Unicode 字素簇拆分文本的分词器
 *
 * CJK 文本内部仍可能存在组合字符（如日文假名加浊点、代理对表示的扩展区汉字、
 * 变体选择符序列等），必须作为整体保留，否则浏览器无法正确塑形，
 * 会渲染出虚线圆圈等错误字形。
 *
 * 注意：不支持 Intl.Segmenter 的旧环境会回退到按码点拆分，
 * 此时代理对不会被拆散，但假名浊点等组合序列仍可能被分开。
 */
const graphemeSegmenter: Intl.Segmenter | null =
	typeof Intl !== "undefined" && Intl.Segmenter
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: null;

/**
 * 按字素簇（Grapheme Cluster）拆分字符串
 * @param text 待拆分的字符串
 * @returns 拆分后的字素簇数组
 */
function splitGraphemes(text: string): string[] {
	if (graphemeSegmenter) {
		return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
	}
	// 回退到按码点拆分，至少不会拆散代理对
	return Array.from(text);
}

/**
 * 将输入的单词重新分组，之间没有空格的单词将会组合成一个单词数组
 *
 * 例如输入：`["Life", " ", "is", " a", " su", "gar so", "sweet"]`
 *
 * 应该返回：`["Life", " ", "is", " a", [" su", "gar"], "so", "sweet"]`
 * @param words 输入的单词数组
 * @returns 重新分组后的单词数组
 */
export function chunkAndSplitLyricWords(
	words: LyricWord[],
): (LyricWord | LyricWord[])[] {
	const result: (LyricWord | LyricWord[])[] = [];
	let currentGroup: LyricWord[] = [];

	const flushGroup = () => {
		if (currentGroup.length > 0) {
			result.push(
				currentGroup.length === 1 ? currentGroup[0] : [...currentGroup],
			);
			currentGroup = [];
		}
	};

	const processAtom = (atom: LyricWord) => {
		const isSpace = atom.word.trim().length === 0;
		const hasRuby = (atom.ruby?.length ?? 0) > 0;
		const isCJKChar = isCJK(atom.word);

		const isMergeable = !isSpace && !hasRuby && !isCJKChar;

		if (isMergeable) {
			currentGroup.push(atom);
		} else {
			flushGroup();
			result.push(atom);
		}
	};

	for (const w of words) {
		const content = w.word.trim();
		const isSpace = content.length === 0;
		const romanWord = w.romanWord ?? "";
		const obscene = w.obscene ?? false;
		const hasRuby = (w.ruby?.length ?? 0) > 0;

		if (isSpace) {
			processAtom({ ...w, obscene });
			continue;
		}

		if (hasRuby) {
			const leadingSpaceMatch = w.word.match(/^\s+/);
			const trailingSpaceMatch = w.word.match(/\s+$/);
			const leadingSpace = leadingSpaceMatch ? leadingSpaceMatch[0] : "";
			const trailingSpace = trailingSpaceMatch ? trailingSpaceMatch[0] : "";

			if (leadingSpace) {
				processAtom({
					word: leadingSpace,
					romanWord: "",
					startTime: w.startTime,
					endTime: w.startTime,
					obscene: obscene,
				});
			}

			processAtom({
				...w,
				word: content,
				obscene: obscene,
			});

			if (trailingSpace) {
				processAtom({
					word: trailingSpace,
					romanWord: "",
					startTime: w.endTime,
					endTime: w.endTime,
					obscene: obscene,
				});
			}
			continue;
		}

		const parts = w.word.split(SPLIT_WHITESPACE_RE).filter((p) => p.length > 0);

		const totalLength = w.word.replace(WHITESPACE_RE, "").length || 1;
		const timeSpan = w.endTime - w.startTime;
		const timePerUnit = timeSpan / totalLength;

		const wordParts = w.word
			.trim()
			.split(/\s+/)
			.filter((p) => p.length > 0);
		const romanTrimmed = romanWord.trim();
		const romanParts =
			romanTrimmed.length > 0
				? romanTrimmed.split(/\s+/).filter((p) => p.length > 0)
				: [];
		const isMatched =
			wordParts.length > 0 && wordParts.length === romanParts.length;

		let currentOffset = 0;
		let nonSpaceIndex = 0;

		for (const part of parts) {
			if (!part.trim()) {
				const startTime = w.startTime + currentOffset * timePerUnit;
				processAtom({
					word: part,
					romanWord: "",
					startTime: startTime,
					endTime: startTime,
					obscene: obscene,
				});
				continue;
			}

			let partRomanWord = "";
			if (romanParts.length > 0) {
				if (isMatched) {
					partRomanWord = romanParts[nonSpaceIndex] ?? "";
				} else if (nonSpaceIndex === 0) {
					partRomanWord = romanWord;
				}
			}
			nonSpaceIndex++;

			if (isCJK(part) && part.length > 1 && romanTrimmed.length === 0) {
				const graphemes = splitGraphemes(part);
				for (const grapheme of graphemes) {
					const startTime = w.startTime + currentOffset * timePerUnit;
					processAtom({
						word: grapheme,
						romanWord: "",
						startTime: startTime,
						endTime: startTime + grapheme.length * timePerUnit,
						obscene: obscene,
					});
					currentOffset += grapheme.length;
				}
			} else {
				const partRealLen = part.length;
				const startTime = w.startTime + currentOffset * timePerUnit;
				const duration = partRealLen * timePerUnit;

				processAtom({
					word: part,
					romanWord: partRomanWord,
					startTime: startTime,
					endTime: startTime + duration,
					obscene: obscene,
				});
				currentOffset += partRealLen;
			}
		}
	}

	flushGroup();

	return result;
}
