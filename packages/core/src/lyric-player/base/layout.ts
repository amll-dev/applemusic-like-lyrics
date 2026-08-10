import { LayoutAlignAnchor } from "./consts.ts";

//#region 类型定义
/**
 * 布局对齐的静态配置项
 *
 * 一般很少改变
 */
export interface LayoutConfig {
	/**
	 * 自动对齐的锚点
	 */
	alignAnchor: LayoutAlignAnchor;

	/**
	 * 0.0 - 1.0 的视口相对位置
	 */
	alignPosition: number;

	/**
	 * 视口上下额外保留的预渲染距离，单位为像素
	 */
	overscanPx: number;
}

/**
 * 每一帧都可能变化的排版上下文状态
 */
export interface LayoutFrameContext {
	/**
	 * 播放器容器当前总高度
	 */
	containerHeight: number;

	/**
	 * 被滚动引擎钳制后的安全滚动量
	 */
	scrollOffset: number;

	/**
	 * 当前视口焦点目标
	 */
	target: FocalTarget;

	/**
	 * 底栏高度
	 */
	bottomLineHeight: number;

	/**
	 * 间奏点状态，若当前排版帧无间奏则为 undefined
	 */
	interlude?: {
		/**
		 * 间奏点高度
		 */
		totalHeight: number;
		/**
		 * 间奏点应挂在第几行之后
		 * -1 表示首行上方，0 ~ N-1 表示对应行下方
		 **/
		anchorIndex: number;
	};
}

/**
 * 单行歌词的渲染几何指令
 */
export interface RenderInstruction {
	/**
	 * 当前行歌词的 Y 轴绝对目标坐标
	 */
	y: number;

	/**
	 * 当前行歌词的高
	 *
	 * 可能为测量值或估算值
	 */
	height: number;

	/**
	 * 当前是否在可视区域（含 Overscan 容差）内，用于剔除渲染
	 */
	isInViewport: boolean;
}

/**
 * 排版计算返回的复合结果
 */
export interface LayoutResult {
	/**
	 * 本次排版计算的有效歌词行数
	 */
	lineCount: number;

	/**
	 * 对应所有歌词行的渲染指令池
	 * @remarks 指令池由 LayoutCalculator 复用，遍历时务必以 {@link lineCount} 为界
	 */
	readonly lineInstructions: ReadonlyArray<RenderInstruction>;

	/**
	 * 是否需要显示间奏点
	 */
	hasInterlude: boolean;

	/**
	 * 如果需要显示间奏点，它的 Y 轴绝对坐标
	 */
	interludeY: number;

	/**
	 * 底栏的 Y 轴绝对坐标
	 */
	bottomLineY: number;

	/**
	 * 底栏是否在可视范围内，用于剔除渲染
	 */
	isBottomLineInViewport: boolean;
}

/**
 * 当前对齐的目标类型
 */
export type FocalTargetType = "line" | "interlude" | "bottom";

/**
 * 决定排版原点焦点的目标
 */
export type FocalTarget =
	| { type: "line"; index: number }
	| { type: "interlude"; anchorIndex: number }
	| { type: "bottom" };

type ResolvedLayoutMetrics = {
	isValid: boolean;
	focalTopY: number;
	anchorOffset: number;
	interludeTotalHeight: number;
	activeInterludeAnchor: number | undefined;
};

export type LayoutFrameSession = ResolvedLayoutMetrics & {
	containerHeight: number;
	alignPosition: number;
	overscanPx: number;
	bottomLineHeight: number;
};
//#endregion

export class LayoutCalculator {
	//#region 内部状态
	/**
	 * 前缀和缓存
	 *
	 * 长度为歌词行数 + 1
	 *
	 * prefixSums[i] 存储的是第 0 行到第 i-1 行的总高度，不包含间奏点
	 */
	private prefixSums: Float64Array = new Float64Array(0);

	private heights: Float64Array = new Float64Array(0);
	/**
	 * 使用 Uint8Array 作为掩码，1 表示该行经历了真实测量，0 表示该行在使用 fallback 高度
	 */
	private isMeasured: Uint8Array = new Uint8Array(0);

	/**
	 * 渲染指令对象池
	 *
	 * 长度永远只会增加不会减少，避免 GC
	 */
	private instructionPool: RenderInstruction[] = [];
	private isPrefixSumDirty = true;

