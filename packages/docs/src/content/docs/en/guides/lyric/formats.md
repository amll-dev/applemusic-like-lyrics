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

LRC is the most common lyric file format and supports line-level timestamps only. Its file extension is `.lrc`, short for **l**y**r**i**c**s.

Here, "LRC" means basic, unextended LRC (sometimes called simple LRC). LRC was not formally defined by a single organization. Its original source is unknown, and it has become an industry convention with many variants and unspecified details.

Typically, each lyric line starts with a timestamp indicating line start time. Common forms:

- `[mm:ss]`
- `[mm:ss.xx]`
- `[mm:ss.xxx]`

`mm` is minutes and `ss.xxx` is seconds. The fractional part may be omitted, or may contain 2 or 3 digits. One lyric line can have multiple timestamps to indicate repeated occurrences. For compatibility, a colon is also accepted between seconds and milliseconds, so `3:12:5` is equivalent to `3:12.5`. **Anything that does not match this form is treated as plain text**, so `[1]`, `[61]` and `[1234:00.000]` are not timestamps.

LRC also supports metadata lines at the top in `[tag:content]` format.

Some implementations allow lines beginning with `#` as comments. This package additionally supports lines beginning with `//`. A comment marker is recognized only at the beginning of a line, so such characters in the middle of lyric text are preserved.

Example:

```text
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

LRC does not define how translations or transliterations are stored. There are two common approaches:

- Provide a separate file with the same timestamps as the original lyric file, where matching timestamps correspond to translations or transliterations.
- Put translation or transliteration lines immediately after the original lines, using the same timestamps as the original lines.

This package does not specially handle lyric lines with identical timestamps, even when their content is a translation or transliteration of the preceding line. As a result, **multiple lyric lines may share the same time**, and callers must decide how to use them.

If a lyric line is entirely enclosed in parentheses, it is parsed as a background vocal line. Multiple consecutive parenthesized lines are preserved as-is.

More background: [Wikipedia: LRC (file format)](<https://en.wikipedia.org/wiki/LRC_(file_format)>).

**This package provides [`parseLrcLike`](/en/reference/lyric/functionparselrclike) and [`stringifyLrcLike`](/en/reference/lyric/functionstringifylrclike) as the unified entry points for the LRC family. [`parseLrc`](/en/reference/lyric/functionparselrc) is an equivalent wrapper that parses word-level timestamps just the same but returns no metadata; [`stringifyLrc`](/en/reference/lyric/functionstringifylrc) equals the plain LRC mode of `stringifyLrcLike` and drops word-level information.**

These interfaces generate word-level timestamps slightly differently: angle-bracket forms (LRC A2 and SPL) write the line timestamp first, followed by each syllable's start timestamp; square-bracket forms (ESLyric) omit the line timestamp, use the first word's timestamp as the line-start timestamp, and write only the end timestamp for each subsequent word.

## LRC A2

LRC A2 was first introduced by A2 Media Player, hence the name. It extends LRC with inline timestamps in angle brackets `<mm:ss.xx>` for word-level timing. Timestamp format is similar to LRC, and each angle-bracket timestamp indicates the start time of the following text segment.

Angle-bracket timestamps are recognized by exactly the same rule as square-bracket ones, so the `mm:ss.ms` form is recognized and the millisecond portion may be omitted. **Angle brackets not matching that form are treated as plain characters**, e.g. `<05>` is not a timestamp.

File extension is `.lrc` or `.alrc`.

Example:

```text
[ti: Somebody to Love]
[ar: Jefferson Airplane]
[al: Surrealistic Pillow]
[length: 2:58]

