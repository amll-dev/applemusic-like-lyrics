import { createStore, Provider } from "jotai";
import { createRef, type Ref, StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
	cssBackgroundPropertyAtom,
	isLyricPageOpenedAtom,
	lyricBackgroundRendererAtom,
	musicCoverIsVideoAtom,
	onClickControlThumbAtom,
	PrebuiltLyricPlayer,
	showBottomControlAtom,
} from "../index";
import "@applemusic-like-lyrics/core/style.css";

const result = document.getElementById("result") as HTMLPreElement;
const fixture = document.getElementById("fixture") as HTMLDivElement;
const run = document.getElementById("run") as HTMLButtonElement;
run.onclick = async () => {
	run.disabled = true;
	const root = createRoot(fixture);
	const store = createStore();
	store.set(isLyricPageOpenedAtom, true);
	store.set(lyricBackgroundRendererAtom, { renderer: "css-bg" });
	store.set(cssBackgroundPropertyAtom, "#334");
	store.set(showBottomControlAtom, true);
	let legacyClicks = 0;
	store.set(onClickControlThumbAtom, { onEmit: () => legacyClicks++ });
	const checks: string[] = [];
	const check = (condition: boolean, label: string) => {
		if (!condition) throw new Error(label);
		checks.push(label);
	};
	const settle = () =>
		new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
	const active = new Map<string, HTMLElement>();
	const tracked =
		<T extends HTMLElement>(key: string) =>
		(node: T | null) => {
			if (!node) {
				active.delete(key);
				return;
			}
			active.set(key, node);
			return () => {
				active.delete(key);
			};
		};
	const coverRef = createRef<HTMLDivElement>();
	const thumbRef = createRef<HTMLDivElement>();
	const videoRef = createRef<HTMLVideoElement>();
	let frameRef: Ref<HTMLDivElement> = tracked("frame1");
	let buttonRef: Ref<HTMLButtonElement> = tracked("button1");
	let opened = false;
	let requested: boolean | undefined;
	let vertical = false;
	let overrideClicks = 0;
	let override = false;
	const render = () =>
		flushSync(() =>
			root.render(
				<StrictMode>
					<Provider store={store}>
						<PrebuiltLyricPlayer
							style={{
								width: vertical ? 390 : 960,
								height: vertical ? 844 : 620,
							}}
							coverFrameRef={frameRef}
							coverProps={{
								ref: coverRef,
								videoRef,
								coverVideoPaused: true,
								id: "public-cover",
								style: { opacity: 0.9 },
							}}
							controlThumbProps={{
								ref: thumbRef,
								buttonRef,
								buttonLabel: "Collapse",
								...(override ? { onClick: () => overrideClicks++ } : {}),
							}}
							playlistOpened={opened}
							onPlaylistOpenedChange={(next) => {
								requested = next;
							}}
							playlistControls="host-queue"
							playlistButtonLabel="Queue"
						/>
					</Provider>
				</StrictMode>,
			),
		);
	try {
		render();
		await settle();
		check(
			coverRef.current?.id === "public-cover",
			"coverProps targets the live cover",
		);
		check(
			coverRef.current?.style.getPropertyValue("--scale-level") === "0.75",
			"custom style preserves Cover defaults",
		);
		check(
			active.get("frame1")?.contains(coverRef.current) === true,
			"coverFrameRef targets the layout anchor",
		);
		check(
			thumbRef.current?.contains(active.get("button1") ?? null) === true,
			"container and interactive button refs are distinct",
		);
		(active.get("button1") as HTMLButtonElement).click();
		check(
			legacyClicks === 1,
			"legacy collapse atom callback remains the default",
		);
		const oldFrame = active.get("frame1");
		const oldButton = active.get("button1");
		frameRef = tracked("frame2");
		buttonRef = tracked("button2");
		override = true;
		render();
		await settle();
		check(
			!active.has("frame1") && active.get("frame2") === oldFrame,
			"replaced frame callback cleans up and receives the same node",
		);
		check(
			!active.has("button1") && active.get("button2") === oldButton,
			"replaced button callback cleans up and receives the same node",
		);
		(active.get("button2") as HTMLButtonElement).click();
		check(
			overrideClicks === 1 && legacyClicks === 1,
			"explicit collapse handler overrides the atom callback",
		);
		for (const portrait of [false, true]) {
			vertical = portrait;
			render();
			await settle();
			check(
				active.get("frame2")?.contains(coverRef.current) === true,
				`${portrait ? "vertical" : "horizontal"} frame owns current cover`,
			);
			check(
				active.get("button2")?.tagName === "BUTTON",
				"button ref follows responsive layout",
			);
			const buttons = () =>
				Array.from(
					fixture.querySelectorAll<HTMLButtonElement>("[aria-label=Queue]"),
				);
			check(
				buttons().length === 1,
				"the layout playlist button exposes the public label",
			);
			for (const button of buttons()) {
				check(
					button.getAttribute("aria-controls") === "host-queue" &&
						button.getAttribute("aria-expanded") === "false",
					"queue ownership and closed state are exposed",
				);
				button.click();
				check(requested === true, "queue button requests opening");
			}
			opened = true;
			render();
			await settle();
			for (const button of buttons()) {
				check(
					button.getAttribute("aria-expanded") === "true",
					"controlled queue state reaches every button",
				);
				button.click();
				check(requested === false, "queue button requests closing");
			}
			opened = false;
		}
		const objectFrame = createRef<HTMLDivElement>();
		const objectButton = createRef<HTMLButtonElement>();
		frameRef = objectFrame;
		buttonRef = objectButton;
		render();
		await settle();
		check(
			active.size === 0 && !!objectFrame.current && !!objectButton.current,
			"object refs replace callback refs",
		);
		vertical = false;
		render();
		await settle();
		check(
			objectFrame.current?.contains(coverRef.current) === true &&
				objectButton.current?.isConnected === true,
			"object refs follow responsive remount",
		);
		flushSync(() => store.set(musicCoverIsVideoAtom, true));
		await settle();
		check(
			videoRef.current?.tagName === "VIDEO" && !videoRef.current.autoplay,
			"video ref exposes a video with autoplay disabled when paused",
		);
		flushSync(() => store.set(musicCoverIsVideoAtom, false));
		check(
			videoRef.current === null,
			"switching to an image clears the video ref",
		);
		flushSync(() => root.unmount());
		check(
			[objectFrame, objectButton, coverRef, thumbRef, videoRef].every(
				(ref) => ref.current === null,
			),
			"unmount clears every external ref",
		);
		result.textContent = JSON.stringify(
			{ passed: checks.length, checks },
			null,
			2,
		);
	} catch (error) {
		root.unmount();
		result.textContent = JSON.stringify(
			{ failed: String(error), checks },
			null,
			2,
		);
	} finally {
		run.disabled = false;
	}
};
