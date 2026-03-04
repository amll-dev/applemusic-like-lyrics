import type { LyricLine } from "@applemusic-like-lyrics/core";
import { MediaButton } from "@applemusic-like-lyrics/react-full";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import IconForward from "../../assets/icon_forward.svg?react";
import IconPause from "../../assets/icon_pause.svg?react";
import IconPlay from "../../assets/icon_play.svg?react";
import IconRewind from "../../assets/icon_rewind.svg?react";
import {
	ALIGN_EVENT,
	CTRL_NEXT_EVENT,
	CTRL_PLAY_OR_RESUME_EVENT,
	CTRL_PREV_EVENT,
	METADATA_EVENT,
	PLAY_STATUS_EVENT,
	POSITION_EVENT,
	type TaskbarLyricAlignmentPayload,
	type TaskbarLyricMetadataPayload,
	type TaskbarLyricPlayStatusPayload,
	type TaskbarLyricPositionPayload,
	type TaskbarLyricThemePayload,
	THEME_EVENT,
} from "../../components/TaskbarLyricBridge/index.tsx";
import styles from "./index.module.css";
import { LyricScroll } from "./LyricScroll.tsx";

const LYRIC_OFFSET = 300;

function findCurrentLyricIndex(lines: LyricLine[], position: number): number {
	let low = 0;
	let high = lines.length - 1;
	let index = -1;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const lineTime = lines[mid].startTime;
		if (lineTime <= position) {
			index = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return index;
}

function getLyricText(line: LyricLine): string {
	return line.words.map((w) => w.word).join("");
}

type LyricItem = {
	key: string;
	text: string;
	status: "primary" | "secondary";
	startTime?: number;
	endTime?: number;
	nextStartTime?: number;
	isActive: boolean;
};

interface AppState {
	musicName: string;
	musicArtists: string;
	musicCover: string;
	musicCoverIsVideo: boolean;
	musicPlaying: boolean;
	lyricLines: LyricLine[];
	currentLyricIndex: number;
	jumpState: { lastIndex: number; jumpId: number };
	theme: "dark" | "light";
	align: "left" | "right";
}

type Action =
	| { type: "SYNC_METADATA"; payload: TaskbarLyricMetadataPayload }
	| { type: "UPDATE_INDEX"; payload: number }
	| { type: "UPDATE_PLAY_STATUS"; payload: boolean }
	| { type: "UPDATE_THEME"; payload: "dark" | "light" }
	| { type: "UPDATE_ALIGN"; payload: "left" | "right" };

function reducer(state: AppState, action: Action): AppState {
	switch (action.type) {
		case "SYNC_METADATA": {
			const data = action.payload;
			return {
				...state,
				musicName: data.musicName,
				musicArtists: data.musicArtists.map((a) => a.name).join(" / "),
				musicCover: data.musicCover,
				musicCoverIsVideo: data.musicCoverIsVideo,
				lyricLines: data.lyricLines,
				currentLyricIndex: -1,
				jumpState: { lastIndex: -1, jumpId: 0 },
			};
		}

		case "UPDATE_INDEX": {
			const nextIndex = action.payload;
			if (nextIndex === state.currentLyricIndex) return state;

			const prevLastIndex = state.jumpState.lastIndex;
			const isJump = prevLastIndex !== -1 && nextIndex !== prevLastIndex + 1;

			return {
				...state,
				currentLyricIndex: nextIndex,
				jumpState: {
					lastIndex: nextIndex,
					jumpId: isJump ? state.jumpState.jumpId + 1 : state.jumpState.jumpId,
				},
			};
		}

		case "UPDATE_PLAY_STATUS": {
			return { ...state, musicPlaying: action.payload };
		}

		case "UPDATE_THEME": {
			return { ...state, theme: action.payload };
		}

		case "UPDATE_ALIGN": {
			return { ...state, align: action.payload };
		}

		default: {
			return state;
		}
	}
}

const initialState: AppState = {
	musicName: "未知歌曲",
	musicArtists: "",
	musicCover: "",
	musicCoverIsVideo: false,
	musicPlaying: false,
	lyricLines: [],
	currentLyricIndex: -1,
	jumpState: { lastIndex: -1, jumpId: 0 },
	theme: "light",
	align: "left",
};

export const TaskbarLyricApp = () => {
	const [state, dispatch] = useReducer(reducer, initialState);
	const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
		"horizontal",
	);
	const [isHovered, setIsHovered] = useState(false);
	const prevHoverRef = useRef(isHovered);
	const isHoverEvent = prevHoverRef.current !== isHovered;
	useEffect(() => {
		prevHoverRef.current = isHovered;
	}, [isHovered]);
	const positionRef = useRef(0);
	const anchorRef = useRef({ position: 0, time: performance.now() });

	const progressSubscribersRef = useRef<Set<(progress: number) => void>>(
		new Set(),
	);
	const publishProgress = useCallback((progress: number) => {
		progressSubscribersRef.current.forEach((cb) => {
			cb(progress);
		});
	}, []);
	const subscribeProgress = useCallback((cb: (progress: number) => void) => {
		progressSubscribersRef.current.add(cb);
		return () => {
			progressSubscribersRef.current.delete(cb);
		};
	}, []);

	const lyricLinesRef = useRef<LyricLine[]>([]);
	useEffect(() => {
		lyricLinesRef.current = state.lyricLines;
	}, [state.lyricLines]);

	const updateAnchor = useCallback((pos: number) => {
		anchorRef.current = { position: pos, time: performance.now() };
		positionRef.current = pos;

		const nextIndex = findCurrentLyricIndex(
			lyricLinesRef.current,
			pos + LYRIC_OFFSET,
		);
		dispatch({ type: "UPDATE_INDEX", payload: nextIndex });
	}, []);

	useEffect(() => {
		const handleResize = () => {
			if (window.innerHeight > window.innerWidth) {
				setOrientation("vertical");
			} else {
				setOrientation("horizontal");
			}
		};

		handleResize();

		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	useEffect(() => {
		const unlistenMetadata = listen<TaskbarLyricMetadataPayload>(
			METADATA_EVENT,
			(evt) => {
				dispatch({ type: "SYNC_METADATA", payload: evt.payload });
			},
		);

		const unlistenPlayStatus = listen<TaskbarLyricPlayStatusPayload>(
			PLAY_STATUS_EVENT,
			(evt) => {
				const playing = evt.payload.musicPlaying;
				anchorRef.current = {
					position: anchorRef.current.position,
					time: performance.now(),
				};

				dispatch({ type: "UPDATE_PLAY_STATUS", payload: playing });
			},
		);

		const unlistenPosition = listen<TaskbarLyricPositionPayload>(
			POSITION_EVENT,
			(evt) => {
				updateAnchor(evt.payload.position);
			},
		);

		const unlistenTheme = listen<TaskbarLyricThemePayload>(
			THEME_EVENT,
			(evt) => {
				dispatch({ type: "UPDATE_THEME", payload: evt.payload.theme });
			},
		);

		const unlistenAlign = listen<TaskbarLyricAlignmentPayload>(
			ALIGN_EVENT,
			(evt) => dispatch({ type: "UPDATE_ALIGN", payload: evt.payload.align }),
		);

		const unlistenLayoutExtra = listen<{
			isCentered: boolean;
			systemType: string;
		}>("taskbar-layout-extra", (evt) => {
			dispatch({
				type: "UPDATE_ALIGN",
				payload: evt.payload.isCentered ? "left" : "right",
			});
		});

		const unlistenSystemTheme = listen<{ isLightTheme: boolean }>(
			"system-theme-changed",
			(evt) => {
				dispatch({
					type: "UPDATE_THEME",
					payload: evt.payload.isLightTheme ? "light" : "dark",
				});
			},
		);

		return () => {
			unlistenMetadata.then((fn) => fn());
			unlistenPlayStatus.then((fn) => fn());
			unlistenPosition.then((fn) => fn());
			unlistenTheme.then((fn) => fn());
			unlistenAlign.then((fn) => fn());
			unlistenLayoutExtra.then((fn) => fn());
			unlistenSystemTheme.then((fn) => fn());
		};
	}, [updateAnchor]);

	useEffect(() => {
		if (!state.musicPlaying) return;

		let rafId: number;
		const onFrame = () => {
			const elapsed = performance.now() - anchorRef.current.time;
			const currentPos = anchorRef.current.position + elapsed;
			positionRef.current = currentPos;

			const effectivePosition = currentPos + LYRIC_OFFSET;
			const nextIndex = findCurrentLyricIndex(
				lyricLinesRef.current,
				effectivePosition,
			);

			dispatch({ type: "UPDATE_INDEX", payload: nextIndex });

			rafId = requestAnimationFrame(onFrame);
		};

		rafId = requestAnimationFrame(onFrame);

		return () => cancelAnimationFrame(rafId);
	}, [state.musicPlaying]);

	const {
		musicName,
		musicArtists,
		musicCover,
		musicCoverIsVideo,
		lyricLines,
		currentLyricIndex,
		jumpState,
		theme,
		align,
	} = state;

	const hasLyrics = lyricLines.length > 0;
	const isMetadataMode = currentLyricIndex < 0 || !hasLyrics;
	const displayAsMetadata = isMetadataMode || isHovered;

	const currentLine =
		currentLyricIndex >= 0 ? lyricLines[currentLyricIndex] : null;
	const subLyricText = currentLine
		? currentLine.translatedLyric || currentLine.romanLyric || ""
		: "";
	const hasSubLyric = Boolean(subLyricText);

	const groupKey = displayAsMetadata
		? `meta-${musicName}-${musicArtists}`
		: hasSubLyric
			? `lyrics-group-${musicName}-${currentLyricIndex}`
			: `lyrics-${musicName}-${jumpState.jumpId}`;

	const lyricItems: LyricItem[] = useMemo(() => {
		if (displayAsMetadata) return [];
		const items: LyricItem[] = [];
		if (currentLyricIndex >= 0 && currentLine) {
			const nextLine =
				currentLyricIndex + 1 < lyricLines.length
					? lyricLines[currentLyricIndex + 1]
					: undefined;

			items.push({
				key: `lyric-${currentLyricIndex}`,
				text: getLyricText(currentLine),
				status: "primary",
				startTime: currentLine.startTime,
				endTime: currentLine.endTime,
				nextStartTime: nextLine?.startTime,
				isActive: true,
			});

			if (hasSubLyric) {
				items.push({
					key: `lyric-${currentLyricIndex}-sub`,
					text: subLyricText,
					status: "secondary",
					startTime: currentLine.startTime,
					endTime: currentLine.endTime,
					nextStartTime: nextLine?.startTime,
					isActive: true,
				});
			} else if (nextLine) {
				const nextNextLine =
					currentLyricIndex + 2 < lyricLines.length
						? lyricLines[currentLyricIndex + 2]
						: undefined;

				items.push({
					key: `lyric-${currentLyricIndex + 1}`,
					text: getLyricText(nextLine),
					status: "secondary",
					startTime: nextLine.startTime,
					endTime: nextLine.endTime,
					nextStartTime: nextNextLine?.startTime,
					isActive: false,
				});
			}
		}
		return items;
	}, [
		displayAsMetadata,
		currentLyricIndex,
		lyricLines,
		currentLine,
		hasSubLyric,
		subLyricText,
	]);

	const handleMouseEnter = () => {
		setIsHovered(true);
		invoke("set_click_interception", { intercept: true }).catch(console.error);
	};

	const handleMouseLeave = () => {
		setIsHovered(false);
		invoke("set_click_interception", { intercept: false }).catch(console.error);
	};

	const handlePrev = (e: React.MouseEvent) => {
		e.stopPropagation();
		emit(CTRL_PREV_EVENT).catch(console.error);
	};

	const handleTogglePlay = (e: React.MouseEvent) => {
		e.stopPropagation();
		emit(CTRL_PLAY_OR_RESUME_EVENT).catch(console.error);
	};

	const handleNext = (e: React.MouseEvent) => {
		e.stopPropagation();
		emit(CTRL_NEXT_EVENT).catch(console.error);
	};

	useEffect(() => {
		invoke("set_click_interception", { intercept: false }).catch(console.error);
	}, []);

	useEffect(() => {
		const disableContextMenu = (e: MouseEvent) => {
			e.preventDefault();
		};

		document.addEventListener("contextmenu", disableContextMenu);

		return () => {
			document.removeEventListener("contextmenu", disableContextMenu);
		};
	}, []);

	const isVert = orientation === "vertical";
	const isSingleLine = lyricItems.length === 1;

	return (
		<div
			className={styles.wrapper}
			data-align={align}
			data-orientation={orientation}
		>
			{/** biome-ignore lint/a11y/noStaticElementInteractions: 仅鼠标交互 */}
			<div
				className={styles.container}
				data-theme={theme}
				data-align={align}
				data-orientation={orientation}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				<div className={styles.coverWrapper}>
					<AnimatePresence initial={false}>
						{musicCover ? (
							musicCoverIsVideo ? (
								<motion.video
									key={musicCover}
									className={styles.cover}
									src={musicCover}
									autoPlay
									loop
									muted
									playsInline
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.3, ease: "easeInOut" }}
								/>
							) : (
								<motion.img
									key={musicCover}
									className={styles.cover}
									src={musicCover}
									alt="Cover"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.3, ease: "easeInOut" }}
								/>
							)
						) : (
							<motion.div
								key="placeholder"
								className={styles.coverPlaceholder}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.3, ease: "easeInOut" }}
							/>
						)}
					</AnimatePresence>
				</div>

				<AnimatePresence initial={false}>
					{isHovered && (
						<motion.div
							className={styles.controlsWrapper}
							initial={
								isVert
									? { height: 0, opacity: 0, marginTop: -12 }
									: { width: 0, opacity: 0, marginLeft: -12 }
							}
							animate={
								isVert
									? { height: "auto", opacity: 1, marginTop: 0 }
									: { width: "auto", opacity: 1, marginLeft: 0 }
							}
							exit={
								isVert
									? { height: 0, opacity: 0, marginTop: -12 }
									: { width: 0, opacity: 0, marginLeft: -12 }
							}
							transition={{ type: "spring", stiffness: 400, damping: 35 }}
						>
							<div className={styles.controlsPanel}>
								<MediaButton className={styles.controlBtn} onClick={handlePrev}>
									<IconRewind className={styles.controlBtnIcon} />
								</MediaButton>
								<MediaButton
									className={`${styles.controlBtn} ${styles.controlBtnPlay}`}
									onClick={handleTogglePlay}
								>
									{state.musicPlaying ? (
										<IconPause className={styles.controlBtnIconPlay} />
									) : (
										<IconPlay className={styles.controlBtnIconPlay} />
									)}
								</MediaButton>
								<MediaButton className={styles.controlBtn} onClick={handleNext}>
									<IconForward className={styles.controlBtnIcon} />
								</MediaButton>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<div className={styles.textPanel}>
					<AnimatePresence custom={isHoverEvent}>
						<motion.div
							key={groupKey}
							className={styles.groupContainer}
							custom={isHoverEvent}
							variants={{
								initial: (isHoverFade: boolean) => ({
									x: isHoverFade ? 0 : isVert ? -35 : 0,
									y: isHoverFade ? 0 : isVert ? 0 : 35,
									opacity: 0,
									filter: isHoverFade ? "blur(0px)" : "blur(4px)",
								}),
								animate: (isHoverFade: boolean) => ({
									x: 0,
									y: 0,
									opacity: 1,
									filter: "blur(0px)",
									transition: isHoverFade
										? { duration: 0.2, ease: "easeOut" }
										: { type: "spring", stiffness: 250, damping: 30 },
								}),
								exit: (isHoverFade: boolean) => ({
									x: isHoverFade ? 0 : isVert ? 15 : 0,
									y: isHoverFade ? 0 : isVert ? 0 : -15,
									opacity: 0,
									filter: isHoverFade ? "blur(0px)" : "blur(4px)",
									transition: isHoverFade
										? { duration: 0.15, ease: "easeIn" }
										: { type: "spring", stiffness: 250, damping: 30 },
								}),
							}}
							initial="initial"
							animate="animate"
							exit="exit"
						>
							<div className={styles.ghostPanel} aria-hidden="true">
								{displayAsMetadata ? (
									<>
										<div className={styles.ghostLine}>{musicName}</div>
										<div className={styles.ghostLine}>{musicArtists}</div>
									</>
								) : (
									lyricItems.map((item) => (
										<div key={item.key} className={styles.ghostLine}>
											{item.text}
										</div>
									))
								)}
							</div>

							{displayAsMetadata ? (
								<>
									<div
										className={styles.animatedLine}
										data-status="primary"
										style={{
											transform: isVert
												? "translateX(-0.2em) scale(1)"
												: "translateY(0px) scale(1)",
											opacity: 1,
										}}
									>
										{musicName}
									</div>
									<div
										className={styles.animatedLine}
										data-status="secondary"
										style={{
											transform: isVert
												? "translateX(-1.8em) scale(0.85)"
												: "translateY(1.2em) scale(0.85)",
											opacity: 1,
										}}
									>
										{musicArtists}
									</div>
								</>
							) : (
								<AnimatePresence initial={false}>
									{lyricItems.map((item) => (
										<motion.div
											key={item.key}
											className={styles.animatedLine}
											data-status={item.status}
											initial={{
												x: isVert ? "-2.5em" : 0,
												y: isVert ? 0 : "2.5em",
												opacity: 0,
												scale: 0.8,
												filter: "blur(0px)",
											}}
											animate={
												item.status === "primary"
													? {
															x: isVert ? "-0.2em" : 0,
															y: isVert ? 0 : isSingleLine ? "0.5em" : 0,
															opacity: 1,
															scale: 1,
															filter: "blur(0px)",
														}
													: {
															x: isVert ? "-1.8em" : 0,
															y: isVert ? 0 : "1.2em",
															opacity: 1,
															scale: 0.8,
															filter: "blur(0px)",
														}
											}
											exit={{
												x: isVert ? "0.8em" : 0,
												y: isVert ? 0 : "-0.8em",
												opacity: 0,
												scale: 1,
												filter: "blur(4px)",
											}}
											transition={{
												type: "spring",
												stiffness: 250,
												damping: 30,
												mass: 0.8,
											}}
										>
											<LyricScroll
												text={item.text}
												status={item.status}
												orientation={orientation}
												align={align}
												startTime={item.startTime}
												endTime={item.endTime}
												nextStartTime={item.nextStartTime}
												isActive={item.isActive}
												isPlaying={state.musicPlaying}
												getCurrentPosition={() => positionRef.current}
												onProgress={
													item.status === "primary"
														? publishProgress
														: undefined
												}
												subscribeProgress={
													item.status === "secondary"
														? subscribeProgress
														: undefined
												}
											/>
										</motion.div>
									))}
								</AnimatePresence>
							)}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
};
