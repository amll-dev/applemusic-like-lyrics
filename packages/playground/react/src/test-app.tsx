import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
	parseTTML,
	type LyricLine as RawLyricLine,
} from "@applemusic-like-lyrics/lyric";
import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundRender } from "@applemusic-like-lyrics/react";
import { LyricPlayer, type LyricPlayerRef } from "@applemusic-like-lyrics/react";

const mapTTMLLyric = (line: RawLyricLine): LyricLine => ({
	...line,
	words: line.words.map((word) => ({ obscene: false, ...word })),
});

export const App: FC = () => {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [audioUrl, setAudioUrl] = useState("");
	const [albumUrl, setAlbumUrl] = useState("");
	const [albumIsVideo, setAlbumIsVideo] = useState(false);
	const lyricPlayerRef = useRef<LyricPlayerRef>(null);
	const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
	const onClickOpenAudio = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*";
		input.onchange = () => {
			const file = input.files?.[0];
			if (file) {
				setAudioUrl((old) => {
					if (old.trim().length > 0) {
						URL.revokeObjectURL(old);
					}
					return URL.createObjectURL(file);
				});
			}
		};
		input.click();
	}, []);
	const onClickOpenAlbumImage = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*,video/*";
		input.onchange = () => {
			const file = input.files?.[0];
			if (file) {
				setAlbumIsVideo(file.type.startsWith("video/"));
				setAlbumUrl((old) => {
					if (old.trim().length > 0) {
						URL.revokeObjectURL(old);
					}
					return URL.createObjectURL(file);
				});
			}
		};
		input.click();
	}, []);
	const onClickOpenTTMLLyric = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".ttml,text/*";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (file) {
				const text = await file.text();
				setLyricLines(parseTTML(text).lines.map(mapTTMLLyric));
			}
		};
		input.click();
	}, []);
	useEffect(() => {
		if (audioRef.current) {
			let lastTime = -1;
			const onFrame = (time: number) => {
				if (audioRef.current && !audioRef.current.paused) {
					if (lastTime === -1) {
						lastTime = time;
					}
					lyricPlayerRef.current?.lyricPlayer?.update(time - lastTime);
					lastTime = time;
					lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(
						(audioRef.current.currentTime * 1000) | 0,
					);
					requestAnimationFrame(onFrame);
				}
			};
			const onPlay = () => onFrame(0);
			audioRef.current.addEventListener("play", onPlay);
			return () => {
				audioRef.current?.removeEventListener("play", onPlay);
			};
		}
	}, []);
	useEffect(() => {
		// 调试用途，暴露到 Window
		if (lyricPlayerRef.current) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			(window as any).lyricPlayer = lyricPlayerRef.current;
		}
	}, []);
	return (
		<>
			<BackgroundRender
				style={{
					position: "absolute",
					top: "0",
					left: "0",
					width: "100%",
					height: "100%",
				}}
				album={albumUrl}
				albumIsVideo={albumIsVideo}
			/>
			<LyricPlayer
				style={{
					position: "absolute",
					top: "0",
					left: "0",
					width: "100%",
					height: "100%",
					maxWidth: "100%",
					maxHeight: "100%",
					contain: "paint layout",
					overflow: "hidden",
					mixBlendMode: "plus-lighter",
				}}
				ref={lyricPlayerRef}
				alignAnchor="center"
				lyricLines={lyricLines}
			/>
			<div
				style={{
					position: "absolute",
					right: "0",
					bottom: "0",
					backgroundColor: "#0004",
					margin: "1rem",
					padding: "1rem",
					borderRadius: "0.5rem",
					color: "white",
					display: "flex",
					flexDirection: "column",
					gap: "0.5rem",
				}}
			>
				<div>AMLL React 绑定调试页面</div>
				<div>为了减少依赖，没有过多的调试设置。</div>
				<div>更加详尽的调试可以直接使用 Core 模块调试。</div>
				<button type="button" onClick={onClickOpenAudio}>
					加载音乐
				</button>
				<button type="button" onClick={onClickOpenAlbumImage}>
					加载专辑背景资源（图片/视频）
				</button>
				<button type="button" onClick={onClickOpenTTMLLyric}>
					加载歌词
				</button>
				{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
				<audio controls ref={audioRef} src={audioUrl} preload="auto" />
			</div>
		</>
	);
};
