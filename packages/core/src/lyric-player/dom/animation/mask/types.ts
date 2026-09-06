/**
 * 传递给遮罩模块的单词数据契约
 *
 * 由调用方在完成排版测量后填充，模块内部只读不写
 */
export interface MaskTargetWord {
	readonly word: string;
	readonly startTime: number;
	readonly endTime: number;
	readonly ruby?: ReadonlyArray<{
		readonly word: string;
		readonly startTime: number;
		readonly endTime: number;
	}>;
	readonly mainElement: HTMLElement;
	readonly width: number;
	readonly height: number;
	readonly padding: number;
}

/**
 * 创建遮罩动画时所需的行级上下文快照
 */
export interface MaskContext {
	/**
	 * 当前歌词行的起始时间（毫秒）
	 */
	readonly lineStartTime: number;

	/**
	 * 当前歌词行的结束时间（毫秒）
	 */
	readonly lineEndTime: number;

	/**
	 * 单词渐变遮罩的宽度系数（相对单词高度）
	 */
	readonly wordFadeWidth: number;

	/**
	 * 运行环境是否支持 mask-image
	 *
	 * 决定使用 Web Animations 主方案还是 calc() 回退方案
	 */
	readonly supportMaskImage: boolean;
}

/**
 * 歌词行遮罩动画的调度器
 *
 * 负责遮罩动画的生成与生命周期管理，
 * 外部根据播放进度经由此接口驱动逐词点亮的演出效果
 */
export interface LineMaskAnimator {
	apply(): void;
	/**
	 * @param timeRelative 相对于该歌词行起始时间的相对时间
	 * @param isPlaying 播放器当前是否在播放
	 */
	setCurrentTime(timeRelative: number, isPlaying: boolean): void;
	pause(): void;
	resume(): void;
	dispose(): void;
}
