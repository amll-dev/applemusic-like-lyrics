export interface TTMLMetadata {
	key: string;
	value: string[];
}

export interface TTMLLyric {
	metadata: TTMLMetadata[];
	lyricLines: LyricLine[];
}

export interface LyricWordBase {
	startTime: number;
	endTime: number;
	word: string;
	emptyBeat?: number;
}

export interface LyricWord extends LyricWordBase {
	romanWord?: string;
	obscene?: boolean;
	ruby?: LyricWordBase[];
}

export interface LyricLine {
	words: LyricWord[];
	translatedLyric: string;
	romanLyric: string;
	isBG: boolean;
	isDuet: boolean;
	startTime: number;
	endTime: number;
}