	private readonly resolvedMetrics: ResolvedLayoutMetrics = {
		isValid: false,
		focalTopY: 0,
		anchorOffset: 0,
		interludeTotalHeight: 0,
		activeInterludeAnchor: undefined,
	};

	/**
	 * 全局唯一复用的返回结果实例
	 */
	private readonly layoutResult: LayoutResult = {
		lineCount: 0,
		lineInstructions: this.instructionPool,
		bottomLineY: 0,
		isBottomLineInViewport: false,
		hasInterlude: false,
		interludeY: 0,
	};

	/**
	 * 缓存的歌词行数
	 */
	private lyricCount: number = 0;
	/**
	 * 缓存的所有歌词总高度
	 */
	private totalLyricHeight: number = 0;
	//#endregion

	//#region 公共 API
	/**
	 * 初始化排版空间结构与高度缓存
	 *
	 * 在加载新歌词时调用
	 *
	 * @param count 歌词总行数
	 * @param defaultHeight 尚未渲染/测量的行的默认回退高度
	 */
	public initHeights(count: number, defaultHeight: number): void {
		this.lyricCount = count;

		this.resetLayoutResult();

		if (this.prefixSums.length < count + 1) {
			this.prefixSums = new Float64Array(count + 1);
			this.heights = new Float64Array(count);
			this.isMeasured = new Uint8Array(count);
		} else {
			this.prefixSums.fill(0);
		}

		for (let i = 0; i < count; i++) {
			this.heights[i] = defaultHeight;
			this.isMeasured[i] = 0;
		}

		this.isPrefixSumDirty = true;

		const currentPoolSize = this.instructionPool.length;
		if (count > currentPoolSize) {
			for (let i = currentPoolSize; i < count; i++) {
				this.instructionPool.push({
					y: 0,
					height: 0,
					isInViewport: false,
				});
			}
		}
	}

	/**
	 * 获取指定索引歌词行的计算高度
	 * @remarks 可能为测量值或估算值
	 * @param index 歌词行索引
	 */
	public getLineHeight(index: number): number {
		if (index < 0 || index >= this.lyricCount) return 0;
		this.ensurePrefixSums();
		return this.prefixSums[index + 1] - this.prefixSums[index];
	}

	/**
	 * 设置单行歌词的真实测量高度
	 * @param index 歌词行索引
	 * @param height 真实测量的高度
	 */
	public setLineHeight(index: number, height: number): void {
		if (index < 0 || index >= this.lyricCount) return;

		// 只有高度发生变化，或者该行原本是估算值时，才标记脏数据
		if (this.heights[index] !== height || this.isMeasured[index] === 0) {
			this.heights[index] = height;
			this.isMeasured[index] = 1; // 标记为已测量
			this.isPrefixSumDirty = true;
		}
	}

	/**
	 * 批量更新所有未测量行的回退高度
	 *
	 * 仅在容器 Resize 等会导致回退基准（如 containerHeight / 5）发生变化时调用。
	 * 已被真实测量的行不受影响。
	 *
	 * @param defaultHeight 新的默认回退高度
	 */
	public updateUnmeasuredHeights(defaultHeight: number): void {
		let changed = false;
		for (let i = 0; i < this.lyricCount; i++) {
			if (this.isMeasured[i] === 0 && this.heights[i] !== defaultHeight) {
				this.heights[i] = defaultHeight;
				changed = true;
			}
		}
		if (changed) {
			this.isPrefixSumDirty = true;
		}
	}

	/**
	 * 解析焦点度量并计算物理滚动边界
	 *
	 * 返回滚动安全闭区间 `{ min, max }` 以及此帧的生命周期会话句柄 {@link LayoutFrameSession}
	 * 供后续使用 `ScrollInteractionEngine.updateBoundary` 钳制 `scrollOffset` 后传给 {@link commit}
	 *
	 * @param ctx 动态帧上下文，包含当前容器尺寸、焦点目标与底栏高度
	 * @param config 布局静态配置，包含对齐锚点、相对位置与 Overscan 容差
	 */
	public beginFrame(
		ctx: LayoutFrameContext,
		config: LayoutConfig,
	): { bounds: { min: number; max: number }; session: LayoutFrameSession } {
		this.ensurePrefixSums();

		const metrics = this.resolveLayoutMetrics(ctx, config);

		const session: LayoutFrameSession = {
			...metrics,
			containerHeight: ctx.containerHeight,
			alignPosition: config.alignPosition,
			overscanPx: config.overscanPx,
			bottomLineHeight: ctx.bottomLineHeight,
		};

		if (!metrics.isValid) {
			return { bounds: { min: 0, max: 0 }, session };
		}

		const {
			focalTopY,
			anchorOffset,
			interludeTotalHeight,
			activeInterludeAnchor,
		} = metrics;

		const minOffset = Math.min(0, -focalTopY);

		const basePosWithoutScroll =
			-focalTopY + ctx.containerHeight * config.alignPosition - anchorOffset;

		let totalContentHeight = this.totalLyricHeight;
		if (activeInterludeAnchor !== undefined) {
			totalContentHeight += interludeTotalHeight;
		}

		const rawMaxOffset =
			basePosWithoutScroll + totalContentHeight - ctx.containerHeight / 2;
		const maxOffset = Math.max(0, rawMaxOffset);

		return { bounds: { min: minOffset, max: maxOffset }, session };
	}

