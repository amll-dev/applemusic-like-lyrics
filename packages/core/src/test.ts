/**
 * @fileoverview
 * 此处是一个简易的组件加载测试脚本，用来调试歌词
 *
 * @author SteveXMH
 */

import * as lyrics from "@applemusic-like-lyrics/lyric";
import {
	parseLrc,
	parseLys,
	parseQrc,
	parseTTML,
	parseYrc,
	type LyricLine as RawLyricLine,
} from "@applemusic-like-lyrics/lyric";
import GUI from "lil-gui";
import Stats from "stats.js";
import type { LyricLine } from ".";
import {
	BackgroundRender,
	MeshGradientRenderer,
	PixiRenderer,
} from "./bg-render";
import { DomLyricPlayer, type LyricLineMouseEvent } from "./lyric-player";
import type { SpringParams } from "./utils/spring";

type GuiController = { updateDisplay(): void };

let lyricController: GuiController | null = null;
let musicController: GuiController | null = null;
let localLyric: { name: string; content: string } | null = null;
let localAudioName: string | null = null;
let localAudioUrl: string | null = null;

(window as any).lyrics = lyrics;

const audio = document.createElement("audio");
audio.volume = 0.5;
audio.preload = "auto";

const debugValues = {
	lyric: new URL(location.href).searchParams.get("lyric") || "",
	music: new URL(location.href).searchParams.get("music") || "",
	album: new URL(location.href).searchParams.get("album") || "",
	async loadLocalTTML() {
		const file = await pickLocalFile(".ttml");
		if (!file) return;
		const content = await file.text();
		localLyric = { name: file.name, content };
		await loadLyric(file.name, content);
		debugValues.lyric = file.name;
		lyricController?.updateDisplay();
	},
	async loadLocalAudio() {
		const file = await pickLocalFile("audio/*");
		if (!file) return;
		if (localAudioUrl) {
			URL.revokeObjectURL(localAudioUrl);
		}
		localAudioName = file.name;
		localAudioUrl = URL.createObjectURL(file);
		audio.src = localAudioUrl;
		audio.load();
		debugValues.music = file.name;
		musicController?.updateDisplay();
	},
	enableSpring: true,
	bgFPS: 60,
	bgMode: new URL(location.href).searchParams.get("bg") || "mg",
	bgScale: 1,
	bgFlowSpeed: 2,
	bgPlaying: true,
	bgStaticMode: true,
	currentTime: 0,
	enableBlur: true,
	playing: false,
	async mockPlay() {
		this.playing = true;
		const startTime = Date.now();
		const baseTime = this.currentTime * 1000;
		while (this.playing && this.currentTime < 300) {
			const time = Date.now() - startTime;
			this.currentTime = (baseTime + time) / 1000;
			progress.updateDisplay();
			lyricPlayer.setCurrentTime(baseTime + time);
			await waitFrame();
		}
	},
	play() {
		this.playing = true;
		audio.load();
		audio.play();
	},
	pause() {
		this.playing = false;
		if (audio.paused) {
			audio.play();
			lyricPlayer.resume();
		} else {
			audio.pause();
			lyricPlayer.pause();
		}
	},
	fadeWidth: 0.5,
	lineSprings: {
		posX: {
			mass: 1,
			damping: 10,
			stiffness: 100,
			soft: false,
		} as SpringParams,
		posY: {
			mass: 1,
			damping: 15,
			stiffness: 100,
			soft: false,
		} as SpringParams,
		scale: {
			mass: 1,
			damping: 20,
			stiffness: 100,
			soft: false,
		} as SpringParams,
	},
};

const pickLocalFile = (accept: string): Promise<File | null> =>
	new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.onchange = () => {
			resolve(input.files?.[0] ?? null);
		};
		input.click();
	});

function recreateBGRenderer(mode: string) {
	window.globalBackground?.dispose();
	if (mode === "pixi") {
		window.globalBackground = BackgroundRender.new(PixiRenderer);
	} else if (mode === "mg") {
		window.globalBackground = BackgroundRender.new(MeshGradientRenderer);
	} else {
		throw new Error("Unknown renderer mode");
	}
	const bg = window.globalBackground;
	bg.setFPS(debugValues.bgFPS);
	bg.setRenderScale(debugValues.bgScale);
	bg.setStaticMode(debugValues.bgStaticMode);
	bg.getElement().style.position = "absolute";
	bg.getElement().style.top = "0";
	bg.getElement().style.left = "0";
	bg.getElement().style.width = "100%";
	bg.getElement().style.height = "100%";
	bg.setAlbum(debugValues.album);
}

