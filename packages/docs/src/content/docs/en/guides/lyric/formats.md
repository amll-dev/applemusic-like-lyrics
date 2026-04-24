---
title: Lyric Formats
---

This page introduces lyric formats supported by [@applemusic-like-lyrics/lyric](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric).

In this document, "word-by-word lyrics" means lyrics with timestamp precision finer than line-level. Depending on platform and format, it may be syllable-level or word-level.

## TTML

TTML is the primary lyric storage and exchange format in the AMLL ecosystem. It supports all major AMLL capabilities, including translation/transliteration, background vocals, word-level transliteration, and ruby annotation.

See [TTML](./ttml) for details.

**This package provides [`parseTTML`](/en/reference/lyric/functionparsettml) and [`stringifyTTML`](/en/reference/lyric/functionstringifyttml) for TTML parsing and serialization.**

## LRC

LRC is the most common lyric file format and supports line-level timestamps only. File extension is `.lrc`.

Here, "LRC" means basic unextended LRC (sometimes called simple LRC). LRC was not formally standardized by a single organization; many variants exist and details vary.

Typically, each lyric line starts with a timestamp indicating line start time. Common forms:

- `[mm:ss]`
- `[mm:ss.xx]`
- `[mm:ss.xxx]`

`mm` is minutes and `ss.xxx` is seconds. Fraction digits may be omitted, 2 digits, or 3 digits. One lyric line can have multiple timestamps to indicate repeated occurrences.

LRC also supports metadata lines at the top in `[tag:content]` format. Some implementations allow comment lines prefixed with `#`.

Example:

```lrc
[al:崩坏星穹铁道-不虚此行 On the Journey]
[ti:不虚此行 On the Journey]
[ar:魏晨, Nea]
[length: 2:36]

[00:25.494]We venture through the cosmic sea
[00:27.541]A thousand light-years, wild and free
[00:30.805]We dance beneath the galaxy
[00:32.847]Then will you be with me?
# ...
[01:45.949]Catching on, our paths unknown
[01:50.261]To sink into daylight
[01:52.851]Break into the moonlight
[01:56.487]Life goes on, through tides of time
[02:00.900]Get in the line, to dream alive
[02:03.580]In our souls, do we know?
[02:05.896][02:08.473][02:11.262]On the journey
```

LRC does not natively support translation/transliteration. Common practice is to provide separate files with matching timestamps.

