import {
	type BaseRenderer,
	LyricPlayer as CoreLyricPlayer,
	type LyricLine,
	type LyricLineMouseEvent,
	type LyricPlayerBase,
	MaskObsceneWordsMode,
	type spring,
} from "@applemusic-like-lyrics/core";
import {
	computed,
	defineComponent,
	type ExtractPublicPropTypes,
	onMounted,
	onUnmounted,
	type PropType,
	type Ref,
	ref,
	type ShallowRef,
	type SlotsType,
	Teleport,
	useTemplateRef,
	watchEffect,
} from "vue";

const lyricPlayerProps = {
	/**
	 * 是否禁用歌词播放组件，默认为 `false`，歌词组件启用后将会开始逐帧更新歌词的动画效果，并对传入的其他参数变更做出反馈。
	 *
	 * 如果禁用了歌词组件动画，你也可以通过引用取得原始渲染组件实例，手动逐帧调用其 `update` 函数来更新动画效果。
	 */
	disabled: {
		type: Boolean,
		default: false,
	},
	/**
	 * 是否演出部分效果，目前会控制播放间奏点的动画的播放暂停与否，默认为 `true`
	 */
	playing: {
		type: Boolean,
		default: true,
	},
	/**
	 * 设置歌词行的对齐方式，如果为 `undefined` 则默认为 `center`
	 *
	 * - 设置成 `top` 的话将会向目标歌词行的顶部对齐
	 * - 设置成 `bottom` 的话将会向目标歌词行的底部对齐
	 * - 设置成 `center` 的话将会向目标歌词行的垂直中心对齐
	 */
	alignAnchor: {
		type: String as PropType<"top" | "bottom" | "center">,
		default: "center",
	},
	/**
	 * 设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，如果为 `undefined`
	 * 则默认为 `0.5`
	 *
	 * 可以设置一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置
	 */
	alignPosition: {
		type: Number,
		default: 0.5,
	},
	/**
	 * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
	 *
	 * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
	 *
	 * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
	 */
	enableSpring: {
		type: Boolean,
		default: true,
	},
	/**
	 * 设置是否启用歌词行的模糊效果，默认为 `true`
	 */
	enableBlur: {
		type: Boolean,
		default: true,
	},
	/**
	 * 设置是否使用物理弹簧算法实现歌词动画效果，默认启用
	 *
	 * 如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行
	 *
	 * 如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一
	 */
	enableScale: {
		type: Boolean,
		default: true,
	},
	/**
	 * 设置是否隐藏已经播放过的歌词行，默认不隐藏
	 */
	hidePassedLines: {
		type: Boolean,
		default: false,
	},
	/**
	 * 设置歌词中不雅用语的掩码模式，默认为 `MaskObsceneWordsMode.Disabled`，即不掩码
	 */
	maskObsceneWordsMode: {
		type: Object as PropType<MaskObsceneWordsMode>,
		default: MaskObsceneWordsMode.Disabled,
	},
	/**
	 * 设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误
	 */
	lyricLines: {
		type: Object as PropType<LyricLine[]>,
		required: false,
	},
	/**
	 * 设置当前播放进度，单位为毫秒且**必须是整数**，此时将会更新内部的歌词进度信息
	 * 内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好
	 */
	currentTime: {
		type: Number,
		default: 0,
	},
	/**
	 * 设置文字动画的渐变宽度，单位以歌词行的主文字字体大小的倍数为单位，默认为 0.5，即一个全角字符的一半宽度
	 *
	 * 如果要模拟 Apple Music for Android 的效果，可以设置为 1
	 *
	 * 如果要模拟 Apple Music for iPad 的效果，可以设置为 0.5
	 *
	 * 如果想要近乎禁用渐变效果，可以设置成非常接近 0 的小数（例如 `0.0001` ），但是**不可以为 0**
	 */
	wordFadeWidth: {
		type: Number,
		default: 0.5,
	},
	/**
	 * 设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	linePosXSpringParams: {
		type: Object as PropType<Partial<spring.SpringParams>>,
		required: false,
	},
	/**
	 * 设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	linePosYSpringParams: {
		type: Object as PropType<Partial<spring.SpringParams>>,
		required: false,
	},
	/**
	 * 设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。
	 *
	 * @param params 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样
	 */
	lineScaleSpringParams: {
		type: Object as PropType<Partial<spring.SpringParams>>,
		required: false,
	},
	/**
	 * 设置渲染器，如果为 `undefined` 则默认为 `MeshGradientRenderer`
	 * 默认渲染器有可能会随着版本更新而更换
	 */
	lyricPlayer: {
		type: Object as PropType<{
			new (...args: ConstructorParameters<typeof BaseRenderer>): BaseRenderer;
		}>,
		required: false,
	},
} as const;

/**
 * 歌词播放组件的属性
 */
export type LyricPlayerProps = ExtractPublicPropTypes<typeof lyricPlayerProps>;

const lyricPlayerEmits = {
	lineClick: (_: LyricLineMouseEvent) => true,
	lineContextmenu: (_: LyricLineMouseEvent) => true,
} as const;

/**
 * 歌词播放组件的事件
 */
export type LyricPlayerEmits = typeof lyricPlayerEmits;

