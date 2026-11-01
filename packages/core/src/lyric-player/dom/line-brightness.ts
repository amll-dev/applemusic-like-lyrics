import type { Disposable } from "#interfaces";
import styles from "#styles/lyric-player.module.css";

//#region 类型定义
/**
 * 副本定位所需的几何偏移属性，基于原件自身的边框盒（Border Box）计算得出
 */
interface Geometry {
	readonly top: string;
	readonly left: string;
	readonly right: string;
}
//#endregion

/**
 * 高亮状态结束后的副本最小保留时长（毫秒）。
 *
 * 该时长必须不小于 CSS 交叉淡入动画的时长（0.45 秒），以防止退出时的淡出过渡被提前截断。
 * 计时基准为该行退出高亮状态的时刻。
 */
const BRIGHTNESS_SETTLE_MS = 500;

/**
 * 歌词行的亮度层（主行）与均匀暗层副本（副本）。
 *
 * 为提高性能，避免浏览器逐帧为每个词重新光栅化渐变遮罩，逐词遮罩的渐变色标固定为 1 / 0.4。
 * 整行的明暗交替完全由两个图层各自的 `opacity` 共同呈现，无需逐帧修改遮罩属性。具体分工如下：
 * 1. 亮层（原件）保留逐词遮罩，仅用于表达逐词擦除过程中的明暗对比度。
 * 2. 副本移除遮罩，呈现均匀一致的静息态外观。
 *
 * 两者通过各自的不透明度交叉淡入并叠加，其合成结果在数学上等价于两个 `opacity` 的线性组合，
 * 能完全交由合成器线程进行硬件加速。
 *
 * 副本采用绝对定位，不参与文档流布局与尺寸测量，其生命周期由活跃窗口（焦点行与高亮行附近）限定。
 * 定位时直接将原件的内边距与外边距映射为四向偏移约束，无需依赖外部几何常量，
 * 即可使副本盒由浏览器自动求解并与原件边框盒严格重合。
 */
export class LineBrightness implements Disposable {
	//#region 内部状态
	private dim?: HTMLElement;
	/**
	 * 副本定位所需的几何参数缓存。
	 *
	 * 在歌词行构建流程中，于样式解析完成的当帧提前写入缓存，避免克隆副本时重复调用
	 * `getComputedStyle` 触发强制同步布局。
	 *
	 * 当发生尺寸变更时，尺寸监听回调会触发遮罩重建流程，该几何缓存亦随之同步更新。
	 */
	private geometry?: Geometry;

	/** requestAnimationFrame 回调句柄，用于延迟解除过渡压制 */
	private transitionRestore?: number;

	/** 当前行是否处于亮度层活跃窗口内，由排版逻辑在状态变更时下发 */
	private inWindow = true;

	/** 该行退出高亮状态的时刻，用于确保副本保留足够的时长以完成淡出过渡 */
	private highlightExitedAt = 0;

	/** 正在运行的淡入激活补间动画句柄 */
	private dimAnimation?: Animation;
	private mainAnimation?: Animation;

	/** 该实例是否已彻底销毁 */
	private isDisposed = false;
	//#endregion

	constructor(
		private readonly main: HTMLElement,
		private readonly enabled = true,
	) {}

	//#region 外部 API
	/**
	 * 当前实例是否已被彻底销毁
	 */
	public get disposed(): boolean {
		return this.isDisposed;
	}

	/**
	 * 当前行是否已成功构建并持有副本
	 */
	public get isReady(): boolean {
		return !this.isDisposed && this.dim !== undefined;
	}

	/**
	 * 设置当前行是否处于亮度活跃窗口内。
	 *
	 * 若当前已脱离活跃窗口，且退出高亮的淡出过渡已完成，则会立即回收副本以节省资源。
	 * @param inWindow 是否处于活跃窗口内
	 */
	public setInWindow(inWindow: boolean): void {
		if (this.isDisposed) return;
		if (this.inWindow === inWindow) {
			if (!inWindow) this.sync();
			return;
		}
		this.inWindow = inWindow;
		this.sync();
	}

