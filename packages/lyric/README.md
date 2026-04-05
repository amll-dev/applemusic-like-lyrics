# Lyric parser/writer for AMLL

English / [简体中文](./README-CN.md)

This is a refactored version of the original lyrics pack. Docs not finished yet.

Below is the original docs.

---

> Warning: This is a personal project and is still under development. There may still be many issues, so please do not use it directly in production environments!

![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/lyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Flyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)

A lyric parsing/generation module for AMLL, written in Rust and built into a WASM module using `wasm-pack` for use in other projects.

Since this module focuses only on lyric content, it discards all information unrelated to lyrics. If you need to get detailed information from a lyric file (such as artist), please consider using other frameworks.

Lyric format support table:

| Source Format＼Target Format                   | Parse Own Format | LyRiC Format `.lrc` | ESLyric Word-by-word Format `.lrc` | NetEase Cloud Music Word-by-word Format `.yrc` | QQ Music Word-by-word Format `.qrc` | Lyricify Syllable Word-by-word Format `.lys` | TTML Lyric Format `.ttml` | ASS Subtitle Format `.ass` |
| ---------------------------------------------- | ---------------- | ------------------- | ---------------------------------- | ---------------------------------------------- | ----------------------------------- | -------------------------------------------- | ------------------------- | -------------------------- |
| LyRiC Format `.lrc`                            | ✅               | ／                  | ✅                                 | ✅                                             | ✅                                  | ✅                                           | ✅                        | ✅                         |
| ESLyric Word-by-word Format `.lrc`             | ✅               | ✅                  | ／                                 | ✅                                             | ✅                                  | ✅                                           | ✅                        | ✅                         |
| NetEase Cloud Music Word-by-word Format `.yrc` | ✅               | ✅ [^1]             | ✅ [^1]                            | ／                                             | ✅                                  | ✅                                           | ✅                        | ✅                         |
| QQ Music Word-by-word Format `.qrc`            | ✅               | ✅ [^1]             | ✅ [^1]                            | ✅                                             | ／                                  | ✅                                           | ✅                        | ✅                         |
| Lyricify Syllable Word-by-word Format `.lys`   | ✅               | ✅ [^1]             | ✅ [^1]                            | ✅ [^2]                                        | ✅ [^2]                             | ／                                           | ✅                        | ✅                         |
| TTML Lyric Format `.ttml`                      | ✅               | ✅ [^1]             | ✅ [^1]                            | ✅ [^2]                                        | ✅ [^2]                             | ✅ [^3]                                      | ／                        | ✅                         |
| ASS Subtitle Format `.ass`                     | ❌               | ❌                  | ❌                                 | ❌                                             | ❌                                  | ❌                                           | ❌                        | ／                         |

[^1]: Will lose word-by-word timing data, vocal attributes (background vocals, duet vocals) and AMLL metadata

[^2]: Will lose vocal attributes (background vocals, duet vocals) and AMLL metadata

[^3]: Will lose AMLL metadata

## Using with Core Lyric Component

When using them together, note that **the lyric line structures of the two are not exactly the same**. You need to convert them in a way like the following example (using LyRiC as an example) for the lyric component to parse correctly:

```typescript
import { parseLrc } from "@applemusic-like-lyrics/lyric";
const lines = parseLrc("[00:00.00]test");
const converted = lines.map((line, i, lines) => ({
    words: [
        {
            word: line.words[0]?.word ?? "",
            startTime: line.words[0]?.startTime ?? 0,
            endTime: lines[i + 1]?.words?.[0]?.startTime ?? Infinity,
        },
    ],
    startTime: line.words[0]?.startTime ?? 0,
    endTime: lines[i + 1]?.words?.[0]?.startTime ?? Infinity,
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
}));
// Now you can pass converted to LyricPlayer
```

Using TypeScript is recommended as it makes it easier to detect errors.

## Building

```shell
wasm-pack build --target bundler --release --scope applemusic-like-lyrics
```
