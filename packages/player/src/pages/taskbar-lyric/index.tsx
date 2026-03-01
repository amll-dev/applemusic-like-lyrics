import type { LyricLine } from "@applemusic-like-lyrics/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	METADATA_EVENT,
	PLAY_STATUS_EVENT,
	POSITION_EVENT,
	type TaskbarLyricMetadataPayload,
	type TaskbarLyricPlayStatusPayload,
	type TaskbarLyricPositionPayload,
} from "../../components/TaskbarLyricBridge/index.tsx";
import styles from "./index.module.css";

function findCurrentLyricIndex(lines: LyricLine[], position: number): number {
	let low = 0;
	let high = lines.length - 1;
	let index = -1;
	while (low <= high) {
		const mid = (low + high) >> 1;
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
};

export const TaskbarLyricApp = () => {
	const [musicName, setMusicName] = useState("等待同步...");
	const [musicArtists, setMusicArtists] = useState("");
	const [musicCover, setMusicCover] = useState("");
	const [musicCoverIsVideo, setMusicCoverIsVideo] = useState(false);
	const [position, setPosition] = useState(0);
	const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
	const [jumpState, setJumpState] = useState({ lastIndex: -1, jumpId: 0 });

	const anchorRef = useRef({ position: 0, time: performance.now() });
	const playingRef = useRef(false);

	const updateAnchor = useCallback((pos: number) => {
		anchorRef.current = { position: pos, time: performance.now() };
		setPosition(pos);
	}, []);

	useEffect(() => {
		const unlistenMetadata = listen<TaskbarLyricMetadataPayload>(
			METADATA_EVENT,
			(evt) => {
				const data = evt.payload;
				setMusicName(data.musicName);
				setMusicArtists(data.musicArtists.map((a) => a.name).join(" / "));
				setLyricLines(data.lyricLines);
				setMusicCover(data.musicCover);
				setMusicCoverIsVideo(data.musicCoverIsVideo);
			},
		);

		const unlistenPlayStatus = listen<TaskbarLyricPlayStatusPayload>(
			PLAY_STATUS_EVENT,
			(evt) => {
				playingRef.current = evt.payload.musicPlaying;
				anchorRef.current = {
					position: anchorRef.current.position,
					time: performance.now(),
				};
			},
		);

		const unlistenPosition = listen<TaskbarLyricPositionPayload>(
			POSITION_EVENT,
			(evt) => {
				updateAnchor(evt.payload.position);
			},
		);

		return () => {
			unlistenMetadata.then((fn) => fn());
			unlistenPlayStatus.then((fn) => fn());
			unlistenPosition.then((fn) => fn());
		};
	}, [updateAnchor]);

	useEffect(() => {
		let rafId: number;
		const onFrame = () => {
			if (playingRef.current) {
				const elapsed = performance.now() - anchorRef.current.time;
				setPosition(anchorRef.current.position + elapsed);
			}
			rafId = requestAnimationFrame(onFrame);
		};
		rafId = requestAnimationFrame(onFrame);
		return () => cancelAnimationFrame(rafId);
	}, []);

	const LYRIC_OFFSET = 300;
	const effectivePosition = position + LYRIC_OFFSET;

	const hasLyrics = lyricLines.length > 0;
	const firstLyricTime = hasLyrics
		? lyricLines[0].startTime
		: Number.MAX_SAFE_INTEGER;

	const isMetadataMode = effectivePosition < firstLyricTime || !hasLyrics;
	const currentLyricIndex = useMemo(
		() => findCurrentLyricIndex(lyricLines, effectivePosition),
		[lyricLines, effectivePosition],
	);

	let currentJumpId = jumpState.jumpId;
	if (isMetadataMode) {
		if (jumpState.lastIndex !== -1) {
			setJumpState({ lastIndex: -1, jumpId: 0 });
		}
	} else {
		if (currentLyricIndex !== jumpState.lastIndex) {
			const isJump =
				jumpState.lastIndex !== -1 &&
				currentLyricIndex !== jumpState.lastIndex + 1;
			currentJumpId = isJump ? jumpState.jumpId + 1 : jumpState.jumpId;

			setJumpState({ lastIndex: currentLyricIndex, jumpId: currentJumpId });
		}
	}

	const currentLine =
		currentLyricIndex >= 0 ? lyricLines[currentLyricIndex] : null;
	const subLyricText = currentLine
		? currentLine.translatedLyric || currentLine.romanLyric || ""
		: "";
	const hasSubLyric = Boolean(subLyricText);

	const groupKey = isMetadataMode
		? `meta-${musicName}-${musicArtists}`
		: hasSubLyric
			? `lyrics-group-${musicName}-${currentLyricIndex}`
			: `lyrics-${musicName}-${currentJumpId}`;

	const lyricItems: LyricItem[] = useMemo(() => {
		if (isMetadataMode) return [];
		const items: LyricItem[] = [];
		if (currentLyricIndex >= 0 && currentLine) {
			items.push({
				key: `lyric-${currentLyricIndex}`,
				text: getLyricText(currentLine),
				status: "primary",
			});

			if (hasSubLyric) {
				items.push({
					key: `lyric-${currentLyricIndex}-sub`,
					text: subLyricText,
					status: "secondary",
				});
			} else if (currentLyricIndex + 1 < lyricLines.length) {
				items.push({
					key: `lyric-${currentLyricIndex + 1}`,
					text: getLyricText(lyricLines[currentLyricIndex + 1]),
					status: "secondary",
				});
			}
		}
		return items;
	}, [
		isMetadataMode,
		currentLyricIndex,
		lyricLines,
		currentLine,
		hasSubLyric,
		subLyricText,
	]);

	const handleMouseEnter = () => {
		invoke("set_click_interception", { intercept: true }).catch(console.error);
	};

	const handleMouseLeave = (_e: React.MouseEvent) => {
		invoke("set_click_interception", { intercept: false }).catch(console.error);
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 仅鼠标交互
		<div
			className={styles.container}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<div className={styles.coverWrapper}>
				{musicCover ? (
					musicCoverIsVideo ? (
						<video
							className={styles.cover}
							src={musicCover}
							autoPlay
							loop
							muted
							playsInline
						/>
					) : (
						<img className={styles.cover} src={musicCover} alt="Cover" />
					)
				) : (
					<div className={styles.coverPlaceholder} />
				)}
			</div>

			<div className={styles.textPanel}>
				<AnimatePresence>
					<motion.div
						key={groupKey}
						className={styles.groupContainer}
						initial={{ y: 35, opacity: 0, filter: "blur(4px)" }}
						animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
						exit={{ y: -15, opacity: 0, filter: "blur(4px)" }}
						transition={{ type: "spring", stiffness: 250, damping: 30 }}
					>
						{isMetadataMode ? (
							<>
								<div
									className={styles.animatedLine}
									style={{ transform: "translateY(0px) scale(1)", opacity: 1 }}
								>
									{musicName}
								</div>
								<div
									className={styles.animatedLine}
									style={{
										transform: "translateY(22px) scale(0.8)",
										opacity: 0.6,
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
										initial={{
											y: 50,
											opacity: 0,
											scale: 0.8,
											filter: "blur(0px)",
										}}
										animate={
											item.status === "primary"
												? { y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }
												: {
														y: 22,
														opacity: 0.5,
														scale: 0.8,
														filter: "blur(0px)",
													}
										}
										exit={{
											y: -15,
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
										{item.text}
									</motion.div>
								))}
							</AnimatePresence>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
};