	/**
	 * 记录当前行退出高亮状态的时刻。
	 *
	 * 当歌词行从渐变高亮（GRADIENT）退出时调用，确保退出后的淡出过渡能够完整播放。
	 */
	public markHighlightExited(): void {
		if (this.isDisposed) return;
		this.cancelActivationAnimation();
		this.highlightExitedAt = performance.now();
	}

	/**
	 * 在冷启动进入高亮态时播放淡入补间动画。
	 *
	 * 当歌词行先前脱离活跃窗口（未预先构建副本）而直接被激活（例如跨区间跳转或点击）时，
	 * 由于 DOM 刚插入时已处于高亮父级下，无法自然触发 CSS opacity 过渡，
	 * 故通过 Web Animations API 显式补齐 300ms 的交叉淡入补间。
	 */
	public playActivationTransition(): void {
		if (this.isDisposed || !this.dim) return;

		this.cancelActivationAnimation();

		const dimAnim = this.dim.animate(
			[{ opacity: 0.2 }, { opacity: 0 }],
			{
				duration: 300,
				easing: "ease-out",
			},
		);
		this.dimAnimation = dimAnim;
		dimAnim.onfinish = () => {
			if (this.dimAnimation === dimAnim) {
				this.dimAnimation = undefined;
			}
		};

		const mainAnim = this.main.animate(
			[{ opacity: 0 }, { opacity: 1 }],
			{
				duration: 300,
				easing: "ease-out",
			},
		);
		this.mainAnimation = mainAnim;
		mainAnim.onfinish = () => {
			if (this.mainAnimation === mainAnim) {
				this.mainAnimation = undefined;
			}
		};
	}

	/**
	 * 取消当前正在执行的冷启动淡入动画
	 */
	public cancelActivationAnimation(): void {
		if (this.dimAnimation) {
			this.dimAnimation.cancel();
			this.dimAnimation = undefined;
		}
		if (this.mainAnimation) {
			this.mainAnimation.cancel();
			this.mainAnimation = undefined;
		}
	}

	/**
	 * 根据活跃窗口与挂载状态同步副本的生命周期。
	 *
	 * 位于活跃窗口内时按需构建副本。
	 * 若显式指定强制重建，或副本尚未创建，均会基于主层当前最新的 DOM 结构重新克隆构建。
	 * 移出活跃窗口后，需等待退出淡出过渡动画完整播放完毕（达到 `BRIGHTNESS_SETTLE_MS`）方可回收。
	 * @param forceRebuild 是否强制重新克隆构建副本，用于换行结构或尺寸变更后的 DOM 同步
	 */
	public sync(forceRebuild = false): void {
		if (this.isDisposed) return;
		if (!this.enabled) {
			if (this.isReady) this.deactivate();
			return;
		}

		if (this.inWindow) {
			if ((!this.isReady || forceRebuild) && this.main.isConnected) {
				this.rebuild();
			}
			return;
		}

		// 超出活跃窗口且已持有副本时，等待退出淡出过渡动画完整播放完毕后再行回收
		if (
			this.isReady &&
			performance.now() - this.highlightExitedAt >= BRIGHTNESS_SETTLE_MS
		) {
			this.deactivate();
		}
	}

	/**
	 * 在样式刷新完成时捕获副本定位的几何参数，并同步更新至已挂载的副本元素。
	 *
	 * 容器尺寸变化会同时影响字号与行宽，而对唱行的内边距为行宽的百分比，二者均会导致原件布局盒位移。
	 * 由于副本仅在重新构建时才会读取初始几何，此处必须将最新的几何属性显式写回已挂载的副本样式，
	 * 避免已有副本滞留在过期的旧坐标。
	 * @param mainStyle 调用方预先计算的的原件计算样式。未提供时会自行读取
	 */
	public captureGeometry(mainStyle?: CSSStyleDeclaration): void {
		if (this.isDisposed) return;
		this.geometry = this.measureGeometry(mainStyle);
		if (this.dim && this.geometry) {
			Object.assign(this.dim.style, this.geometry);
		}
	}

