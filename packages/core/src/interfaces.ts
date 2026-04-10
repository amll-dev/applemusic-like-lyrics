/**
 * 拥有一个 HTML 元素的接口
 *
 * 可以通过 `getElement` 获取这个类所对应的 HTML 元素实例
 */
export interface HasElement {
	/** 获取这个类所对应的 HTML 元素实例 */
	getElement(): HTMLElement;
}

/**
 * 实现了这个接口的东西需要在使用完毕后
 *
 * 手动调用 `dispose` 函数来销毁清除占用资源
 *
 * 以免产生泄露
 */
export interface Disposable {
	/**
	 * 销毁实现了该接口的对象实例，释放占用的资源
	 *
	 * 一般情况下，调用本函数后就不可以再调用对象的任何函数了
	 */
	dispose(): void;
}

/** 一个歌词单词 */
export interface LyricWordBase {
	/** 单词的起始时间，单位为毫秒 */
	startTime: number;
	/** 单词的结束时间，单位为毫秒 */
	endTime: number;
	/** 单词内容 */
	word: string;
}

export interface LyricWord extends LyricWordBase {
	/** 单词的音译内容 */
	romanWord?: string;
	/** 单词内容是否包含冒犯性的不雅用语 */
	obscene?: boolean;
	/** 单词的注音内容 */
	ruby?: LyricWordBase[];
}

/** 一行歌词，存储多个单词 */
export interface LyricLine {
	/**
	 * 该行的所有单词
	 * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词且通常其始末时间和本结构的 `startTime` 和 `endTime` 相同
	 */
	words: LyricWord[];
	/** 该行的翻译歌词，将会显示在主歌词行的下方 */
	translatedLyric: string;
	/** 该行的音译歌词，将会显示在翻译歌词行的下方 */
	romanLyric: string;
	/** 句子的起始时间，单位为毫秒 */
	startTime: number;
	/** 句子的结束时间，单位为毫秒 */
	endTime: number;
	/** 该行是否为背景歌词行，当该行歌词的上一句非背景歌词被激活时，这行歌词将会显示出来，注意每个非背景歌词下方只能拥有一个背景歌词 */
	isBG: boolean;
	/** 该行是否为对唱歌词行（即歌词行靠右对齐） */
	isDuet: boolean;
}

/**
 * 优化歌词行的配置选项
 */
export interface OptimizeLyricOptions {
	/**
	 * 规范化歌词中的空格
	 *
	 * 将多个连续空格替换为一个空格
	 * @default true
	 */
	normalizeSpaces?: boolean;
	/**
	 * 是否将行级时间戳强行设为字级时间戳
	 * @default true
	 */
	resetLineTimestamps?: boolean;
	/**
	 * 把多行背景人声转换为单行背景人声 + 主歌词行的形式
	 * @default true
	 */
	convertExcessiveBackgroundLines?: boolean;
	/**
	 * 是否同步主歌词与背景人声的时间
	 * @default true
	 */
	syncMainAndBackgroundLines?: boolean;
	/**
	 * 清洗非刻意的重叠，以免不必要的多行高亮效果
	 *
	 * 如果两行时间轴有重叠的歌词满足下列条件之一：
	 * * 重叠小于 100ms
	 * * 重叠时长不足下一行时长的 10%
	 *
	 * 则截断上一行歌词的结束时间为下一行歌词的开始时间
	 * @default true
	 */
	cleanUnintentionalOverlaps?: boolean;
	/**
	 * 尝试让歌词提前最多 1 秒开始
	 *
	 * 有重叠则尝试最多提前 400ms 或上一行时长的 30%
	 * @default true
	 */
	tryAdvanceStartTime?: boolean;
}
