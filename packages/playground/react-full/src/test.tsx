import { Provider, useStore } from "jotai";
import { type FC, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrebuiltLyricPlayer } from "@react-full/components/PrebuiltLyricPlayer";
import { HorizontalLayout } from "@react-full/layout/horizontal";
import { VerticalLayout } from "@react-full/layout/vertical";
import { hideLyricViewAtom } from "@react-full/states/configAtoms";
import { musicLyricLinesAtom } from "@react-full/states/dataAtoms";

const App: FC = () => {
	const [hideLyric, setHideLyric] = useState(false);
	const store = useStore();

	useEffect(() => {
		store.set(musicLyricLinesAtom, [
			{
				words: [
					{
						word: "Test",
						startTime: 0,
						endTime: 1000,
						romanWord: "",
					},
				],
				startTime: 0,
				endTime: 1000,
				translatedLyric: "",
				romanLyric: "",
				isBG: false,
				isDuet: false,
			},
		]);
	}, [store]);

	useEffect(() => {
		store.set(hideLyricViewAtom, hideLyric);
	}, [hideLyric, store]);

	return (
		<>
			<h1>AMLL React Framework gallery</h1>
			<a href="/prebuilt">Go to Prebuilt Player</a>
			<h2>Prebuilt Player</h2>
			<PrebuiltLyricPlayer
				style={{
					width: "100%",
					maxWidth: "100vw",
					overflow: "hidden",
					height: "100vh",
					backgroundColor: "#222",
				}}
			/>
			<h2>Horizontal Layout</h2>
			<label>
				<input
					type="checkbox"
					id="showLyric"
					checked={hideLyric}
					onChange={(v) => setHideLyric(!!v.target.checked)}
				/>
				Hide lyric
			</label>

			<div>{hideLyric ? "Lyric is hidden" : "Lyric is shown"}</div>

			<div
				style={{
					width: "100%",
					maxWidth: "100vw",
					overflow: "hidden",
					height: "80vh",
					backgroundColor: "black",
				}}
			>
				<HorizontalLayout
					style={{
						width: "100%",
						height: "100%",
					}}
					thumbSlot={
						<div style={{ background: "red", width: "100%", height: "100%" }}>
							Thumb slot
						</div>
					}
					coverSlot={
						<div style={{ background: "green", width: "100%", height: "100%" }}>
							Cover slot
						</div>
					}
					controlsSlot={
						<div
							style={{ background: "orange", width: "100%", height: "100%" }}
						>
							Controls slot
						</div>
					}
					lyricSlot={
						<div style={{ background: "pink", width: "100%", height: "100%" }}>
							Lyric slot
						</div>
					}
					hideLyric={hideLyric}
				/>
			</div>
			<h2>Vertical Layout</h2>
			<label>
				<input
					type="checkbox"
					id="showLyric"
					checked={hideLyric}
					onChange={(v) => setHideLyric(!!v.target.checked)}
				/>
				Hide lyric
			</label>
			<div
				style={{
					backgroundColor: "black",
					width: "40vw",
					maxWidth: "800px",
					maxHeight: "80vh",
					flex: "0",
				}}
			>
				<VerticalLayout
					style={{
						width: "100%",
						height: "100%",
					}}
					thumbSlot={
						<div style={{ background: "red", width: "100%", height: "100%" }}>
							Thumb slot
						</div>
					}
					coverSlot={
						<div style={{ background: "green", width: "100%", height: "100%" }}>
							Cover slot
						</div>
					}
					smallControlsSlot={
						<div
							style={{ background: "orange", width: "100%", height: "100%" }}
						>
							Small Controls slot
						</div>
					}
					bigControlsSlot={
						<div style={{ background: "aqua", width: "100%", height: "100%" }}>
							Big Controls slot
						</div>
					}
					lyricSlot={
						<div style={{ background: "pink", width: "100%", height: "100%" }}>
							Lyric slot
						</div>
					}
					hideLyric={hideLyric}
				/>
			</div>
		</>
	);
};

createRoot(document.getElementById("root") as HTMLElement).render(
	<Provider>
		<App />
	</Provider>,
);