[00:00.00] <00:00.04> When <00:00.16> the <00:00.82> truth <00:01.29> is <00:01.63> found <00:03.09> to <00:03.37> be <00:05.92> lies
[00:06.47] <00:07.67> And <00:07.94> all <00:08.36> the <00:08.63> joy <00:10.28> within <00:10.53> you <00:13.09> dies
[00:13.34] <00:14.32> Don't <00:14.73> you <00:15.14> want <00:15.57> somebody <00:16.09> to <00:16.46> Love
```

This package keeps the spaces of the lyric text exactly as they are, neither merging nor trimming them: whitespace next to a timestamp is neither dropped nor moved onto the neighbouring segment. In the example above the leading space of ` When` is kept as part of its syllable.

Because timestamps are embedded with `< >`, escaping literal `<` or `>` in lyric text is not officially standardized, and no consistent industry convention has been found. Parsing attempts to match `<mm:ss.xx>` as timestamp patterns; unmatched `<` or `>` are treated as normal text.

Like plain LRC, LRC A2 has no notation for translations or transliterations. Lines with the same timestamp or no timestamp are handled as translations of the previous line, see [above](#lrc).

**This package provides [`parseLrcA2`](/en/reference/lyric/functionparselrca2) and [`stringifyLrcA2`](/en/reference/lyric/functionstringifylrca2) for parsing and serializing LRC lyrics.**

## SPL

SPL stands for Salt Player Lyrics. It was introduced by Salt Player and is based on, and compatible with, (enhanced) LRC; the full specification is the [Salt Player lyric format standard](https://moriafly.com/standards/spl.html). SPL standardizes the many compatibility quirks that LRC implementations had accumulated, which is why this package uses it as the parsing and generation algorithm for the whole LRC family — plain LRC, LRC A2 and ESLyric word-by-word lyrics are all subsets of it.

Timestamps follow LRC's `[mm:ss.ms]`: 1 to 3 digits for minutes, 1 to 2 for seconds and 1 to 6 for milliseconds. The millisecond portion may be omitted. Fewer than 3 millisecond digits are padded on the right with `0`, so `[3:12.5]` means 3 minutes 12 seconds 500 milliseconds rather than 5 milliseconds. For compatibility with non-conforming files, this package also accepts a colon between seconds and milliseconds. If the final lyric line has no end timestamp, its end time is set to `999:59.999`.

A line can end in two ways:

- An **explicit end**, written as one more timestamp at the end of the line, e.g. `[05:20.22]你好椒盐音乐[05:21.22]`.
- An **implicit end**, where the end timestamp is omitted and the line ends at the start time of the next line.

Several timestamps may also be attached to one line to abbreviate lyrics that repeat, e.g. `[05:20.22][05:30.22]你好椒盐音乐`.

Translations are recognized by an identical timestamp: a line following the main lyric line and carrying the same timestamp is its translation. The timestamp may be omitted, but then the translation line has to follow the main line directly.

```text
[05:20.22]你好椒盐音乐
[05:20.22]Hello Salt Player
```

Word-by-word lyrics insert word-level timestamps inside the line, each marking the start time of the text segment that follows it:

```text
[05:20.22]你好[05:23.22]椒盐音乐[05:24.22]
```

Here `[05:20.22]` is both the start of the line and the first word-level mark, and `[05:24.22]` is both the last word-level mark and the end of the line. Word-level marks in the middle may instead be wrapped in angle brackets.

Word-level marks must be increasing, and word-by-word lyrics are not compatible with the repeated-line feature.

**This package provides [`parseSPL`](/en/reference/lyric/functionparsespl) and [`stringifySPL`](/en/reference/lyric/functionstringifyspl) for parsing and serializing SPL lyrics.**

:::note
Unlike the specification, which says to ignore an out-of-order word-level mark, this package does not take any special action when word-level marks are out of order. This behavior is consistent with the parsers for other formats.
:::

## NetEase YRC and QQ QRC

Both are private word-level lyric formats used by music platforms:

- NetEase Cloud Music uses `.yrc`
- QQ Music uses `.qrc`

Both use line timestamps in `[lineStart,lineDur]` format. `lineStart` is the line start time in integer milliseconds, and `lineDur` is the line duration, also in integer milliseconds. Unlike LRC, they do not support multiple timestamps for one repeated line.

Word-level syntax differs:

- YRC: `(sylStart,sylDur,0)text` (timestamp first, then text). The three fields are the start time, duration, and `0`. All known YRC lyrics contain this `0`; its meaning is currently unknown and it may be reserved for a future extension.
- QRC: `text(sylStart,sylDur)` (text first, then timestamp), without the extra `0` field.

All start times are absolute (from audio start).

Example for the same lyrics:

```text
# NetEase YRC
[190871,1984](190871,361,0)For (191232,172,0)the (191404,376,0)first (191780,1075,0)time
[193459,4198](193459,412,0)What's (193871,574,0)past (194445,506,0)is (194951,2706,0)past

# QQ QRC
[190871,1984]For (190871,361)the (191232,172)first (191404,376)time(191780,1075)
[193459,4198]What's (193459,412)past (193871,574)is (194445,506)past(194951,2706)
```

QRC and YRC do not have LRC A2 style adjacent-space collapsing.

Parentheses in lyric text are tricky because timestamps also use `()`. Since YRC and QRC are private formats with no official documentation, we examined official lyrics from both platforms. Based on observed samples:

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

[Lyricify](https://lyricify.app) is an excellent word-by-word lyric display app. It defines three private formats: Lyricify Lines, Lyricify Syllable, and Lyricify Quick Export.

- Lyricify Lines: line-level format, extension `.lyl`
- Lyricify Syllable: word-level format, extension `.lys`, with background and duet support

Official docs exist for the first two formats: [Lyricify format docs](https://github.com/WXRIW/Lyricify-App/blob/main/docs/Lyricify%204/Lyrics.md#lyricify-lines-%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83).

**This package provides [`parseLyl`](/en/reference/lyric/functionparselyl)/[`stringifyLyl`](/en/reference/lyric/functionstringifylyl) and [`parseLys`](/en/reference/lyric/functionparselys)/[`stringifyLys`](/en/reference/lyric/functionstringifylys).**

Lyricify Quick Export uses extension `.lqe` (**L**yricify **Q**uick **E**xport). There is no official documentation, but its content is straightforward. The following description is based on analysis of files exported by the relevant software rather than an official specification, and it may differ in future versions:

```text
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

| Format                | Extension       | Line timing | Word timing | Native translation/transliteration | Native background/duet |
| --------------------- | --------------- | :---------: | :---------: | :--------------------------------: | :--------------------: |
| TTML                  | `.ttml`         |      ✓      |      ✓      |                 ✓                  |           ✓            |
| LRC                   | `.lrc`          |      ✓      |      ✕      |                 ✕                  |           ✕            |
| LRC A2                | `.lrc`, `.alrc` |      ✓      |      ✓      |                 ✕                  |           ✕            |
| SPL                   | `.spl`          |      ✓      |      ✓      |                 ✕                  |           ✕            |
| NetEase YRC           | `.yrc`          |      ✓      |      ✓      |                 ✕                  |           ✕            |
| QQ QRC                | `.qrc`          |      ✓      |      ✓      |                 ✕                  |           ✕            |
| Lyricify Lines        | `.lyl`          |      ✓      |      ✕      |                 ✕                  |           ✕            |
| Lyricify Syllable     | `.lys`          |      ✓      |      ✓      |                 ✕                  |           ✓            |
| Lyricify Quick Export | `.lqe`          |      ✓      |      ✓      |                 ✓                  |           ✓            |