	/**
	 * 重建副本以使其与当前行的内容和尺寸保持严格同步。
	 */
	public rebuild(): void {
		if (!this.enabled || this.isDisposed) return;
		// 副本采用绝对定位，不会反向影响原件排版，因此仅需读取原件参数
		const parent = this.main.parentElement;
		const geometry = this.geometry ?? this.measureGeometry();
		// 若未能成功获取有效几何，则放弃构建副本且不开启亮层，保持无副本的单层形态
		if (!parent || !geometry) return;

		this.clearCopy();

		const dim = this.main.cloneNode(true);
		if (!(dim instanceof HTMLElement)) return;

		dim.classList.remove(styles.lyricMainLineBright);
		dim.classList.add(styles.lyricMainLineDim);
		dim.setAttribute("aria-hidden", "true");
		dim.inert = true;
		// 移除克隆自原件的临时过渡抑制样式，确保副本能够正常响应样式表中的淡入淡出过渡
		dim.style.removeProperty("transition");
		Object.assign(dim.style, geometry);

		// 均匀暗层副本无需任何逐词遮罩及其动画，此处予以移除
		dim.style.removeProperty("mask");
		dim.style.removeProperty("-webkit-mask");
		for (const element of dim.querySelectorAll("*")) {
			if (!(element instanceof HTMLElement)) continue;
			element.style.removeProperty("mask");
			element.style.removeProperty("-webkit-mask");
		}

		parent.append(dim);

		// 确保先将副本挂载至 DOM 后再激活亮度层形态，防止异常情况下原件提升亮度却缺失底色副本支撑，导致文本无法可见
		this.setMainBright(true);
		this.dim = dim;
	}

	/**
	 * 临时停用亮度层并回收副本（用于离开活跃窗口、移出渲染视口或淡出结束）。
	 *
	 * 区别于终态销毁 {@link dispose}，停用操作保留后续重新激活的可能性，并通过 CSS 过渡抑制与
	 * 下一帧恢复机制保证主行与副本之间的平滑解离，防止移出窗口时因图层剥离导致视觉闪烁。
	 */
	public deactivate(): void {
		if (this.isDisposed) return;
		this.clearCopy();
		this.setMainBright(false);
	}

	/**
	 * 彻底销毁并释放亮层相关资源。
	 *
	 * 终结该实例的生命周期，同步清理所有已挂载的副本元素、镜像动画、过渡抑制以及挂起的 rAF 句柄。
	 * 与 {@link deactivate} 不同，终态销毁为同步确定性操作，绝不派发新的异步帧任务。
	 */
	public dispose(): void {
		if (this.isDisposed) return;
		this.isDisposed = true;
		this.releaseTransitionSuppression();
		this.clearCopy();
		this.main.classList.remove(styles.lyricMainLineBright);
		this.main.style.transition = "";
	}
	//#endregion

	//#region 内部测量与几何解算
	/**
	 * 测量原件 Border Box 相对于父级内 Padding Box 的定位偏移量。
	 *
	 * 水平方向通过左右双向约束（`left` + `right`）替代显式设置 `width`。
	 * 由于计算样式中的宽度受元素自身 `box-sizing` 属性影响，若宿主页面存在全局的 `border-box` 重置，
	 * 读取出的宽度即为边框盒宽度。此时若副本再次叠加自身内边距，会导致副本宽度超出原件并向两侧异常溢出。
	 *
	 * 原件属于自适应宽度的块级盒，其边框盒由父容器内容盒减去自身外边距求解得出。
	 * 因此将相同的偏移量应用于副本时，解出的盒模型各边将与原件严格重合。
	 * @param mainStyle 调用方预先计算的的原件计算样式。未提供时会自行读取
	 * @returns 包含 top、left、right 像素字符串的几何对象。若样式尚未就绪则返回 `undefined`
	 */
	private measureGeometry(
		mainStyle?: CSSStyleDeclaration,
	): Geometry | undefined {
		const parent = this.main.parentElement;
		if (!parent) return undefined;

		const mainComputed = mainStyle ?? getComputedStyle(this.main);
		const parentStyle = getComputedStyle(parent);
		const edges = [
			parentStyle.paddingTop,
			parentStyle.paddingLeft,
			parentStyle.paddingRight,
			mainComputed.marginTop,
			mainComputed.marginLeft,
			mainComputed.marginRight,
		].map((value) => LineBrightness.parsePx(value));

		if (edges.some((value) => value === undefined)) {
			return undefined;
		}

		const [
			paddingTop,
			paddingLeft,
			paddingRight,
			marginTop,
			marginLeft,
			marginRight,
		] = edges as number[];

		return {
			top: `${paddingTop + marginTop}px`,
			left: `${paddingLeft + marginLeft}px`,
			right: `${paddingRight + marginRight}px`,
		};
	}

