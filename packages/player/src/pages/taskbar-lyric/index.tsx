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
	for (let i = lines.length - 1; i >= 0; i--) {
		if (position >= lines[i].startTime) {
			return i;
		}
	}
	return -1;
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

	const hasLyrics = lyricLines.length > 0;
	const firstLyricTime = hasLyrics
		? lyricLines[0].startTime
		: Number.MAX_SAFE_INTEGER;

	const isMetadataMode = position < firstLyricTime || !hasLyrics;
	const currentLyricIndex = useMemo(
		() => findCurrentLyricIndex(lyricLines, position),
		[lyricLines, position],
	);

	const groupKey = isMetadataMode
		? `meta-${musicName}-${musicArtists}`
		: `lyrics-${musicName}`;

	const lyricItems: LyricItem[] = useMemo(() => {
		if (isMetadataMode) return [];
		const items: LyricItem[] = [];
		if (currentLyricIndex >= 0) {
			items.push({
				key: `lyric-${currentLyricIndex}`,
				text: getLyricText(lyricLines[currentLyricIndex]),
				status: "primary",
			});
		}
		if (currentLyricIndex + 1 < lyricLines.length) {
			items.push({
				key: `lyric-${currentLyricIndex + 1}`,
				text: getLyricText(lyricLines[currentLyricIndex + 1]),
				status: "secondary",
			});
		}
		return items;
	}, [isMetadataMode, currentLyricIndex, lyricLines]);

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
						initial={{ y: 50, opacity: 0, filter: "blur(4px)" }}
						animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
						exit={{ y: -15, opacity: 0, filter: "blur(4px)" }}
						transition={{ type: "spring", stiffness: 250, damping: 30 }}
					>
						{isMetadataMode ? (
							<>
								<motion.div
									className={styles.animatedLine}
									initial={{ y: 0, opacity: 1, scale: 1 }}
								>
									{musicName}
								</motion.div>
								<motion.div
									className={styles.animatedLine}
									initial={{ y: 22, opacity: 0.6, scale: 0.8 }}
								>
									{musicArtists}
								</motion.div>
							</>
						) : (
							<AnimatePresence>
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
