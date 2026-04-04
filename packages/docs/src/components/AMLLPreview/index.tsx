import type { LyricLine } from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css";
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { useLayoutEffect, useRef, useState } from "react";

const buildLyricLines = (
	lyric: string,
	startTime = 1000,
	otherParams: Partial<LyricLine> = {},
): LyricLine => {
	let curTime = startTime;
	const words = [];
	for (const word of lyric.split("|")) {
		const [text, duration] = word.split(",");
		const endTime = curTime + Number.parseInt(duration);
		words.push({
			word: text,
			romanWord: "",
			startTime: curTime,
			endTime,
			obscene: false,
		});
		curTime = endTime;
	}
	return {
		startTime,
		endTime: curTime + 3000,
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
			"Apple ,750|Music ,500|Like ,500|Ly,400|ri,500|cs ,250",
			1000,
			{
				translatedLyric: "类苹果歌词",
			},
		),
		// A lyric component library for the web
		buildLyricLines(
			"A ,400|ly,500|ric ,250|com,500|po,500|nent ,500|li,500|bra,500|ry ,500|for ,500|the ,500|web ,500",
			7000,
			{
				translatedLyric: "为 Web 而生的歌词组件库",
			},
		),
		// Brought to you with
		buildLyricLines("Brought ,500|to ,250|you ,800|with ,600", 16000, {
			translatedLyric: "为你带来",
		}),
		// Background Lyric Line
		buildLyricLines("Background ,750|Lyric ,300|Line ,500", 16500, {
			translatedLyric: "背景歌词行",
			isBG: true,
		}),
		// And Duet Lyric Line
		buildLyricLines("And ,300|Duet ,500|Lyric ,500|Line ,750", 21150, {
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
