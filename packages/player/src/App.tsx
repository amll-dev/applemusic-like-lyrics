import { Box, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import classNames from "classnames";
import { useAtomValue } from "jotai";
import { lazy, StrictMode, Suspense, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import styles from "./App.module.css";
import { AppContainer } from "./components/AppContainer/index.tsx";
import { ExtensionInjectPoint } from "./components/ExtensionInjectPoint/index.tsx";
import { LocalMusicContext } from "./components/LocalMusicContext/index.tsx";
import { NowPlayingBar } from "./components/NowPlayingBar/index.tsx";
import { ShotcutContext } from "./components/ShotcutContext/index.tsx";
import { TaskbarLyricBridge } from "./components/TaskbarLyricBridge/index.tsx";
import { ThemeManager } from "./components/ThemeManager/index.tsx";
import { UpdateContext } from "./components/UpdateContext/index.tsx";
import { WSProtocolMusicContext } from "./components/WSProtocolMusicContext/index.tsx";
import "./i18n";
import { isLyricPageOpenedAtom } from "@applemusic-like-lyrics/react-full";
import { StatsComponent } from "./components/StatsComponent/index.tsx";
import { router } from "./router.tsx";
import {
	displayLanguageAtom,
	hasBackgroundAtom,
	isDarkThemeAtom,
	MusicContextMode,
	musicContextModeAtom,
	showStatJSFrameAtom,
} from "./states/appAtoms.ts";
import { useInitializeWindow } from "./utils/useInitializeWindow.ts";

const ExtensionContext = lazy(() => import("./components/ExtensionContext"));
const AMLLWrapper = lazy(() => import("./components/AMLLWrapper"));

function App() {
	const isLyricPageOpened = useAtomValue(isLyricPageOpenedAtom);
	const showStatJSFrame = useAtomValue(showStatJSFrameAtom);
	const musicContextMode = useAtomValue(musicContextModeAtom);
	const displayLanguage = useAtomValue(displayLanguageAtom);
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const hasBackground = useAtomValue(hasBackgroundAtom);
	const { i18n } = useTranslation();

	useInitializeWindow();

	useLayoutEffect(() => {
		i18n.changeLanguage(displayLanguage);
	}, [displayLanguage]);

	return (
		<>
			{/* 上下文组件均不建议被 StrictMode 包含，以免重复加载扩展程序发生问题  */}
			{showStatJSFrame && <StatsComponent />}
			{musicContextMode === MusicContextMode.Local && (
				<LocalMusicContext key={MusicContextMode.Local} />
			)}
			<TaskbarLyricBridge />
			{musicContextMode === MusicContextMode.WSProtocol && (
				<WSProtocolMusicContext
					key={MusicContextMode.WSProtocol}
					isLyricOnly={false}
				/>
			)}

			<UpdateContext />
			<ShotcutContext />
			<ThemeManager />
			<Suspense>
				<ExtensionContext />
			</Suspense>
			<ExtensionInjectPoint injectPointName="context" hideErrorCallout />

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
