# Lyric parser/writer for AMLL

English / [简体中文](./README-CN.md)

This is a refactored version of the original lyrics pack. Docs not finished yet.

Below is the original docs. See also: [AMLL Docs](https://amll.dev/en/reference/lyric.html).

---

> Warning: This is a personal project and is still under development. There may still be many issues, so please do not use it directly in production environments!

![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/lyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Flyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)

A lyric parsing/generation module for AMLL, written entirely in TypeScript.

Since this module focuses only on lyric content, it discards all information unrelated to lyrics. If you need to get detailed information from a lyric file (such as artist), please consider using other frameworks.

### Parse and generation support

| Format                           | Common extension | Parse | Generate |
| -------------------------------- | ---------------- | ----- | -------- |
| **LyRiC**                        | `.lrc`           | ✅     | ✅        |
| **LRC A2** (enhanced LRC)        | `.lrc`           | ✅     | ✅        |
| **ESLyric word-by-word lyrics**  | `.lrc`           | ✅     | ✅        |
| **Salt Player Lyrics (SPL)**     | `.spl`           | ✅     | ✅        |
| **NetEase word-by-word lyrics**  | `.yrc`           | ✅     | ✅        |
| **QQ Music word-by-word lyrics** | `.qrc`           | ✅     | ✅        |
| **Lyricify Syllable**            | `.lys`           | ✅     | ✅        |
| **Lyricify Lines**               | `.lyl`           | ✅     | ✅        |
| **Lyricify Quick Export**        | `.lqe`           | ✅     | ✅        |
| **TTML**                         | `.ttml`          | ✅     | ✅        |
| **ASS**                          | `.ass`           | ❌     | ✅        |

---

### Format capability support

Each format has different syntax rules, so the lyric capabilities it supports, such as word-level timing, translations, and vocal-part information, also differ:

| Format                             | Timing granularity | Translation / transliteration       | Duet | Background vocals      | Metadata |
| ---------------------------------- | ------------------ | ----------------------------------- | ---- | ---------------------- | -------- |
| **LyRiC (`.lrc`)**                 | Line-level         | ⚠️ Written as additional lyric lines | ❌    | ⚠️ Text wrapped in `()` | ❌        |
| **LRC A2 (`.lrc`)**                | Word-level         | ⚠️ Written as additional lyric lines | ❌    | ⚠️ Text wrapped in `()` | ❌        |
| **ESLyric (`.lrc`)**               | Word-level         | ⚠️ Written as additional lyric lines | ❌    | ⚠️ Text wrapped in `()` | ❌        |
| **SPL (`.spl`)**                   | Word-level         | ⚠️ Written as additional lyric lines | ❌    | ⚠️ Text wrapped in `()` | ✅        |
| **NetEase (`.yrc`)**               | Character-level    | ❌                                   | ❌    | ⚠️ Text wrapped in `()` | ❌        |
| **QQ Music (`.qrc`)**              | Character-level    | ❌                                   | ❌    | ⚠️ Text wrapped in `()` | ❌        |
| **Lyricify Syllable (`.lys`)**     | Word-level         | ❌                                   | ✅    | ✅                      | ❌        |
| **Lyricify Lines (`.lyl`)**        | Line-level         | ❌                                   | ❌    | ⚠️ Text wrapped in `()` | ❌        |
| **Lyricify Quick Export (`.lqe`)** | Word-level         | ✅                                   | ✅    | ✅                      | ❌        |
| **TTML (`.ttml`)**                 | Word-level         | ✅                                   | ✅    | ✅                      | ✅        |
| **ASS (`.ass`)**                   | Word-level         | ❌                                   | ❌    | ⚠️ Text wrapped in `()` | ❌        |

---

### Conversion and degradation rules

When converting between formats through AMLL's internal structure, the following degradation rules apply when the target format lacks a capability provided by the source format:

1. **Word-level timing degradation**: When the target format only supports line-level lyrics, such as LyRiC `.lrc` and Lyricify Lines `.lyl`, word-level timestamps are stripped and all words on a line are merged into a single line.
2. **Translation and transliteration degradation**:
   * When exporting to an LRC-family format (LyRiC, LRC A2, ESLyric, or SPL), translations and transliterations are inserted as additional lyric lines with the main line's timestamp.
   * When exporting to word-level formats other than TTML (YRC, QRC, LYS, or LYL), translations and transliterations are discarded.
3. **Background vocals**: When the target format has no native background-vocal marker, background vocals are written with parentheses around the lyric text: `(...)`.
4. **Duet attributes**: Only LYS, LQE, and TTML preserve duet information. It is lost when exporting to other formats.
5. **Metadata**: To preserve metadata when exporting to SPL, pass the complete parse result containing metadata to `stringifySPL`. Metadata is written as `[key:value]` tag lines, and keys are converted to lowercase when parsed again. Formats other than TTML and SPL do not support metadata.
6. **Timestamp precision loss**: ASS karaoke effects use centiseconds (1 cs), so exporting from a millisecond-based format to ASS rounds timestamps and may lose up to 10 milliseconds of precision.

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
