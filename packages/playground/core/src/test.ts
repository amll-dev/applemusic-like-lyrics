/**
 * @fileoverview
 * 此处是一个简易的组件加载测试脚本，用来调试歌词
 *
 * @author SteveXMH
 */

import type { LyricLine } from "@applemusic-like-lyrics/core";
import {
	BackgroundRender,
	DomLyricPlayer,
	type LyricLineMouseEvent,
	MeshGradientRenderer,
	PixiRenderer,
} from "@applemusic-like-lyrics/core";
import * as lyrics from "@applemusic-like-lyrics/lyric";
import {
	parseLrc,
	parseLys,
	parseQrc,
	parseYrc,
	type LyricLine as RawLyricLine,
} from "@applemusic-like-lyrics/lyric";
import { parseTTML } from "@applemusic-like-lyrics/ttml";
import GUI from "lil-gui";
import Stats from "stats.js";

export interface SpringParams {
	mass: number; // = 1.0
	damping: number; // = 10.0
	stiffness: number; // = 100.0
	soft: boolean; // = false
}

(window as any).lyrics = lyrics;

const audio = document.createElement("audio");
audio.volume = 0.5;
audio.preload = "auto";

const debugValues = {
	lyric: new URL(location.href).searchParams.get("lyric") || "",
	music: new URL(location.href).searchParams.get("music") || "",
	album: new URL(location.href).searchParams.get("album") || "",
	enableSpring: true,
	bgFPS: 60,
	bgMode: new URL(location.href).searchParams.get("bg") || "mg",
	bgScale: 1,
	bgFlowSpeed: 0.2,
	bgPlaying: true,
	bgStaticMode: false,
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
	forceUpdateAlbum() {
		window.globalBackground.setAlbum(debugValues.album);
	},
	forceUpdateLyric() {
		loadLyric();
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
	bg.setFlowSpeed(debugValues.bgFlowSpeed);
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
const lyricController = gui
	.add(debugValues, "lyric")
	.name("歌词文件")
	.onFinishChange(async (url: string) => {
		lyricPlayer.setLyricLines(parseTTML(await (await fetch(url)).text()).lines);
	});
const localFileApi = {
	openLocalLyricFile() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".ttml,.lrc,.yrc,.lys,.qrc";
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			localLyricExt = file.name;
			if (localLyricUrl) {
				URL.revokeObjectURL(localLyricUrl);
			}
			localLyricUrl = URL.createObjectURL(file);
			debugValues.lyric = localLyricUrl;
			lyricController.updateDisplay();
			await loadLyric();
		};
		input.click();
	},
	openLocalMusicFile() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*";
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			if (localMusicUrl) {
				URL.revokeObjectURL(localMusicUrl);
			}
			localMusicUrl = URL.createObjectURL(file);
			debugValues.music = localMusicUrl;
			audio.src = localMusicUrl;
			audio.load();
			musicController.updateDisplay();
		};
		input.click();
	},
};
gui.add(localFileApi, "openLocalLyricFile").name("打开本地歌词");
gui.add(localFileApi, "openLocalMusicFile").name("打开本地歌曲");
const musicController = gui
	.add(debugValues, "music")
	.name("歌曲")
	.onFinishChange((v: string) => {
		audio.src = v;
	});
gui
	.add(debugValues, "album")
	.name("专辑图片")
	.onFinishChange((v: string) => {
		window.globalBackground.setAlbum(v);
	});
gui.add(debugValues, "forceUpdateAlbum").name("强制更新专辑图片");
gui.add(debugValues, "forceUpdateLyric").name("强制更新歌词");
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
	.add(debugValues, "bgFPS", 1, 1000, 1)
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
	const time = e.line.getLine().startTime;
	lyricPlayer.setCurrentTime(time, true);
	audio.currentTime = time / 1000;
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
let localLyricUrl: string | null = null;
let localLyricExt: string | null = null;
let localMusicUrl: string | null = null;
const mapLyric = (
	line: RawLyricLine,
	_i: number,
	_lines: RawLyricLine[],
): LyricLine => ({
	words: line.words.map((word) => ({
		...word,
		obscene: false,
		romanWord: word.romanWord ?? "",
	})),
	startTime: line.words[0]?.startTime ?? 0,
	endTime:
		line.words[line.words.length - 1]?.endTime ?? Number.POSITIVE_INFINITY,
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
});

async function loadLyric() {
	const lyricFile = debugValues.lyric;
	const content = await (await fetch(lyricFile)).text();
	const lyricSource = (localLyricExt ?? lyricFile).toLowerCase();
	if (lyricSource.endsWith(".ttml")) {
		lyricPlayer.setLyricLines(parseTTML(content).lines);
	} else if (lyricSource.endsWith(".lrc")) {
		lyricPlayer.setLyricLines(parseLrc(content).map(mapLyric));
	} else if (lyricSource.endsWith(".yrc")) {
		lyricPlayer.setLyricLines(parseYrc(content).map(mapLyric));
	} else if (lyricSource.endsWith(".lys")) {
		lyricPlayer.setLyricLines(parseLys(content).map(mapLyric));
	} else if (lyricSource.endsWith(".qrc")) {
		lyricPlayer.setLyricLines(parseQrc(content).map(mapLyric));
	} else if (lyricFile === "bug") {
		const buildLyricLines = (
			lyric: string,
			startTime = 1000,
			otherParams: Partial<LyricLine> = {},
		): LyricLine => {
			let curTime = startTime;
			const words = [];
			for (const word of lyric.split("|")) {
				const [text, duration] = word.split(",");
				const endTime = curTime + Number.parseInt(duration, 10);
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
