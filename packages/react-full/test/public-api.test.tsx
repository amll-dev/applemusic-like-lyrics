import { createStore, Provider } from "jotai";
import {
	act,
	createRef,
	StrictMode,
	Suspense,
	startTransition,
	useLayoutEffect,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	cssBackgroundPropertyAtom,
	isLyricPageOpenedAtom,
	lyricBackgroundRendererAtom,
	musicCoverIsVideoAtom,
	onClickControlThumbAtom,
	PrebuiltLyricPlayer,
	type PrebuiltLyricPlayerProps,
	showBottomControlAtom,
} from "../src/index.ts";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Layout = "horizontal" | "vertical";

const LAYOUT_SIZES = {
	horizontal: { width: 960, height: 620 },
	vertical: { width: 390, height: 844 },
} satisfies Record<Layout, { width: number; height: number }>;

const LAYOUTS = [
	{ layout: "horizontal", label: "横屏" },
	{ layout: "vertical", label: "竖屏" },
] as const;

/** happy-dom 不会计算布局，按内联样式中的宽高模拟元素尺寸 */
function getStyleRect(el: Element): DOMRect {
	const style = (el as HTMLElement).style;
	return new DOMRect(
		0,
		0,
		Number.parseFloat(style?.width ?? "") || 0,
		Number.parseFloat(style?.height ?? "") || 0,
	);
}

const resizeObservers = new Set<MockResizeObserver>();

/** happy-dom 的 ResizeObserver 不会触发回调，改为由测试手动通知 */
class MockResizeObserver implements ResizeObserver {
	readonly #callback: ResizeObserverCallback;
	constructor(callback: ResizeObserverCallback) {
		this.#callback = callback;
	}
	observe() {
		resizeObservers.add(this);
	}
	unobserve() {}
	disconnect() {
		resizeObservers.delete(this);
	}
	notify() {
		this.#callback([], this);
	}
}

/** 记录回调 ref 当前持有的节点，并在清理时移除，用于检查 ref 的替换和清理 */
function createTrackedRefs() {
	const active = new Map<string, HTMLElement>();
	const cleanups: ReturnType<typeof vi.fn>[] = [];
	const nullCalls: string[] = [];
	const track =
		<T extends HTMLElement>(key: string) =>
		(node: T | null) => {
			if (!node) {
				nullCalls.push(key);
				active.delete(key);
				return;
			}
			active.set(key, node);
			const cleanup = vi.fn(() => {
				active.delete(key);
			});
			cleanups.push(cleanup);
			return cleanup;
		};
	return { active, track, cleanups, nullCalls };
}

