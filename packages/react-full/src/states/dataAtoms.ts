import type { LyricLine } from "@applemusic-like-lyrics/core";
import { atom, type PrimitiveAtom, type WritableAtom } from "jotai";
import { atomWithStorage, type RESET } from "jotai/utils";

export type SongData =
	| { type: "local"; filePath: string; origOrder: number }
	| { type: "custom"; id: string; songJsonData: string; origOrder: number };

/**
 * 一位艺术家的信息
 */
export interface ArtistStateEntry {
	name: string;
	id: string;
}

/**
 * 音频质量的类型枚举
 */
export enum AudioQualityType {
	None = "none",
	Standard = "standard",
	Lossless = "lossless",
	HiResLossless = "hi-res-lossless",
	DolbyAtmos = "dolby-atmos",
}

/**
 * 描述音频质量信息的接口
 */
export interface MusicQualityState {
	/**
	 * 音频质量
	 */
	type: AudioQualityType;
	/**
	 * 音频解码器
	 */
	codec: string;
	/**
	 * 音频通道数量
	 */
	channels: number;
	/**
	 * 采样率
	 */
	sampleRate: number;
	/**
	 * 采样格式
	 */
	sampleFormat: string;
}

//#region 当前音乐状态
/**
 * 当前播放歌曲的 ID
 */
export const musicIdAtom: PrimitiveAtom<string> = atom("");

/**
 * 当前播放的音乐名称
 */
export const musicNameAtom: PrimitiveAtom<string> = atom("未知歌曲");

/**
 * 当前播放的音乐创作者列表
 */
export const musicArtistsAtom: PrimitiveAtom<ArtistStateEntry[]> = atom<
	ArtistStateEntry[]
>([{ name: "未知创作者", id: "unknown" }]);

/**
 * 当前播放的音乐所属专辑名称
 */
export const musicAlbumNameAtom: PrimitiveAtom<string> = atom("未知专辑");

/**
 * 当前播放的音乐专辑封面 URL
 *
 * 除了图片也可以是视频资源
 */
export const musicCoverAtom: PrimitiveAtom<string> = atom("");

/**
 * 当前播放的音乐专辑封面资源是否为视频
 */
export const musicCoverIsVideoAtom: PrimitiveAtom<boolean> = atom(false);

/**
 * 当前音乐的总时长，单位为毫秒
 */
export const musicDurationAtom: PrimitiveAtom<number> = atom(0);

/**
 * 当前音乐是否正在播放
 */
export const musicPlayingAtom: PrimitiveAtom<boolean> = atom(false);

/**
 * 当前音乐的播放进度，单位为毫秒
 */
export const musicPlayingPositionAtom: PrimitiveAtom<number> = atom(0);

/**
 * 当前播放的音乐音量大小，范围在 [0.0-1.0] 之间
 */
export const musicVolumeAtom: WritableAtom<
	number,
	[number | ((prev: number) => number) | typeof RESET],
	void
> = atomWithStorage("amll-react-full.musicVolumeAtom", 0.5, undefined, {
	getOnInit: true,
});

/**
 * 当前播放的音乐的歌词数据
 */
export const musicLyricLinesAtom: PrimitiveAtom<LyricLine[]> = atom<
	LyricLine[]
>([]);

/**
 * 当前音乐的音质信息
 */
export const musicQualityAtom: PrimitiveAtom<MusicQualityState> =
	atom<MusicQualityState>({
		type: AudioQualityType.None,
		codec: "unknown",
		channels: 2,
		sampleRate: 44100,
		sampleFormat: "s16",
	});

/**
 * 根据音质信息生成的、用于UI展示的标签内容
 *
 * 如果为 null 则不显示标签
 */
export const musicQualityTagAtom: PrimitiveAtom<{
	tagIcon: boolean;
	tagText: string;
	isDolbyAtmos: boolean;
} | null> = atom<{
	tagIcon: boolean;
	tagText: string;
	isDolbyAtmos: boolean;
} | null>(null);
//#endregion

//#region 音频可视化相关
/**
 * 用于音频可视化频谱图的实时频域数据
 */
export const fftDataAtom: PrimitiveAtom<number[]> = atom<number[]>([]);

/**
 * 设置低频的音量大小，范围在 80hz-120hz 之间为宜，取值范围在 0.0-1.0 之间。
 *
 * 部分渲染器会根据音量大小调整背景效果（例如根据鼓点跳动）。如果无法获取到类似的数据，请传入 1.0 作为默认值，或不做任何处理。
 */
export const lowFreqVolumeAtom: PrimitiveAtom<number> = atom<number>(1);
//#endregion
