/**
 * 词内注音的碰撞撑开
 *
 * 注音层零宽、不参与整词计宽，宽假名会溢出到相邻字上；
 * 按实测几何把相撞的单词退回整词计宽，未相撞的保持紧凑。
 */
import styles from "#styles/lyric-player.module.css";

/** 相邻假名之间保留的最小间距（像素） */
const MIN_GAP = 0.5;

/** 碰撞撑开的最大轮次，撑开引发的重新换行需额外轮次复核 */
const MAX_PASSES = 3;

/** 参与注音排版的单词 */
export interface RubySpacedWord {
	/** 单词外层元素，撑开标记挂在该元素上 */
	mainElement: HTMLElement;
	/** 注音容器，仅含注音的单词存在 */
	rubyElement?: HTMLElement;
}

/** 注音假名的占位区间 */
export interface RubyBand {
	/** 左边界 */
	left: number;
	/** 右边界 */
	right: number;
	/** 上边界 */
	top: number;
	/** 下边界 */
	bottom: number;
}

/** 单词的注音排版状态 */
interface RubyWord {
	/** 单词外层元素，撑开标记挂在该元素上 */
	element: HTMLElement;
	/** 注音容器，假名以零宽子元素向两侧溢出 */
	annotationBox: HTMLElement;
	/** 是否已退回整词计宽 */
	spaced: boolean;
}

/**
 * 找出与其它占位相交的占位下标，占位需按 left 升序传入
 * @param bands - 同一行内的注音假名占位区间
 * @returns 发生碰撞的占位下标
 */
export const findRubyCollisions = (bands: RubyBand[]) => {
	const collided = new Set<number>();
	for (let i = 0; i < bands.length; i++) {
		const current = bands[i];
		// 已按 left 升序，首个不再横向交叠的占位之后都不会与当前相交
		for (
			let j = i + 1;
			j < bands.length && bands[j].left < current.right - MIN_GAP;
			j++
		) {
			if (current.top < bands[j].bottom && bands[j].top < current.bottom) {
				collided.add(i);
				collided.add(j);
			}
		}
	}
	return collided;
};

/**
 * 合并词内假名的实测占位区间
 * @param word - 注音单词
 * @returns 占位区间，量不到有效尺寸（如未挂载）时为 undefined
 */
const readBand = (word: RubyWord): RubyBand | undefined => {
	let left = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	for (const part of word.annotationBox.children) {
		const rect = part.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) continue;
		left = Math.min(left, rect.left);
		right = Math.max(right, rect.right);
		top = Math.min(top, rect.top);
		bottom = Math.max(bottom, rect.bottom);
	}
	if (left >= right || top >= bottom) return undefined;
	return { left, right, top, bottom };
};

/**
 * 逐轮量测并撑开假名相撞的单词，撑开只会把同行后续内容推远，逐轮复核即可收敛
 * @param words - 行内的单词，按文档顺序传入
 */
export const applyRubyCollisionSpacing = (words: RubySpacedWord[]): void => {
	const targets: RubyWord[] = [];
	// 先回到紧凑态再量，避免上一次判定留下的撑开量掩盖本次的碰撞
	for (const word of words) {
		if (!word.rubyElement) continue;
		word.mainElement.classList.remove(styles.rubySpaced);
		targets.push({
			element: word.mainElement,
			annotationBox: word.rubyElement,
			spaced: false,
		});
	}
	if (targets.length < 2) return;

	for (let pass = 0; pass < MAX_PASSES; pass++) {
		const entries: { band: RubyBand; word: RubyWord }[] = [];
		for (const word of targets) {
			const band = readBand(word);
			if (band) entries.push({ band, word });
		}
		entries.sort((a, b) => a.band.left - b.band.left);

		let changed = false;
		for (const index of findRubyCollisions(
			entries.map((entry) => entry.band),
		)) {
			const word = entries[index].word;
			if (word.spaced) continue;
			word.spaced = true;
			word.element.classList.add(styles.rubySpaced);
			changed = true;
		}
		if (!changed) return;
	}
};