describe("PrebuiltLyricPlayer 公开接口", () => {
	let container: HTMLDivElement;
	let root: Root;
	let store: ReturnType<typeof createStore>;

	const render = async (
		props: PrebuiltLyricPlayerProps,
		layout: Layout = "horizontal",
	) => {
		await act(async () => {
			root.render(
				<StrictMode>
					<Provider store={store}>
						<PrebuiltLyricPlayer style={LAYOUT_SIZES[layout]} {...props} />
					</Provider>
				</StrictMode>,
			);
		});
		// 尺寸变化后需要通知 ResizeObserver，布局才会在横竖之间切换
		await act(async () => {
			for (const observer of resizeObservers) observer.notify();
		});
	};

	beforeEach(() => {
		vi.stubGlobal("ResizeObserver", MockResizeObserver);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
			function (this: Element) {
				return getStyleRect(this);
			},
		);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
			function (this: HTMLElement) {
				return getStyleRect(this).width;
			},
		);
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
			function (this: HTMLElement) {
				return getStyleRect(this).height;
			},
		);

		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		store = createStore();
		store.set(isLyricPageOpenedAtom, true);
		store.set(lyricBackgroundRendererAtom, { renderer: "css-bg" });
		store.set(cssBackgroundPropertyAtom, "#334");
		store.set(showBottomControlAtom, true);
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		container.remove();
		resizeObservers.clear();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("coverProps 与 coverFrameRef 分别指向真实封面及其布局容器", async () => {
		const coverRef = createRef<HTMLDivElement>();
		const frameRef = createRef<HTMLDivElement>();
		await render({
			coverFrameRef: frameRef,
			coverProps: {
				ref: coverRef,
				id: "public-cover",
				style: { opacity: 0.9 },
			},
		});

		expect(coverRef.current?.id).toBe("public-cover");
		expect(coverRef.current?.style.opacity).toBe("0.9");
		// 传入自定义样式时仍保留封面的默认缩放比例
		expect(coverRef.current?.style.getPropertyValue("--scale-level")).toBe(
			"0.75",
		);
		expect(frameRef.current).not.toBe(coverRef.current);
		expect(frameRef.current?.contains(coverRef.current)).toBe(true);
	});

	it("收起控件区分容器与按钮的 ref，默认触发 atom 中的回调", async () => {
		const onEmit = vi.fn();
		store.set(onClickControlThumbAtom, { onEmit });
		const thumbRef = createRef<HTMLDivElement>();
		const buttonRef = createRef<HTMLButtonElement>();
		await render({
			controlThumbProps: { ref: thumbRef, buttonRef, buttonLabel: "收起" },
		});

		expect(buttonRef.current?.tagName).toBe("BUTTON");
		expect(buttonRef.current?.getAttribute("aria-label")).toBe("收起");
		expect(thumbRef.current).not.toBe(buttonRef.current);
		expect(thumbRef.current?.contains(buttonRef.current)).toBe(true);

		await act(async () => buttonRef.current?.click());
		expect(onEmit).toHaveBeenCalledTimes(1);
	});

	it("显式传入的 onClick 优先于 atom 中的回调", async () => {
		const onEmit = vi.fn();
		const onClick = vi.fn();
		store.set(onClickControlThumbAtom, { onEmit });
		const buttonRef = createRef<HTMLButtonElement>();
		await render({ controlThumbProps: { buttonRef, onClick } });

		await act(async () => buttonRef.current?.click());
		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onEmit).not.toHaveBeenCalled();
	});

	it.each(["对象", "回调"])(
		"$0 ref 在首次宿主布局 effect 时同步可用",
		async (kind) => {
			const frameRef = createRef<HTMLDivElement>();
			const buttonRef = createRef<HTMLButtonElement>();
			const samples: [
				HTMLDivElement | null,
				HTMLButtonElement | null,
				Element | null,
			][] = [];
			const props: PrebuiltLyricPlayerProps = {
				coverFrameRef:
					kind === "对象"
						? frameRef
						: (node) => {
								frameRef.current = node;
							},
				controlThumbProps: {
					buttonRef:
						kind === "对象"
							? buttonRef
							: (node) => {
									buttonRef.current = node;
								},
				},
			};
			function Host() {
				useLayoutEffect(() => {
					buttonRef.current?.focus();
					samples.push([
						frameRef.current,
						buttonRef.current,
						document.activeElement,
					]);
				}, []);
				return (
					<PrebuiltLyricPlayer style={LAYOUT_SIZES.horizontal} {...props} />
				);
			}
			await act(async () =>
				root.render(
					<StrictMode>
						<Provider store={store}>
							<Host />
						</Provider>
					</StrictMode>,
				),
			);
			expect(samples.length).toBeGreaterThan(0);
			for (const [frame, button, focused] of samples) {
				expect(frame).toBeInstanceOf(HTMLDivElement);
				expect(button).toBeInstanceOf(HTMLButtonElement);
				expect(focused).toBe(button);
			}
		},
	);

	it("替换回调 ref 时清理旧的 ref，并把同一节点交给新的 ref", async () => {
		const { active, track, cleanups, nullCalls } = createTrackedRefs();
		const first = {
			coverFrameRef: track("frame1"),
			controlThumbProps: { buttonRef: track("button1") },
		};
		await render(first);
		const frame = active.get("frame1");
		const button = active.get("button1");
		expect(frame).toBeDefined();
		expect(button?.tagName).toBe("BUTTON");
		const before = cleanups.map((cleanup) => cleanup.mock.calls.length);
		await render(first);
		expect(cleanups.map((cleanup) => cleanup.mock.calls.length)).toEqual(
			before,
		);

		const second = {
			coverFrameRef: track("frame2"),
			controlThumbProps: { buttonRef: track("button2") },
		};
		await render(second);
		expect(active.has("frame1")).toBe(false);
		expect(active.has("button1")).toBe(false);
		expect(active.get("frame2")).toBe(frame);
		expect(active.get("button2")).toBe(button);
		await render({});
		expect(active.size).toBe(0);
		await render(second);
		expect(active.get("frame2")).toBe(frame);
		expect(active.get("button2")).toBe(button);
		await act(async () => root.unmount());
		expect(active.size).toBe(0);
		expect(nullCalls).toEqual([]);
		for (const cleanup of cleanups) expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("没有返回清理函数的回调 ref 在移除时收到 null", async () => {
		const buttonRef = vi.fn<(node: HTMLButtonElement | null) => void>();
		await render({ controlThumbProps: { buttonRef } });
		expect(buttonRef.mock.lastCall?.[0]).toBeInstanceOf(HTMLButtonElement);
		await render({});
		expect(buttonRef).toHaveBeenLastCalledWith(null);
		const calls = buttonRef.mock.calls.length;
		await act(async () => root.unmount());
		expect(buttonRef).toHaveBeenCalledTimes(calls);
	});

	it("未提交的并发渲染不会替换当前 ref 的清理目标", async () => {
		const first = vi.fn<(node: HTMLButtonElement | null) => void>();
		const discarded = vi.fn<(node: HTMLButtonElement | null) => void>();
		const attempted = vi.fn();
		const pending = new Promise<never>(() => {});
		function Blocker({ suspend }: { suspend: boolean }) {
			if (suspend) {
				attempted();
				throw pending;
			}
			return null;
		}
		const view = (suspend: boolean) => (
			<StrictMode>
				<Suspense fallback={null}>
					<Provider store={store}>
						<PrebuiltLyricPlayer
							style={LAYOUT_SIZES.horizontal}
							controlThumbProps={{ buttonRef: suspend ? discarded : first }}
						/>
						<Blocker suspend={suspend} />
					</Provider>
				</Suspense>
			</StrictMode>
		);
		await act(async () => root.render(view(false)));
		await act(async () => startTransition(() => root.render(view(true))));
		expect(attempted).toHaveBeenCalled();
		expect(discarded).not.toHaveBeenCalled();
		await act(async () => root.unmount());
		expect(first).toHaveBeenLastCalledWith(null);
		expect(discarded).not.toHaveBeenCalled();
	});

	it("对象 ref 可以替换回调 ref", async () => {
		const { active, track } = createTrackedRefs();
		await render({
			coverFrameRef: track("frame"),
			controlThumbProps: { buttonRef: track("button") },
		});
		const frameRef = createRef<HTMLDivElement>();
		const buttonRef = createRef<HTMLButtonElement>();
		await render({ coverFrameRef: frameRef, controlThumbProps: { buttonRef } });

		expect(active.size).toBe(0);
		expect(frameRef.current).not.toBeNull();
		expect(buttonRef.current).not.toBeNull();
	});

	it("横竖布局切换后 ref 跟随当前布局中的节点", async () => {
		const coverRef = createRef<HTMLDivElement>();
		const frameRef = createRef<HTMLDivElement>();
		const buttonRef = createRef<HTMLButtonElement>();
		const props: PrebuiltLyricPlayerProps = {
			coverFrameRef: frameRef,
			coverProps: { ref: coverRef },
			controlThumbProps: { buttonRef },
		};
		await render(props, "horizontal");
		const horizontalFrame = frameRef.current;
		expect(horizontalFrame?.contains(coverRef.current)).toBe(true);

		await render(props, "vertical");
		const verticalFrame = frameRef.current;
		// 布局切换会重新挂载封面容器，旧节点应已从文档中移除
		expect(horizontalFrame?.isConnected).toBe(false);
		expect(verticalFrame).not.toBe(horizontalFrame);
		expect(verticalFrame?.contains(coverRef.current)).toBe(true);
		expect(buttonRef.current?.isConnected).toBe(true);

		await render(props, "horizontal");
		expect(verticalFrame?.isConnected).toBe(false);
		expect(frameRef.current?.isConnected).toBe(true);
		expect(frameRef.current?.contains(coverRef.current)).toBe(true);
		expect(buttonRef.current?.isConnected).toBe(true);
	});

	it.each(LAYOUTS)(
		"musicInfoProps 只应用到$label布局中显示的歌曲信息",
		async ({ layout }) => {
			const infoRef = createRef<HTMLDivElement>();
			await render(
				{ musicInfoProps: { ref: infoRef, id: "public-info" } },
				layout,
			);

			const infos = container.querySelectorAll("#public-info");
			expect(infos).toHaveLength(1);
			expect(infoRef.current).toBe(infos[0]);
		},
	);

	it.each(LAYOUTS)(
		"$label布局的播放列表按钮反映受控状态并请求切换",
		async ({ layout }) => {
			const onPlaylistOpenedChange = vi.fn();
			const props: PrebuiltLyricPlayerProps = {
				onPlaylistOpenedChange,
				playlistControls: "host-queue",
				playlistButtonLabel: "播放队列",
			};
			const getButtons = () =>
				container.querySelectorAll<HTMLButtonElement>(
					'[aria-controls="host-queue"]',
				);

			await render({ ...props, playlistOpened: false }, layout);
			expect(getButtons()).toHaveLength(1);
			const [closedButton] = getButtons();
			expect(closedButton.getAttribute("aria-label")).toBe("播放队列");
			expect(closedButton.getAttribute("aria-expanded")).toBe("false");
			await act(async () => closedButton.click());
			expect(onPlaylistOpenedChange).toHaveBeenLastCalledWith(true);

			await render({ ...props, playlistOpened: true }, layout);
			const [openedButton] = getButtons();
			expect(openedButton.getAttribute("aria-expanded")).toBe("true");
			await act(async () => openedButton.click());
			expect(onPlaylistOpenedChange).toHaveBeenLastCalledWith(false);
		},
	);

	it("视频封面暂停时不自动播放，切换为图片后清空视频 ref", async () => {
		const videoRef = createRef<HTMLVideoElement>();
		store.set(musicCoverIsVideoAtom, true);
		await render({ coverProps: { videoRef, coverVideoPaused: true } });

		expect(videoRef.current?.tagName).toBe("VIDEO");
		expect(videoRef.current?.autoplay).toBe(false);

		await act(async () => store.set(musicCoverIsVideoAtom, false));
		expect(videoRef.current).toBeNull();
	});

	it("卸载后清空所有外部 ref", async () => {
		const refs = {
			frame: createRef<HTMLDivElement>(),
			cover: createRef<HTMLDivElement>(),
			video: createRef<HTMLVideoElement>(),
			thumb: createRef<HTMLDivElement>(),
			button: createRef<HTMLButtonElement>(),
			info: createRef<HTMLDivElement>(),
		};
		store.set(musicCoverIsVideoAtom, true);
		await render({
			coverFrameRef: refs.frame,
			coverProps: { ref: refs.cover, videoRef: refs.video },
			controlThumbProps: { ref: refs.thumb, buttonRef: refs.button },
			musicInfoProps: { ref: refs.info },
		});
		for (const ref of Object.values(refs)) {
			expect(ref.current).not.toBeNull();
		}

		await act(async () => root.unmount());
		for (const ref of Object.values(refs)) {
			expect(ref.current).toBeNull();
		}
	});
});
