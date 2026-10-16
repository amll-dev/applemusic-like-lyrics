/**
 * 注音悬挂判定
 *
 * 注音长于基字时，规范的处理方式是让基字间距随注音一同展开，浏览器原生
 * `<ruby>` 即按此实现。展开会在必带注音的汉字两侧留下空白，而 JLReq §4067
 * 允许注音悬挂到相邻的假名之上，因此仅在左右相邻字符属于可悬挂字符类时
 * 才让注音退出整词计宽。判定只依赖歌词文本，不涉及任何布局测量。
 */
import type { LyricWord } from "#interfaces";

/** 長音符（cl-10），Unicode Script 归为 Common，不在假名脚本范围内 */
const CHOONPU = /[\u30FC\uFF70]/u;

/**
 * 判断相邻字符能否承接悬挂过来的假名
 *
 * §4067 允许悬挂到平假名（cl-15）、片假名（cl-16）、長音符（cl-10）与促音拗音
 * 等小字符（cl-11）上；悬挂到汉字上会被误读为该汉字的读音，故不允许。拉丁字母、
 * 数字与标点同样按不允许处理，空白本身即是可用间距，予以允许。
 * @param char - 相邻单元靠近本词一侧的字符
 * @returns 是否可承接悬挂
 */
function isHangableChar(char: string | undefined): boolean {
	if (char === undefined) return false;
	if (/\s/u.test(char)) return true;
	return (
		CHOONPU.test(char) || /\p{Script=Hiragana}|\p{Script=Katakana}/u.test(char)
	);
}

/** 按渲染顺序展开的判定单元 */
interface RubyAtom {
	word: LyricWord;
	text: string;
	rubyLength: number;
}

/**
 * 注音单侧悬挂所需的间距，以基字字号的 em 计
 *
 * 注音字号为 0.5em，假名与汉字均按全角计，故注音总宽为字符数的一半，
 * 超出基字的部分均摊到两侧。
 * @param atom - 判定单元
 */
function overflowPerSide(atom: RubyAtom): number {
	const base = Array.from(atom.text).length;
	return Math.max(0, (atom.rubyLength * 0.5 - base) / 2);
}

/**
 * 判断相邻单元能否承接悬挂
 *
 * 相邻单元自身的注音也会溢出时，两段注音将直接相接，按 §4067 附注保留间距。
 * @param atom - 相邻单元，位于行界时为空
 * @param char - 相邻单元靠近本词一侧的字符
 */
function canReceiveHang(
	atom: RubyAtom | undefined,
	char: string | undefined,
): boolean {
	if (atom === undefined || char === undefined) return false;
	return isHangableChar(char) && overflowPerSide(atom) === 0;
}

/**
 * 沿一侧向外检查悬挂所需的间距能否全部落在可承接的字符上
 *
 * 即使估算不出溢出也仍要求相邻字符可承接：字符数估算偏保守，实际字体度量略宽时
 * 宁可退回撑开，也不让假名压到汉字上。
 * @param atoms - 按渲染顺序排列的判定单元
 * @param index - 本词在 atoms 中的下标
 * @param step - 检查方向，向左为 `-1`、向右为 `1`
 */
function canHangTowards(
	atoms: readonly RubyAtom[],
	index: number,
	step: number,
): boolean {
	let need = overflowPerSide(atoms[index]);
	for (let i = index + step; ; i += step) {
		const neighbor = atoms[i];
		if (!canReceiveHang(neighbor, neighbor?.text.at(step > 0 ? 0 : -1))) {
			return false;
		}
		need -= Array.from(neighbor.text).length;
		if (need <= 0) return true;
	}
}

/**
 * 计算每个带注音单词能否让假名向两侧悬挂
 *
 * 悬挂所需的空间由注音与基字的字符数估算，向外逐单元核对：途经的字符须均属可悬挂
 * 字符类（§4067 禁止悬挂到汉字上）、自身注音不得溢出（§4067 附注建议相邻两段注音
 * 之间保留约 1em 间距），且不得越过行界（注音不得越出血界）。判定只依赖整行文本，
 * 词在何处折行尚不可知，因此行界只覆盖整行的两端。
 * @param chunkedWords - `chunkAndSplitLyricWords` 的输出，按渲染顺序排列
 * @returns 带注音单词到悬挂标记的映射
 */
export function resolveRubyHangMap(
	chunkedWords: readonly (LyricWord | LyricWord[])[],
): Map<LyricWord, boolean> {
	const atoms: RubyAtom[] = [];
	for (const chunk of chunkedWords) {
		for (const word of Array.isArray(chunk) ? chunk : [chunk]) {
			const ruby = word.ruby ?? [];
			atoms.push({
				word,
				text: word.word,
				rubyLength: ruby.reduce(
					(total, seg) => total + Array.from(seg.word.trim()).length,
					0,
				),
			});
		}
	}

	const hangMap = new Map<LyricWord, boolean>();
	atoms.forEach((atom, index) => {
		if (atom.rubyLength === 0) return;
		hangMap.set(
			atom.word,
			canHangTowards(atoms, index, -1) && canHangTowards(atoms, index, 1),
		);
	});
	return hangMap;
}
