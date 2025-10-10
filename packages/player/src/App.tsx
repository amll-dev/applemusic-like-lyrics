import { Box, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { platform, version } from "@tauri-apps/plugin-os";
import classNames from "classnames";
import { atom, useAtomValue, useStore } from "jotai";
import { lazy, StrictMode, Suspense, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import semverGt from "semver/functions/gt";
import styles from "./App.module.css";
import { AppContainer } from "./components/AppContainer/index.tsx";
import { DarkThemeDetector } from "./components/DarkThemeDetector/index.tsx";
import { ExtensionInjectPoint } from "./components/ExtensionInjectPoint/index.tsx";
import { LocalMusicContext } from "./components/LocalMusicContext/index.tsx";
import { NowPlayingBar } from "./components/NowPlayingBar/index.tsx";
import { ShotcutContext } from "./components/ShotcutContext/index.tsx";
import { SystemListenerMusicContext } from "./components/SystemListenerMusicContext/index.tsx";
import { UpdateContext } from "./components/UpdateContext/index.tsx";
import { WSProtocolMusicContext } from "./components/WSProtocolMusicContext/index.tsx";
import "./i18n";
import {
	isLyricPageOpenedAtom,
	LyricSizePreset,
	lyricSizePresetAtom,
	onClickAudioQualityTagAtom,
} from "@applemusic-like-lyrics/react-full";
import { invoke } from "@tauri-apps/api/core";
import { StateConnector } from "./components/StateConnector/index.tsx";
import { StatsComponent } from "./components/StatsComponent/index.tsx";
import { router } from "./router.tsx";
import {
	DarkMode,
	darkModeAtom,
	displayLanguageAtom,
	isDarkThemeAtom,
	MusicContextMode,
	musicContextModeAtom,
	showStatJSFrameAtom,
} from "./states/appAtoms.ts";
import { audioQualityDialogOpenedAtom } from "./states/smtcAtoms.ts";

const ExtensionContext = lazy(() => import("./components/ExtensionContext"));
const AMLLWrapper = lazy(() => import("./components/AMLLWrapper"));

const hasBackgroundAtom = atom(false);

function App() {
	const store = useStore();
	const isLyricPageOpened = useAtomValue(isLyricPageOpenedAtom);
	const showStatJSFrame = useAtomValue(showStatJSFrameAtom);
	const musicContextMode = useAtomValue(musicContextModeAtom);
	const displayLanguage = useAtomValue(displayLanguageAtom);
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const hasBackground = useAtomValue(hasBackgroundAtom);
	const { i18n } = useTranslation();

	const darkMode = useAtomValue(darkModeAtom);

	const lyricSize = useAtomValue(lyricSizePresetAtom);

	useEffect(() => {
		const syncThemeToWindow = async () => {
			if (darkMode === DarkMode.Auto) {
				await invoke("reset_window_theme").catch((err) => {
					console.error("重置主题失败:", err);
				});
			} else {
				const { getCurrentWindow } = await import("@tauri-apps/api/window");
				const appWindow = getCurrentWindow();
				const finalTheme = darkMode === DarkMode.Dark ? "dark" : "light";
				await appWindow.setTheme(finalTheme);
			}
		};
		syncThemeToWindow();
	}, [darkMode]);

	useEffect(() => {
		const initializeWindow = async () => {
			if ((window as any).__AMLL_PLAYER_INITIALIZED__) return;
			(window as any).__AMLL_PLAYER_INITIALIZED__ = true;

			setTimeout(async () => {
				const { getCurrentWindow } = await import("@tauri-apps/api/window");
				const appWindow = getCurrentWindow();
				if (platform() === "windows" && !semverGt(version(), "10.0.22000")) {
					store.set(hasBackgroundAtom, true);
					await appWindow.clearEffects();
				}
				await appWindow.show();
			}, 50);
		};
		initializeWindow();
	}, [store]);

	useLayoutEffect(() => {
		console.log("displayLanguage", displayLanguage, i18n);
		i18n.changeLanguage(displayLanguage);
	}, [i18n, displayLanguage]);

	useEffect(() => {
		store.set(onClickAudioQualityTagAtom, {
			onEmit() {
				store.set(audioQualityDialogOpenedAtom, true);
			},
		});
	}, [store]);

	useEffect(() => {
		let fontSizeFormula = "";
		switch (lyricSize) {
			case LyricSizePreset.Tiny:
				fontSizeFormula = "max(max(2.5vh, 1.25vw), 10px)";
				break;
			case LyricSizePreset.ExtraSmall:
				fontSizeFormula = "max(max(3vh, 1.5vw), 10px)";
				break;
			case LyricSizePreset.Small:
				fontSizeFormula = "max(max(4vh, 2vw), 12px)";
				break;
			case LyricSizePreset.Large:
				fontSizeFormula = "max(max(6vh, 3vw), 16px)";
				break;
			case LyricSizePreset.ExtraLarge:
				fontSizeFormula = "max(max(7vh, 3.5vw), 18px)";
				break;
			case LyricSizePreset.Huge:
				fontSizeFormula = "max(max(8vh, 4vw), 20px)";
				break;
			default:
				fontSizeFormula = "max(max(5vh, 2.5vw), 14px)";
				break;
		}

		const styleId = "amll-font-size-style";
		let styleTag = document.getElementById(styleId);

		if (!styleTag) {
			styleTag = document.createElement("style");
			styleTag.id = styleId;
			document.head.appendChild(styleTag);
		}

		styleTag.innerHTML = `
            .amll-lyric-player {
                font-size: ${fontSizeFormula} !important;
            }
        `;
	}, [lyricSize]);

	// 渲染逻辑
	return (
		<>
			{/* 上下文组件均不建议被 StrictMode 包含，以免重复加载扩展程序发生问题  */}
			{showStatJSFrame && <StatsComponent />}
			{musicContextMode === MusicContextMode.Local && (
				<LocalMusicContext key={MusicContextMode.Local} />
			)}
			{musicContextMode === MusicContextMode.SystemListener && (
				<SystemListenerMusicContext key={MusicContextMode.SystemListener} />
			)}
			{musicContextMode === MusicContextMode.WSProtocol && (
				<WSProtocolMusicContext
					key={MusicContextMode.WSProtocol}
					isLyricOnly={false}
				/>
			)}

			<UpdateContext />
			<ShotcutContext />
			<DarkThemeDetector />
			<Suspense>
				<ExtensionContext />
			</Suspense>
			<ExtensionInjectPoint injectPointName="context" hideErrorCallout />
			<StateConnector />

			{/* UI渲染 */}
			<StrictMode>
				<Theme
					appearance={isDarkTheme ? "dark" : "light"}
					panelBackground="solid"
					hasBackground={hasBackground}
					className={styles.radixTheme}
				>
					<Box
						className={classNames(
							styles.body,
							isLyricPageOpened && styles.amllOpened,
						)}
					>
						<AppContainer playbar={<NowPlayingBar />}>
							<RouterProvider router={router} />
						</AppContainer>
						{/* <Box className={styles.container}>
							<RouterProvider router={router} />
						</Box> */}
					</Box>
					<Suspense>
						<AMLLWrapper />
					</Suspense>
					<ToastContainer
						theme="dark"
						position="bottom-right"
						style={{
							marginBottom: "150px",
						}}
					/>
				</Theme>
			</StrictMode>
		</>
	);
}

export default App;