/**
 * 歌词播放组件的引用
 */
export interface LyricPlayerRef {
	/**
	 * 歌词播放实例
	 */
	lyricPlayer: Ref<LyricPlayerBase | undefined>;
	/**
	 * 将歌词播放实例的元素包裹起来的 DIV 元素实例
	 */
	wrapperEl: Readonly<ShallowRef<HTMLDivElement | null>>;
}

export const LyricPlayer = defineComponent({
	name: "LyricPlayer",
	props: lyricPlayerProps,
	emits: lyricPlayerEmits,
	slots: Object as SlotsType<{
		"bottom-line": () => void;
	}>,
	setup(props, { expose, emit, attrs, slots }) {
		const wrapperRef = useTemplateRef<HTMLDivElement>("wrapper-ref");
		const playerRef = ref<CoreLyricPlayer>();

		const lineClickHandler = (e: Event) =>
			emit("lineClick", e as LyricLineMouseEvent);
		const lineContextMenuHandler = (e: Event) =>
			emit("lineContextmenu", e as LyricLineMouseEvent);

		onMounted(() => {
			const wrapper = wrapperRef.value;
			if (wrapper) {
				playerRef.value = new CoreLyricPlayer();
				wrapper.appendChild(playerRef.value.getElement());
				playerRef.value.addEventListener("line-click", lineClickHandler);
				playerRef.value.addEventListener(
					"line-contextmenu",
					lineContextMenuHandler,
				);
			}
		});

		onUnmounted(() => {
			if (playerRef.value) {
				playerRef.value.removeEventListener("line-click", lineClickHandler);
				playerRef.value.removeEventListener(
					"line-contextmenu",
					lineContextMenuHandler,
				);
				playerRef.value.dispose();
			}
		});

		watchEffect((onCleanup) => {
			if (!props.disabled) {
				let canceled = false;
				let lastTime = -1;
				const onFrame = (time: number) => {
					if (canceled) return;
					if (lastTime === -1) {
						lastTime = time;
					}
					playerRef.value?.update(time - lastTime);
					lastTime = time;
					requestAnimationFrame(onFrame);
				};
				requestAnimationFrame(onFrame);
				onCleanup(() => {
					canceled = true;
				});
			}
		});

		watchEffect(() => {
			if (props.playing !== undefined) {
				if (props.playing) {
					playerRef.value?.resume();
				} else {
					playerRef.value?.pause();
				}
			} else playerRef.value?.resume();
		});

		watchEffect(() => {
			if (props.alignAnchor !== undefined)
				playerRef.value?.setAlignAnchor(props.alignAnchor);
		});

		watchEffect(() => {
			if (props.hidePassedLines !== undefined)
				playerRef.value?.setHidePassedLines(props.hidePassedLines);
		});

		watchEffect(() => {
			if (props.maskObsceneWordsMode !== undefined)
				playerRef.value?.setMaskObsceneWords(props.maskObsceneWordsMode);
			else playerRef.value?.setMaskObsceneWords(MaskObsceneWordsMode.Disabled);
		});

		watchEffect(() => {
			if (props.alignPosition !== undefined)
				playerRef.value?.setAlignPosition(props.alignPosition);
		});

		watchEffect(() => {
			if (props.enableSpring !== undefined)
				playerRef.value?.setEnableSpring(props.enableSpring);
			else playerRef.value?.setEnableSpring(true);
		});

		watchEffect(() => {
			if (props.enableBlur !== undefined)
				playerRef.value?.setEnableBlur(props.enableBlur);
			else playerRef.value?.setEnableBlur(true);
		});

		watchEffect(() => {
			if (props.enableScale !== undefined)
				playerRef.value?.setEnableScale(props.enableScale);
			else playerRef.value?.setEnableScale(true);
		});

		watchEffect(() => {
			if (props.lyricLines !== undefined)
				playerRef.value?.setLyricLines(props.lyricLines);
		});

		watchEffect(() => {
			if (props.currentTime !== undefined)
				playerRef.value?.setCurrentTime(props.currentTime);
		});

		watchEffect(() => {
			if (props.wordFadeWidth !== undefined)
				playerRef.value?.setWordFadeWidth(props.wordFadeWidth);
		});

		watchEffect(() => {
			if (props.linePosXSpringParams !== undefined)
				playerRef.value?.setLinePosXSpringParams(props.linePosXSpringParams);
		});

		watchEffect(() => {
			if (props.linePosYSpringParams !== undefined)
				playerRef.value?.setLinePosYSpringParams(props.linePosYSpringParams);
		});

		watchEffect(() => {
			if (props.lineScaleSpringParams !== undefined)
				playerRef.value?.setLineScaleSpringParams(props.lineScaleSpringParams);
		});

		const bottomLineEl = computed(() =>
			playerRef.value?.getBottomLineElement(),
		);

		expose<LyricPlayerRef>({
			lyricPlayer: playerRef,
			wrapperEl: wrapperRef,
		});

		return () => (
			<div ref="wrapper-ref" {...attrs}>
				{bottomLineEl.value && (
					<Teleport to={bottomLineEl.value}>
						{slots["bottom-line"]?.()}
					</Teleport>
				)}
			</div>
		);
	},
});