audio.src = debugValues.music;
audio.load();

const gui = new GUI();
gui.close();

gui.title("AMLL 歌词测试页面");
lyricController = gui
	.add(debugValues, "lyric")
	.name("歌词文件")
	.onFinishChange((url: string) => {
		void loadLyric(url);
	});
musicController = gui
	.add(debugValues, "music")
	.name("歌曲")
	.onFinishChange((v: string) => {
		if (localAudioUrl && localAudioName && v === localAudioName) {
			audio.src = localAudioUrl;
		} else {
			audio.src = v;
		}
	});
gui
	.add(debugValues, "album")
	.name("专辑图片")
	.onFinishChange((v: string) => {
		window.globalBackground.setAlbum(v);
	});

const localGui = gui.addFolder("本地文件");
localGui.add(debugValues, "loadLocalTTML").name("加载本地TTML");
localGui.add(debugValues, "loadLocalAudio").name("加载本地音频");

const bgGui = gui.addFolder("背景");
bgGui
	.add(debugValues, "bgPlaying")
	.name("播放")
	.onFinishChange((v: boolean) => {
		if (v) {
			window.globalBackground.resume();
		} else {
			window.globalBackground.pause();
		}
	});
bgGui
	.add(debugValues, "bgMode", ["pixi", "mg"])
	.name("背景渲染器")
	.onFinishChange((v: string) => {
		recreateBGRenderer(v);
	});
bgGui
	.add(debugValues, "bgScale", 0.01, 1, 0.01)
	.name("分辨率比率")
	.onChange((v: number) => {
		window.globalBackground.setRenderScale(v);
	});
bgGui
	.add(debugValues, "bgFPS", 1, 60, 1)
	.name("帧率")
	.onFinishChange((v: number) => {
		window.globalBackground.setFPS(v);
	});
bgGui
	.add(debugValues, "bgFlowSpeed", 0, 10, 0.1)
	.name("流动速度")
	.onFinishChange((v: number) => {
		window.globalBackground.setFlowSpeed(v);
	});
bgGui
	.add(debugValues, "bgStaticMode")
	.name("静态模式")
	.onFinishChange((v: boolean) => {
		window.globalBackground.setStaticMode(v);
	});

{
	const animation = gui.addFolder("歌词行动画/效果");
	animation
		.add(debugValues, "fadeWidth", 0, 10, 0.01)
		.name("歌词渐变宽度")
		.onChange((v: number) => {
			lyricPlayer.setWordFadeWidth(v);
		});
	animation
		.add(debugValues, "enableBlur")
		.name("启用歌词模糊")
		.onChange((v: boolean) => {
			lyricPlayer.setEnableBlur(v);
		});
	animation
		.add(debugValues, "enableSpring")
		.name("使用弹簧动画")
		.onChange((v: boolean) => {
			lyricPlayer.setEnableSpring(v);
		});
	function addSpringDbg(name: string, obj: SpringParams, onChange: () => void) {
		const x = animation.addFolder(name);
		x.close();
		x.add(obj, "mass").name("质量").onFinishChange(onChange);
		x.add(obj, "damping").name("阻力").onFinishChange(onChange);
		x.add(obj, "stiffness").name("弹性").onFinishChange(onChange);
		x.add(obj, "soft")
			.name("强制软弹簧（当阻力小于 1 时有用）")
			.onFinishChange(onChange);
	}
	addSpringDbg("水平位移弹簧", debugValues.lineSprings.posX, () => {
		lyricPlayer.setLinePosXSpringParams(debugValues.lineSprings.posX);
	});
	addSpringDbg("垂直位移弹簧", debugValues.lineSprings.posY, () => {
		lyricPlayer.setLinePosYSpringParams(debugValues.lineSprings.posY);
	});
	addSpringDbg("缩放弹簧", debugValues.lineSprings.scale, () => {
		lyricPlayer.setLineScaleSpringParams(debugValues.lineSprings.scale);
	});
}

const playerGui = gui.addFolder("音乐播放器");
const progress = playerGui
	.add(debugValues, "currentTime")
	.min(0)
	.step(1)
	.name("当前进度")
	.onChange((v: number) => {
		audio.currentTime = v;
		lyricPlayer.setCurrentTime(v * 1000, true);
	});
