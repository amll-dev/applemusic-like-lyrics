import bezier from "bezier-easing";
import type { LyricWord } from "#interfaces";
import { clamp01, clampPositive } from "#utils/clamp.ts";
import { createMatrix4, matrix4ToCSS, scaleMatrix4 } from "#utils/matrix.ts";

//#region 工具函数和类型
const ANIMATION_FRAME_QUANTITY = 32;

const norNum = (min: number, max: number) => (x: number) =>
	clamp01((x - min) / (max - min));
const EMP_EASING_MID = 0.5;
const beginNum = norNum(0, EMP_EASING_MID);
const endNum = norNum(EMP_EASING_MID, 1);

const bezIn = bezier(0.2, 0.4, 0.58, 1.0);
const bezOut = bezier(0.3, 0.0, 0.58, 1.0);

const makeEmpEasing = (mid: number) => {
	return (x: number) => (x < mid ? bezIn(beginNum(x)) : 1 - bezOut(endNum(x)));
};
const empEasing = makeEmpEasing(EMP_EASING_MID);

/**
 * 强调动画的配置选项
 */
export interface EmphasizeAnimationOptions {
	/**
	 * 当前正在处理的单词
	 */
	word: LyricWord;

	/**
	 * 属于该单词、且已经被拆分为单个字符的 DOM 元素数组
	 */
	characterElements: HTMLElement[];

	/**
	 * 单词的持续时间（毫秒）
	 */
	duration: number;

	/**
	 * 单词相对于歌词行起始时间的延迟（毫秒）
	 */
	delay: number;

	/**
	 * Ruby 字符的总数量，用于辅助计算字符间错落起步的延迟差
	 */
	rubyCharCount: number;

	/**
	 * 当前行是否为背景人声（背景人声的上浮幅度会成倍增加）
	 */
	isBG: boolean;

	/**
	 * 当前单词是否为整行歌词的最后一个词（若是，则会加剧形变与辉光的幅度）
	 */
	isLastWord: boolean;
}

/**
 * 内部传递的预计算动画参数容器
 */
interface EmphasizeParams {
	amount: number;
	blur: number;
	du: number;
	de: number;
	anchorCharCount: number;
	animateDu: number;
}
//#endregion

//#region 外部 API
/**
 * 为单词元素的所有字符创建强调动画序列，
 * 该效果会使得逐个字符依次进行辉光缩放和上浮
 *
 * 创建后的动画默认处于暂停状态，外部需要根据播放进度进行调度
 *
 * @param options 强调动画配置项
 * @returns 构建完毕的 Animation 对象列表
 */
export function createEmphasizeAnimation(
	options: EmphasizeAnimationOptions,
): Animation[] {
	const params = calculateEmphasizeParams(options);
	const totalChars = options.characterElements.length;
	const result: Animation[] = [];

	options.characterElements.forEach((el, i) => {
		const wordDe = params.de + (params.du / 2.5 / params.anchorCharCount) * i;

		result.push(createCharGlowAnimation(el, i, totalChars, wordDe, params));
		result.push(createCharFloatAnimation(el, wordDe, options.isBG, params));
	});

	return result;
}
//#endregion

//#region 参数计算
function calculateEmphasizeParams(
	options: EmphasizeAnimationOptions,
): EmphasizeParams {
	const { duration, delay, rubyCharCount, characterElements, isLastWord } =
		options;

	const de = clampPositive(delay);
	let du = Math.max(1000, duration);
	const anchorCharCount =
		rubyCharCount > 0 ? rubyCharCount : Math.max(1, characterElements.length);

	let amount = du / 2000;
	amount = amount > 1 ? Math.sqrt(amount) : amount ** 3;

	let blur = du / 3000;
	blur = blur > 1 ? Math.sqrt(blur) : blur ** 3;

	amount *= 0.6;
	blur *= 0.5;

	// 为了演出效果，给最后一个词应用更强的效果
	if (isLastWord) {
		amount *= 1.6;
		blur *= 1.5;
		du *= 1.2;
	}

	amount = Math.min(1.2, amount);
	blur = Math.min(0.8, blur);

	const animateDu = Number.isFinite(du) ? du : 0;

	return {
		amount,
		blur,
		du,
		de,
		anchorCharCount,
		animateDu,
	};
}
//#endregion

//#region 帧生成器
function generateGlowKeyframes(
	charIndex: number,
	totalChars: number,
	amount: number,
	blur: number,
): Keyframe[] {
	return new Array(ANIMATION_FRAME_QUANTITY).fill(0).map((_, j) => {
		const x = (j + 1) / ANIMATION_FRAME_QUANTITY;
		const transX = empEasing(x);
		const glowLevel = transX * blur;

		const mat = scaleMatrix4(createMatrix4(), 1 + transX * 0.1 * amount);

		// 结合字符在单词中的位置（偏左或偏右），产生轻微的相互推挤效果
		const offsetX = -transX * 0.03 * amount * (totalChars / 2 - charIndex);
		const offsetY = -transX * 0.025 * amount;

		return {
			offset: x,
			transform: `${matrix4ToCSS(mat, 4)} translate(${offsetX}em, ${offsetY}em)`,
			textShadow: `0 0 ${Math.min(0.3, blur * 0.3)}em rgba(255, 255, 255, ${glowLevel})`,
		};
	});
}

function generateFloatKeyframes(isBG: boolean): Keyframe[] {
	return new Array(ANIMATION_FRAME_QUANTITY).fill(0).map((_, j) => {
		const x = (j + 1) / ANIMATION_FRAME_QUANTITY;
		let y = Math.sin(x * Math.PI);
		if (isBG) {
			y *= 2;
		}

		return {
			offset: x,
			transform: `translateY(${-y * 0.05}em)`,
		};
	});
}
//#endregion

//#region 单字符动画实例化
function createCharGlowAnimation(
	el: HTMLElement,
	charIndex: number,
	totalChars: number,
	wordDelay: number,
	params: EmphasizeParams,
): Animation {
	const frames = generateGlowKeyframes(
		charIndex,
		totalChars,
		params.amount,
		params.blur,
	);

	const glow = el.animate(frames, {
		duration: params.animateDu,
		delay: Number.isFinite(wordDelay) ? wordDelay : 0,
		id: `emphasize-word-${el.textContent}-${charIndex}`,
		iterations: 1,
		composite: "replace",
		fill: "both",
	});
	glow.onfinish = () => glow.pause();
	glow.pause();

	return glow;
}

function createCharFloatAnimation(
	el: HTMLElement,
	wordDelay: number,
	isBG: boolean,
	params: EmphasizeParams,
): Animation {
	const frames = generateFloatKeyframes(isBG);

	const float = el.animate(frames, {
		duration: params.animateDu * 1.4,
		// 上浮动画比辉光动画提前 400ms 开始
		delay: Number.isFinite(wordDelay) ? wordDelay - 400 : 0,
		id: "emphasize-word-float",
		iterations: 1,
		composite: "add",
		fill: "both",
	});
	float.onfinish = () => float.pause();
	float.pause();

	return float;
}
//#endregion
