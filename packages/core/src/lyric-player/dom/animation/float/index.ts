import type { LyricWord } from "#interfaces";

/**
 * 上浮动画的配置选项
 */
export interface FloatAnimationOptions {
	/**
	 * 当前绑定的歌词单词数据，用于计算动画的时长与绝对起始时间
	 */
	word: LyricWord;

	/**
	 * 当前单词所在歌词行的起始时间（毫秒），用于计算该单词动画的相对延迟时间
	 */
	lineStartTime: number;

	/**
	 * 是否为背景歌词行
	 *
	 * 背景歌词行的上浮位移幅度是主歌词行的两倍
	 */
	isBG: boolean;
}

/**
 * 创建常规歌词单词的上浮动画
 *
 * 基于 Web Animations API 实现，动画会使传入的单词元素产生一个轻微向上平移的效果
 *
 * 创建后的动画默认处于暂停状态，外部需要根据播放进度进行调度
 *
 * @param wordEl - 需要应用上浮动画的歌词单词 DOM 元素
 * @param options - 动画相关的上下文配置选项
 * @returns 一个处于暂停状态的 {@link Animation} 对象
 */
export function createFloatAnimation(
	wordEl: HTMLElement,
	options: FloatAnimationOptions,
): Animation {
	const { word, lineStartTime, isBG } = options;

	const delay = word.startTime - lineStartTime;
	const duration = Math.max(1000, word.endTime - word.startTime);

	let up = 0.05;
	if (isBG) {
		up *= 2;
	}

	const a = wordEl.animate(
		[{ transform: "translateY(0px)" }, { transform: `translateY(${-up}em)` }],
		{
			duration: Number.isFinite(duration) ? duration : 0,
			delay: Number.isFinite(delay) ? delay : 0,
			id: "float-word",
			composite: "add",
			fill: "both",
			easing: "ease-out",
		},
	);

	a.pause();
	return a;
}