playerGui.add(debugValues, "play").name("加载/播放");
playerGui.add(debugValues, "pause").name("暂停/继续");

const lyricPlayer = new DomLyricPlayer();

lyricPlayer.addEventListener("line-click", (evt) => {
	const e = evt as LyricLineMouseEvent;
	evt.preventDefault();
	evt.stopImmediatePropagation();
	evt.stopPropagation();
	console.log(e.line, e.lineIndex);
	audio.currentTime = e.line.getLine().startTime / 1000;
});

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);
let lastTime = -1;
const frame = (time: number) => {
	stats.end();
	if (lastTime === -1) {
		lastTime = time;
	}
	if (!audio.paused) {
		const time = (audio.currentTime * 1000) | 0;
		debugValues.currentTime = (time / 1000) | 0;
		progress.max(audio.duration | 0);
		progress.updateDisplay();
		lyricPlayer.setCurrentTime(time);
	}
	lyricPlayer.update(time - lastTime);
	lastTime = time;
	stats.begin();
	requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

declare global {
	interface Window {
		globalLyricPlayer: DomLyricPlayer;
		globalBackground:
			| BackgroundRender<PixiRenderer>
			| BackgroundRender<MeshGradientRenderer>;
	}
}

(window as any).globalLyricPlayer = lyricPlayer;

const waitFrame = (): Promise<number> =>
	new Promise((resolve) => requestAnimationFrame(resolve));
const mapLyricWord = (word: RawLyricLine["words"][number]) => ({
	...word,
	romanWord: word.romanWord ?? "",
	obscene: false,
});

const mapLyricLine = (line: RawLyricLine): LyricLine => ({
	words: line.words.map(mapLyricWord),
	startTime: Number.isFinite(line.startTime)
		? line.startTime
		: line.words[0]?.startTime ?? 0,
	endTime: Number.isFinite(line.endTime)
		? line.endTime
		: line.words[line.words.length - 1]?.endTime ?? Number.POSITIVE_INFINITY,
	translatedLyric: line.translatedLyric ?? "",
	romanLyric: line.romanLyric ?? "",
	vocal: line.vocal,
	isBG: line.isBG ?? false,
	isDuet: line.isDuet ?? false,
});

async function loadLyric(
	lyricFile = debugValues.lyric,
	lyricContent?: string,
) {
	if (!lyricFile) return;
	if (lyricFile === "bug") {
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

		const DEMO_LYRIC: LyricLine[] = [
			buildLyricLines(
				"Apple ,750|Music ,500|Like ,500|Ly,400|ri,500|cs ,250",
				1000,
			),
			buildLyricLines("BG ,750|Lyrics ,1000", 2000, {
				isBG: true,
			}),
			buildLyricLines("Next ,1000|Lyrics,1000", 2500, {
				// isDuet: true,
			}),
		];

		lyricPlayer.setLyricLines(DEMO_LYRIC);
		return;
	}

	const content =
		lyricContent ??
		(localLyric && lyricFile === localLyric.name
			? localLyric.content
			: await (await fetch(lyricFile)).text());
	const normalized = lyricFile.split("?")[0].toLowerCase();
	if (normalized.endsWith(".ttml")) {
		lyricPlayer.setLyricLines(parseTTML(content).lines.map(mapLyricLine));
	} else if (normalized.endsWith(".lrc")) {
		lyricPlayer.setLyricLines(parseLrc(content).map(mapLyricLine));
	} else if (normalized.endsWith(".yrc")) {
		lyricPlayer.setLyricLines(parseYrc(content).map(mapLyricLine));
	} else if (normalized.endsWith(".lys")) {
		lyricPlayer.setLyricLines(parseLys(content).map(mapLyricLine));
	} else if (normalized.endsWith(".qrc")) {
		lyricPlayer.setLyricLines(parseQrc(content).map(mapLyricLine));
	}
}


(async () => {
	recreateBGRenderer(debugValues.bgMode);
	audio.style.display = "none";
	// lyricPlayer.getBottomLineElement().innerHTML = "Test Bottom Line";
	const player = document.getElementById("player");
	if (player) {
		player.appendChild(audio);
		player.appendChild(window.globalBackground.getElement());
		player.appendChild(lyricPlayer.getElement());
	}
	if (!debugValues.enableSpring) {
		lyricPlayer.setEnableSpring(false);
	}
	await loadLyric();
	// debugValues.play();
	// debugValues.currentTime = 34;
	// debugValues.mockPlay();
})();