	/**
	 * 从 Computed Style 中读取以 px 为单位的数值
	 */
	private static parsePx(value: string): number | undefined {
		return value.endsWith("px") ? Number.parseFloat(value) : undefined;
	}
	//#endregion

	//#region 样式状态
	/**
	 * 切换原件的亮层形态
	 *
	 * 亮度层与暗层的静息态视觉表现保持一致。窗口外由行级单层遮罩提供均匀静息外观，
	 * 窗口内则由亮度层叠加副本呈现相同效果。因此形态切换本身不应触发视觉过渡动画，
	 * 必须瞬时完成。
	 *
	 * 若允许 `opacity` 触发过渡动画，切换瞬间会出现图层叠加导致的闪烁瑕疵，即刚进入窗口的歌词行会因叠加而瞬间过亮后回暗，
	 * 刚移出窗口的歌词行则会因图层剥离而瞬时消失再重新显现。
	 *
	 * 瞬时切换通过临时抑制 CSS 过渡实现：
	 * 1. 先将原件样式的 `transition` 显式设为 `none`。
	 * 2. 切换 CSS 类名，使 `opacity` 目标值发生变更时因缺失过渡定义而跳过过渡动画。
	 *
	 * 该抑制状态无法在当前帧内立即同步解除：
	 * - 若在同一帧内恢复 `transition`，样式变更会被浏览器合并处理，依然会按恢复后的规则建立过渡动画。
	 * - 若通过读取计算样式强制触发重排以使样式变更立即生效，会导致整页在构建帧中重复执行样式解析。
	 *
	 * 因此，过渡抑制的恢复推迟至下一帧（通过 `requestAnimationFrame`）执行。此时目标样式已在本帧常规渲染流程中
	 * 完成提交，恢复 `transition` 属性不会变更任何已渲染的样式，从而避免触发非预期的过渡动画。
	 * @param enabled 是否开启亮层形态
	 */
	private setMainBright(enabled: boolean): void {
		if (this.isDisposed) return;
		if (this.main.classList.contains(styles.lyricMainLineBright) === enabled) {
			return;
		}

		this.releaseTransitionSuppression();
		this.main.classList.toggle(styles.lyricMainLineBright, enabled);

		// 若元素已从活跃 DOM 树卸载，无需通过 rAF 进行过渡抑制与异步恢复，直接保持空内联样式即可
		if (!this.main.isConnected) {
			return;
		}

		this.main.style.transition = "none";
		this.transitionRestore = requestAnimationFrame(() => {
			this.transitionRestore = undefined;
			// 异步回调执行时进行守卫：若对象已销毁或节点已脱离 DOM，则不继续执行抑制解除
			if (this.isDisposed || !this.main.isConnected) {
				this.main.style.transition = "";
				return;
			}
			this.releaseTransitionSuppression();
		});
	}

	/**
	 * 解除对 CSS 过渡效果的临时抑制
	 *
	 * 两次状态切换之间可能交叠多个异步恢复回调，先触发的解除调用始终有效，重复调用幂等且安全
	 */
	private releaseTransitionSuppression(): void {
		if (this.transitionRestore !== undefined) {
			cancelAnimationFrame(this.transitionRestore);
			this.transitionRestore = undefined;
		}
		this.main.style.transition = "";
	}

	/**
	 * 清理已创建的镜像动画与暗层副本元素
	 */
	private clearCopy(): void {
		this.cancelActivationAnimation();
		this.dim?.remove();
		this.dim = undefined;
	}
	//#endregion
}