More background: [Wikipedia: LRC (file format)](<https://en.wikipedia.org/wiki/LRC_(file_format)>).

**This package provides [`parseLrc`](/en/reference/lyric/functionparselrc) and [`stringifyLrc`](/en/reference/lyric/functionstringifylrc).**

## LRC A2

LRC A2 (from A2 Media Player) extends LRC with inline timestamps in angle brackets `<mm:ss.xx>` for word-level timing. Timestamp format is similar to LRC. Each angle-bracket timestamp indicates the start time of the following text segment.

File extension is `.lrc` or `.alrc`.

Example:

```alrc
[ti: Somebody to Love]
[ar: Jefferson Airplane]
[al: Surrealistic Pillow]
[length: 2:58]

[00:00.00] <00:00.04> When <00:00.16> the <00:00.82> truth <00:01.29> is <00:01.63> found <00:03.09> to <00:03.37> be <00:05.92> lies
[00:06.47] <00:07.67> And <00:07.94> all <00:08.36> the <00:08.63> joy <00:10.28> within <00:10.53> you <00:13.09> dies
[00:13.34] <00:14.32> Don't <00:14.73> you <00:15.14> want <00:15.57> somebody <00:16.09> to <00:16.46> Love
```

When parsing, spaces around timestamps should be normalized.

Because timestamps are embedded with `< >`, escaping literal `<` or `>` in lyric text is not officially standardized. Parsing attempts to match `<mm:ss.xx>` as timestamp patterns; unmatched `<` or `>` are treated as normal text.

LRC A2 also does not natively support translation/transliteration.

**This package provides [`parseLrcA2`](/en/reference/lyric/functionparselrca2) and [`stringifyLrcA2`](/en/reference/lyric/functionstringifylrca2).**

## NetEase YRC and QQ QRC

Both are private word-level lyric formats used by music platforms:

- NetEase Cloud Music uses `.yrc`
- QQ Music uses `.qrc`

Both use line timestamps in `[lineStart,lineDur]` format, where values are integer milliseconds. Unlike LRC, they do not support multiple timestamps for one repeated line.

Word-level syntax differs:

- YRC: `(sylStart,sylDur,0)text` (timestamp first, then text). The third field is always `0` in known samples.
- QRC: `text(sylStart,sylDur)` (text first, then timestamp), without the extra `0` field.

All start times are absolute (from audio start).

Example for the same lyrics:

```
# NetEase YRC
[190871,1984](190871,361,0)For (191232,172,0)the (191404,376,0)first (191780,1075,0)time
[193459,4198](193459,412,0)What's (193871,574,0)past (194445,506,0)is (194951,2706,0)past

# QQ QRC
[190871,1984]For (190871,361)the (191232,172)first (191404,376)time(191780,1075)
[193459,4198]What's (193459,412)past (193871,574)is (194445,506)past(194951,2706)
```

QRC and YRC do not have LRC A2 style adjacent-space collapsing.

Parentheses in lyric text are tricky because timestamps also use `()`. Based on observed platform samples:

- YRC samples consistently use full-width parentheses `（）` in text
- QRC samples keep normal parentheses in text

Based on this behavior:

- YRC likely avoids half-width parentheses in text; this library replaces half-width parentheses with full-width ones when exporting YRC
- QRC parser skips non-timestamp parentheses and treats them as text

YRC/QRC also do not natively support translation/transliteration; common practice is companion LRC files.

Also, this library treats fully parenthesized lines as background lines in YRC/QRC and removes outer parentheses during parsing.

**This package provides [`parseYrc`](/en/reference/lyric/functionparseyrc) and [`stringifyYrc`](/en/reference/lyric/functionstringifyyrc) for YRC; [`parseQrc`](/en/reference/lyric/functionparseqrc) and [`stringifyQrc`](/en/reference/lyric/functionstringifyqrc) for QRC.**

QQ Music also distributes an encrypted QRC format: XML containing QRC text, encrypted with a DES-like algorithm and base64-encoded. **This package provides [`decryptQrcHex`](/en/reference/lyric/functiondecryptqrchex) to decode such base64 payloads to XML text, and [`encryptQrcHex`](/en/reference/lyric/functionencryptqrchex) to encode plaintext XML to base64.**

## Lyricify Formats

[Lyricify](https://lyricify.app) is a popular word-by-word lyric display app. It defines three private formats: Lyricify Lines, Lyricify Syllable, and Lyricify Quick Export.

- Lyricify Lines: line-level format, extension `.lyl`
- Lyricify Syllable: word-level format, extension `.lys`, with background and duet support

Official docs exist for the first two formats: [Lyricify format docs](https://github.com/WXRIW/Lyricify-App/blob/main/docs/Lyricify%204/Lyrics.md#lyricify-lines-%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83).

**This package provides [`parseLyl`](/en/reference/lyric/functionparselyl)/[`stringifyLyl`](/en/reference/lyric/functionstringifylyl) and [`parseLys`](/en/reference/lyric/functionparselys)/[`stringifyLys`](/en/reference/lyric/functionstringifylys).**

Lyricify Quick Export uses extension `.lqe` (Lyricify Quick Export). There is no official formal spec, but the format is straightforward from exported samples:

```
[Lyricify Quick Export]
[version:1.0]

[lyrics: format@Lyricify Syllable]
[4]A(365,350)ni(715,307)ro(1022,312)dham (1334,419)a(3203,337)nut(3540,350)pā(3890,306)dam(4196,382)
[5]Qua(6206,312)e(6518,350)so (6868,370)do(7238,338)mi(7576,373)ne (7949,413)nos (8362,736)ple(9098,306)ne (9404,338)sal(9742,237)va (9979,244)tam(10223,350)
[4]A(6164,1436)nuc(7600,744)che(8344,724)dam (9068,399)a(9467,293)śā(9760,240)śva(10000,225)tam(10225,893)
[4]Hi (11851,812)ma(12663,344)ma (13007,369)ja(13376,263)gad (13639,237)i(13876,212)daṃ(14088,800)


[translation: format@LRC]
[00:00.365]不生亦不灭
[00:06.206]主人啊，求你像这般，赐给我们完全的救恩
[00:06.164]不常亦不断
[00:11.851]此世已为我之世


[pronunciation: format@LRC, language@romaji]
[00:00.365]阿难罗昙 阿耨钵昙
[00:06.164]阿耨遮昙 阿刹缚多
[00:11.851]天摩诃满 荼揭谛檀
```

The header defines file version. Then blocks follow:

- `[lyrics: format@Lyricify Syllable]` for word-level lyrics
- `[translation: format@LRC]` for translation lines
- `[pronunciation: format@LRC, language@romaji]` for pronunciation/transliteration lines

Translation/pronunciation blocks include only lines that have content. Missing translation/transliteration lines are omitted.

So Lyricify Quick Export supports word-level timing, background lines, duet lines, translation, and transliteration.

See also [Lyricify Lyrics Helper](https://github.com/WXRIW/Lyricify-Lyrics-Helper), an MIT-licensed project by the Lyricify developer that includes parsing and generation logic.

**This package provides [`parseLqe`](/en/reference/lyric/functionparselqe) and [`stringifyLqe`](/en/reference/lyric/functionstringifylqe).**

## Summary Table

| Format | Extension | Line timing | Word timing | Native translation/transliteration | Native background/duet |
| --- | --- | :---: | :---: | :---: | :---: |
| TTML | `.ttml` | Yes | Yes | Yes | Yes |
| LRC | `.lrc` | Yes | No | No | No |
| LRC A2 | `.lrc`, `.alrc` | Yes | Yes | No | No |
| NetEase YRC | `.yrc` | Yes | Yes | No | No |
| QQ QRC | `.qrc` | Yes | Yes | No | No |
| Lyricify Lines | `.lyl` | Yes | No | No | No |
| Lyricify Syllable | `.lys` | Yes | Yes | No | Yes |
| Lyricify Quick Export | `.lqe` | Yes | Yes | Yes | Yes |