	/**
	 * 基于已钳制的 `scrollOffset` 和第一阶段的 {@link LayoutFrameSession} 提交排版并生成指令
	 *
	 * @param session 由 {@link beginFrame} 生成的单帧排版会话
	 * @param scrollOffset 经过边界钳制后的安全滚动偏移量
	 *
	 * @returns 复用的排版结果实例 {@link LayoutResult}
	 */
	public commit(
		session: LayoutFrameSession,
		scrollOffset: number,
	): LayoutResult {
		this.ensurePrefixSums();

		if (!session.isValid) {
			return this.resetLayoutResult();
		}

		this.layoutResult.lineCount = this.lyricCount;

		const {
			focalTopY,
			anchorOffset,
			interludeTotalHeight,
			activeInterludeAnchor,
			containerHeight,
			alignPosition,
			overscanPx,
			bottomLineHeight,
		} = session;

		const viewportStartY =
			containerHeight * alignPosition - anchorOffset - scrollOffset - focalTopY;

		const motionBuffer = containerHeight * 0.4;
		const viewportTopBound = -overscanPx - motionBuffer;
		const viewportBottomBound = containerHeight + overscanPx + motionBuffer;

		for (let i = 0; i < this.lyricCount; i++) {
			const instruction = this.instructionPool[i];
			let lineY = viewportStartY + this.prefixSums[i];
			const lineH = this.prefixSums[i + 1] - this.prefixSums[i];

			if (activeInterludeAnchor !== undefined && i > activeInterludeAnchor) {
				lineY += interludeTotalHeight;
			}

			instruction.y = lineY;
			instruction.height = lineH;
			instruction.isInViewport =
				lineY <= viewportBottomBound && lineY + lineH >= viewportTopBound;
		}

		if (activeInterludeAnchor !== undefined) {
			this.layoutResult.hasInterlude = true;
			this.layoutResult.interludeY =
				viewportStartY + this.prefixSums[activeInterludeAnchor + 1];
		} else {
			this.layoutResult.hasInterlude = false;
			this.layoutResult.interludeY = 0;
		}

		let bottomY = viewportStartY + this.totalLyricHeight;
		if (activeInterludeAnchor !== undefined) {
			bottomY += interludeTotalHeight;
		}

		this.layoutResult.bottomLineY = bottomY;
		this.layoutResult.isBottomLineInViewport =
			bottomY <= viewportBottomBound &&
			bottomY + bottomLineHeight >= viewportTopBound;

		return this.layoutResult;
	}
	//#endregion

	//#region 工具方法
	/**
	 * 解析当前排版帧所对应的间奏点挂载锚点行索引
	 *
	 * @param interlude 当前时间线处于激活状态的间奏点信息
	 * @param focalTarget 当前帧对齐的物理焦点
	 */
	public static resolveInterludeAnchorIndex(
		interlude: { anchorLineIndex: number } | undefined,
		focalTarget: FocalTarget,
	): number | undefined {
		// 若处于间奏时间段内，优先使用活跃间奏的锚点行
		if (interlude) {
			return interlude.anchorLineIndex;
		}

		// 若用户正处于手势滑动中且焦点被冻结在间奏点，保持冻结焦点的锚点行
		if (focalTarget.type === "interlude") {
			return focalTarget.anchorIndex;
		}
		return undefined;
	}

