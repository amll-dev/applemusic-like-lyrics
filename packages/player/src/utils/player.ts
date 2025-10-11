import { invoke } from "@tauri-apps/api/core";
import { type EventCallback, listen } from "@tauri-apps/api/event";
import chalk from "chalk";
import { uid } from "uid";

export interface AudioThreadEventMessage<T> {
	callbackId: string;
	data: T;
}

export interface AudioQuality {
	sampleRate?: number;
	bitsPerCodedSample?: number;
	bitsPerSample?: number;
	channels?: number;
	sampleFormat?: string;
	codec?: string;
}

export interface AudioInfo {
	name: string;
	artist: string;
	album: string;
	lyric: string;
	coverMediaType: string;
	// 本质是 Uint8Array
	// TODO: 返回成 Base64？
	cover?: number[];
	duration: number;
	position: number;
}

export type SongData =
	| {
			type: "local";
			filePath: string;
			origOrder: number;
	  }
	| {
			type: "custom";
			id: string;
			songJsonData: string;
			origOrder: number;
	  };

export type AudioThreadMessageMap = {
	resumeAudio: {};
	pauseAudio: {};
	resumeOrPauseAudio: {};
	seekAudio: {
		position: number;
	};
	jumpToSong: {
		songIndex: number;
	};
	prevSong: {};
	nextSong: {};
	setPlaylist: {
		songs: SongData[];
	};
	setVolume: {
		volume: number;
	};
	setVolumeRelative: {
		volume: number;
	};
	setAudioOutput: {
		name: string;
	};
	setFFTRange: {
		fromFreq: number;
		toFreq: number;
	};
	setMediaControlsEnabled: {
		enabled: boolean;
	};
	syncStatus: {};
	close: {};
};

export type AudioThreadMessageKeys = keyof AudioThreadMessageMap;

export type AudioThreadMessagePayloadMap = {
	[T in keyof AudioThreadMessageMap]: {
		type: T;
	} & AudioThreadMessageMap[T];
};

export type AudioThreadMessage =
	AudioThreadMessagePayloadMap[AudioThreadMessageKeys];

export type AudioThreadEvent =
	| {
			type: "playPosition";
			data: { position: number };
	  }
	| {
			type: "loadProgress";
			data: { position: number };
	  }
	| {
			type: "loadAudio";
			data: {
				musicId: string;
				musicInfo: AudioInfo;
				quality: AudioQuality;
				currentPlayIndex: number;
			};
	  }
	| {
			type: "loadingAudio";
			data: { musicId: string; currentPlayIndex: number };
	  }
	| {
			type: "syncStatus";
			data: {
				musicId: string;
				musicInfo: AudioInfo;
				isPlaying: boolean;
				duration: number;
				position: number;
				volume: number;
				loadPosition: number;
				playlist: SongData[];
				currentPlayIndex: number;
				playlistInited: boolean;
				quality: AudioQuality;
			};
	  }
	| {
			type: "playListChanged";
			data: {
				playlist: SongData[];
				currentPlayIndex: number;
			};
	  }
	| {
			type: "playStatus";
			data: { isPlaying: boolean };
	  }
	| {
			type: "setDuration";
			data: { duration: number };
	  }
	| {
			type: "loadError";
			data: { error: string };
	  }
	| {
			type: "volumeChanged";
			data: { volume: number };
	  }
	| {
			type: "fftData";
			data: { data: number[] };
	  };

const msgTasks = new Map<string, (value: unknown) => void>();
const eventListeners = new Set<EventCallback<AudioThreadEventMessage<any>>>();

let isInitialized = false;

export async function initAudioThread() {
	if (isInitialized) {
		return;
	}
	isInitialized = true;

	console.log(
		chalk.bgHex("#FF7700").hex("#FFFFFF")(" BACKEND  "),
		"后台线程连接初始化中",
	);

	await listen<AudioThreadEventMessage<AudioThreadEvent>>(
		"plugin:player-core-event",
		(evt) => {
			const resolve = msgTasks.get(evt.payload.callbackId);
			if (resolve) {
				msgTasks.delete(evt.payload.callbackId);
				resolve(evt.payload.data);
			}

			eventListeners.forEach((listener) => {
				try {
					listener(evt);
				} catch (e) {
					console.error("Error in audio event listener callback:", e);
				}
			});
		},
	);
	console.log(
		chalk.bgHex("#FF7700").hex("#FFFFFF")(" BACKEND "),
		"后台线程连接初始化完成",
	);
}

export const listenAudioThreadEvent = (
	handler: EventCallback<AudioThreadEventMessage<AudioThreadEvent>>,
): Promise<() => void> => {
	eventListeners.add(handler);
	const unlisten = () => {
		eventListeners.delete(handler);
	};
	return Promise.resolve(unlisten);
};

export async function readLocalMusicMetadata(filePath: string): Promise<{
	name: string;
	artist: string;
	album: string;
	lyricFormat: string;
	lyric: string;
	cover: number[];
	duration: number;
}> {
	return await invoke("read_local_music_metadata", { filePath });
}

export async function restartApp(): Promise<never> {
	return await invoke("restart_app");
}

export async function emitAudioThread<
	D extends AudioThreadMessage,
	T extends D["type"],
>(msgType: T, data?: Omit<D, "type">): Promise<void> {
	const id = uid(32) + Date.now();
	await invoke("local_player_send_msg", {
		msg: {
			callbackId: id,
			data: {
				type: msgType,
				...(data ?? {}),
			},
		} as AudioThreadEventMessage<D>,
	});
}

export function emitAudioThreadRet<
	D extends AudioThreadMessage,
	T extends D["type"],
>(msgType: T, data?: Omit<D, "type">): Promise<unknown> {
	const id = `${uid(32)}-${Date.now()}`;
	return new Promise((resolve) => {
		msgTasks.set(id, resolve);
		invoke("local_player_send_msg", {
			msg: {
				callbackId: id,
				data: {
					type: msgType,
					...(data ?? {}),
				},
			} as AudioThreadEventMessage<D>,
		});
	});
}
