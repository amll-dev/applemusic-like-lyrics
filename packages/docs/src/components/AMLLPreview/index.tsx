import type { LyricLine } from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css";
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { useLayoutEffect, useRef, useState } from "react";

const buildLyricLines = (
	lyric: string,
	startTime: number,
	otherParams: Partial<LyricLine> = {},
): LyricLine => {
	let curTime = startTime;
	const words = [];
	for (const word of lyric.split("|")) {
		const [text, duration] = word.split(",");
		const endTime = curTime + Number(duration);
		words.push({
			word: text,
			startTime: curTime,
			endTime,
			obscene: false,
		});
		curTime = endTime;
	}
	return {
		startTime,
		endTime: curTime + 500,
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
		words,
		...otherParams,
	};
};

const DEMO_LYRICS: LyricLine[][] = [
	[
		buildLyricLines(
			"Apple ,350|Music ,300|Like ,300|Ly,500|ri,900|cs ,250",
			2000,
			{ translatedLyric: "类苹果歌词" },
		),
		// A lyric component library for the web
		buildLyricLines(
			"A ,200|ly,100|ric ,250|com,200|po,200|nent ,200|li,100|bra,200|ry ,100|for ,100|the ,200|web ,600",
			5000,
			{ translatedLyric: "为 Web 而生的歌词组件库" },
		),
		// Brought to you with
		buildLyricLines("Brought ,300|to ,250|you ,800|with ,600", 8000, {
			translatedLyric: "为你带来",
		}),
		// Background Lyric Line
		buildLyricLines("Background ,750|lyric ,300|line ,500", 8500, {
			translatedLyric: "背景歌词行",
			isBG: true,
		}),
		// And Duet Lyric Line
		buildLyricLines("And ,300|Duet ,300|lyric ,500|line ,650", 10500, {
			translatedLyric: "还有对唱歌词行",
			isDuet: true,
		}),
	],
];

export const AMLLPreview = () => {
	const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
	const [currentTime, setCurrentTime] = useState(0);
	const wRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		let selectedDemo = DEMO_LYRICS.length - 1;
		let endTime = 0;
		let startTime = 0;
		let canceled = false;

		const onFrame = (time: number) => {
			if (canceled) return;
			if (time - startTime > endTime) {
				const w = wRef.current;
				if (!w) {
					if (canceled) return;
					return;
				}
				if (canceled) return;

				w.animate(
					{
						opacity: 0,
						filter: "blur(10px)",
					},
					{
						duration: 500,
						easing: "ease-in-out",
						fill: "forwards",
					},
				).onfinish = () => {
					if (canceled) return;

					selectedDemo = (selectedDemo + 1) % DEMO_LYRICS.length;
					setLyricLines(JSON.parse(JSON.stringify(DEMO_LYRICS[selectedDemo])));
					endTime = DEMO_LYRICS[selectedDemo].reduce(
						(acc, v) => Math.max(acc, v.endTime),
						0,
					);
					startTime = time;

					setTimeout(() => {
						if (canceled) return;
						w.animate(
							{
								opacity: 1,
								filter: "blur(0px)",
							},
							{
								duration: 300,
								easing: "ease-in-out",
								fill: "forwards",
							},
						).onfinish = () => {
							if (canceled) return;
							requestAnimationFrame(onFrame);
						};
					}, 600);
				};
			} else {
				setCurrentTime((time - startTime) | 0);
				requestAnimationFrame(onFrame);
			}
		};

		requestAnimationFrame(onFrame);
		return () => {
			canceled = true;
		};
	}, []);

	return (
		<div
			style={{
				height: "100%",
				maskImage:
					"linear-gradient(to bottom, transparent 0%, white 5%, white 95%, transparent 100%)",
				transition: "opacity 0.5s, filter 0.5s",
			}}
			ref={wRef}
		>
			<LyricPlayer
				currentTime={currentTime}
				lyricLines={lyricLines}
				alignAnchor="top"
				alignPosition={0.05}
				style={{
					height: "100%",
				}}
			/>
		</div>
	);
};
