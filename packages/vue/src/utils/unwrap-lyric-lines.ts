import type { LyricLine } from "@applemusic-like-lyrics/core";
import { toRaw } from "vue";

export function unwrapLyricLines(
	lyricLines: LyricLine[] | undefined,
): LyricLine[] {
	return toRaw(lyricLines ?? []);
}