	/**
	 * 如果高度发生过改变，则重新计算前缀和
	 */
	private ensurePrefixSums(): void {
		if (!this.isPrefixSumDirty) return;

		let sum = 0;
		this.prefixSums[0] = 0;
		for (let i = 0; i < this.lyricCount; i++) {
			sum += this.heights[i];
			this.prefixSums[i + 1] = sum;
		}
		this.totalLyricHeight = sum;
		this.isPrefixSumDirty = false;
	}

	/**
	 * 公共的焦点度量与范围校验逻辑
	 */
	private resolveLayoutMetrics(
		ctx: LayoutFrameContext,
		config: LayoutConfig,
	): ResolvedLayoutMetrics {
		const interludeTotalHeight = ctx.interlude?.totalHeight ?? 0;
		const activeInterludeAnchor = ctx.interlude?.anchorIndex;

		this.resolvedMetrics.interludeTotalHeight = interludeTotalHeight;
		this.resolvedMetrics.activeInterludeAnchor = activeInterludeAnchor;

		if (
			this.lyricCount === 0 ||
			(ctx.target.type === "line" &&
				(ctx.target.index < 0 || ctx.target.index >= this.lyricCount)) ||
			(ctx.target.type === "interlude" &&
				(ctx.target.anchorIndex < -1 ||
					ctx.target.anchorIndex >= this.lyricCount - 1))
		) {
			this.resolvedMetrics.isValid = false;
			this.resolvedMetrics.focalTopY = 0;
			this.resolvedMetrics.anchorOffset = 0;
			return this.resolvedMetrics;
		}

		this.updateFocalMetrics(
			ctx.target,
			interludeTotalHeight,
			activeInterludeAnchor,
			ctx.bottomLineHeight,
			config,
		);

		this.resolvedMetrics.isValid = true;
		return this.resolvedMetrics;
	}

	/**
	 * 测量对齐目标的几何信息
	 */
	private updateFocalMetrics(
		target: FocalTarget,
		interludeTotalHeight: number,
		activeInterludeAnchor: number | undefined,
		bottomLineHeight: number,
		config: LayoutConfig,
	): void {
		let focalTopY = 0;
		let targetHeight = 0;

		if (target.type === "line") {
			focalTopY = this.prefixSums[target.index];
			// 如果这行歌词前面存在间奏点，那么这行歌词已经被间奏点往下推了，需要加上 interludeTotalHeight
			if (
				activeInterludeAnchor !== undefined &&
				target.index > activeInterludeAnchor
			) {
				focalTopY += interludeTotalHeight;
			}
			targetHeight =
				this.prefixSums[target.index + 1] - this.prefixSums[target.index];
		} else if (target.type === "interlude") {
			focalTopY = this.prefixSums[target.anchorIndex + 1];
			targetHeight = interludeTotalHeight;
		} else if (target.type === "bottom") {
			focalTopY = this.totalLyricHeight;
			if (activeInterludeAnchor !== undefined) {
				focalTopY += interludeTotalHeight;
			}
			targetHeight = bottomLineHeight;
		}

		this.resolvedMetrics.focalTopY = focalTopY;
		this.resolvedMetrics.anchorOffset = this.calculateAnchorOffset(
			config.alignAnchor,
			targetHeight,
		);
	}

	/**
	 * 根据锚点与目标高度计算内部相对偏移
	 */
	private calculateAnchorOffset(
		alignAnchor: LayoutAlignAnchor,
		targetHeight: number,
	): number {
		if (targetHeight <= 0) return 0;

		switch (alignAnchor) {
			case LayoutAlignAnchor.Top:
				return 0;
			case LayoutAlignAnchor.Center:
				return targetHeight / 2;
			case LayoutAlignAnchor.Bottom:
				return targetHeight;
		}

		const exhaustiveCheck: never = alignAnchor;
		return exhaustiveCheck;
	}

	/**
	 * 重置排版结果为安全干净的状态（全部不可见/无底栏）
	 */
	private resetLayoutResult(): LayoutResult {
		this.layoutResult.lineCount = 0;
		this.layoutResult.hasInterlude = false;
		this.layoutResult.interludeY = 0;
		this.layoutResult.bottomLineY = 0;
		this.layoutResult.isBottomLineInViewport = false;

		for (let i = 0; i < this.instructionPool.length; i++) {
			this.instructionPool[i].isInViewport = false;
			this.instructionPool[i].y = 0;
			this.instructionPool[i].height = 0;
		}

		return this.layoutResult;
	}
	//#endregion
}
