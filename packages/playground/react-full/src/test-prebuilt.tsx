import { ContextMenu, Theme } from "@radix-ui/themes";
import { Provider, useStore } from "jotai";
import {
	type FC,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createRoot } from "react-dom/client";
import { PrebuiltLyricPlayer } from "@react-full/components/PrebuiltLyricPlayer";
import "@radix-ui/themes/styles.css";
import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
	parseLrc,
	parseLys,
	parseQrc,
	parseTTML,
	parseYrc,
	type LyricLine as RawLyricLine,
} from "@applemusic-like-lyrics/lyric";
import { onRequestOpenMenuAtom } from "@react-full/states/callbacks";
import { hideLyricViewAtom } from "@react-full/states/configAtoms";
import {
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicLyricLinesAtom,
	musicNameAtom,
} from "@react-full/states/dataAtoms";
import jsmediatags from "jsmediatags";

const mapLyric = (
	line: RawLyricLine,
	_i: number,
	_lines: RawLyricLine[],
): LyricLine => ({
	words: line.words.map((w) => ({ ...w, obscene: false })),
	startTime: line.words[0]?.startTime ?? 0,
	endTime:
		line.words[line.words.length - 1]?.endTime ?? Number.POSITIVE_INFINITY,
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
});

const App: FC = () => {
	const [hideLyric, setHideLyric] = useState(false);
	const audioRef = useRef<HTMLAudioElement>(null);
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

	const onRequestOpenMenu = useCallback(() => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		inputEl.accept = "audio/*";
		inputEl.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (!files) return;
			const file = files[0];
			jsmediatags.read(file, {
				onSuccess(tag) {
					console.log("tag read", tag);
					const title: string = tag.tags?.title ?? file.name ?? "未知歌曲";
					const album: string = tag.tags?.album ?? "未知专辑";
					const artist: string = tag.tags?.artist ?? "未知作者";
					// const lyrics: string = tag.tags?.lyrics ?? "";
					store.set(musicNameAtom, title);
					store.set(musicAlbumNameAtom, album);
					store.set(musicArtistsAtom, [{ name: artist, id: "unknown" }]);
					if ("picture" in tag.tags && tag.tags.picture) {
						const { data, format } = tag.tags.picture;
						let base64String = "";
						for (let i = 0; i < data.length; i++) {
							base64String += String.fromCharCode(data[i]);
						}
						const imgUrl = `data:${format};base64,${window.btoa(base64String)}`;
						store.set(musicCoverAtom, imgUrl);
					}
				},
				onError(error) {
					console.log(error);
				},
			});
		};
		inputEl.click();
	}, [store]);

	const loadLyric = useCallback(
		(format: "yrc" | "qrc" | "ttml" | "lrc" | "lys" | "") => {
			let accept: string;
			switch (format) {
				case "yrc":
					accept = ".yrc";
					break;
				case "qrc":
					accept = ".qrc";
					break;
				case "ttml":
					accept = ".ttml";
					break;
				case "lrc":
					accept = ".lrc";
					break;
				case "lys":
					accept = ".lys";
					break;
				default:
					accept = "";
					store.set(musicLyricLinesAtom, []);
					return;
			}
			const inputEl = document.createElement("input");
			inputEl.type = "file";
			inputEl.accept = accept;
			inputEl.onchange = async (e) => {
				const files = (e.target as HTMLInputElement).files;
				if (!files) return;
				const file = files[0];
				const raw = await file.text();
				let lines: RawLyricLine[];
				switch (format) {
					case "yrc":
						lines = parseYrc(raw);
						break;
					case "qrc":
						lines = parseQrc(raw);
						break;
					case "ttml":
						lines = parseTTML(raw).lines;
						break;
					case "lrc":
						lines = parseLrc(raw);
						break;
					case "lys":
						lines = parseLys(raw);
						break;
				}
				store.set(musicLyricLinesAtom, lines.map(mapLyric));
			};
			inputEl.click();
		},
		[store],
	);

	useLayoutEffect(() => {}, []);

	useLayoutEffect(() => {
		store.set(onRequestOpenMenuAtom, {
			onEmit: onRequestOpenMenu,
		});
	}, [store, onRequestOpenMenu]);

	return (
		<>
			<audio ref={audioRef} />

			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<PrebuiltLyricPlayer
						style={{
							position: "fixed",
							width: "100%",
							maxWidth: "100vw",
							overflow: "hidden",
							height: "100vh",
							backgroundColor: "#222",
						}}
					/>
				</ContextMenu.Trigger>
				<ContextMenu.Content size="1">
					<ContextMenu.Label>AMLL React 框架示例</ContextMenu.Label>
					<ContextMenu.Item onSelect={onRequestOpenMenu}>
						打开音乐文件
					</ContextMenu.Item>
					<ContextMenu.CheckboxItem
						checked={!hideLyric}
						onCheckedChange={(e) => setHideLyric(!e)}
					>
						显示歌词
					</ContextMenu.CheckboxItem>
					<ContextMenu.Sub>
						<ContextMenu.SubTrigger>设置歌词</ContextMenu.SubTrigger>
						<ContextMenu.SubContent>
							<ContextMenu.Item onClick={() => loadLyric("")}>
								空歌词
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item onClick={() => loadLyric("ttml")}>
								TTML 歌词
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => loadLyric("lys")}>
								Lyricify Syllable 歌词
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item onClick={() => loadLyric("lrc")}>
								LyRiC 歌词
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => loadLyric("yrc")}>
								YRC 歌词
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => loadLyric("qrc")}>
								QRC 歌词
							</ContextMenu.Item>
						</ContextMenu.SubContent>
					</ContextMenu.Sub>
				</ContextMenu.Content>
			</ContextMenu.Root>
		</>
	);
};

createRoot(document.getElementById("root") as HTMLElement).render(
	<Provider>
		<Theme appearance="dark">
			<App />
		</Theme>
	</Provider>,
);
