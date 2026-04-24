---
title: TTML Format Overview
---

TTML (Timed Text Markup Language) is a timed text markup standard defined by [W3C](https://www.w3.org/). Since it is XML-based, it is extensible, machine-readable, and suitable for cross-platform exchange.

TTML is whitespace-sensitive XML. Spaces and other whitespace in inline text are preserved in rendered lyrics. TTML snippets in this document are formatted for readability; in real usage, avoid arbitrary whitespace changes.

Apple Music uses TTML for word-by-word lyrics, so TTML is also the primary storage and exchange format in the AMLL ecosystem. It supports:

- Word-level timing
- Translation and transliteration
- Background vocals (`x-bg`)
- Duet/multi-singer metadata (`ttm:agent`)
- Song sections (`itunes:song-part`)
- Ruby annotations

For AMLL TTML spec details, see [AMLL TTML DB Wiki - Format Specification](https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83).

## Overall Structure

A minimal usable TTML file usually contains:

- Root `<tt>`
- Metadata section `<head><metadata>...</metadata></head>`
- Main lyric section `<body><div><p>...</p></div></body>`

Namespaces:

- `xmlns="http://www.w3.org/ns/ttml"`
- `xmlns:ttm="http://www.w3.org/ns/ttml#metadata"`
- `xmlns:itunes="http://music.apple.com/lyric-ttml-internal"`
- `xmlns:amll="http://www.example.com/ns/amll"`
- `xmlns:tts="http://www.w3.org/ns/ttml#styling"` (required for Ruby)

Root attributes:

- `xml:lang`: primary lyric language (BCP-47, e.g. `ja`, `zh-Hans`, `en-US`)
- `itunes:timing`: `Word` (word-by-word) or `Line` (line-by-line)

## Metadata

Metadata is mainly in `<head><metadata>`. In AMLL, common types are:

1. `ttm:*` metadata (TTML standard)
2. `amll:meta` metadata (AMLL extension)

Example:

```xml
<metadata>
  <ttm:title>Song Title</ttm:title>

  <ttm:agent type="person" xml:id="v1">
    <ttm:name type="full">Singer A</ttm:name>
  </ttm:agent>

  <amll:meta key="musicName" value="Song Title" />
  <amll:meta key="artists" value="Singer A" />
  <amll:meta key="album" value="Album Name" />
  <amll:meta key="isrc" value="XX0000000000" />
  <amll:meta key="appleMusicId" value="1234567890" />
</metadata>
```

Common `amll:meta` keys:

- `musicName`, `artists`, `album`, `isrc`
- Platform IDs: `ncmMusicId`, `qqMusicId`, `spotifyId`, `appleMusicId`
- Contributors: `ttmlAuthorGithub`, `ttmlAuthorGithubLogin`

## Timing and Modes

Timing is typically expressed by `begin` / `end` / `dur`. Supported units:

- Clock format: `MM:SS.fff`, `HH:MM:SS.fff` (fractional digits 0-3)
- Seconds format: `12.3s`

With `itunes:timing="Word"`:

- `<p>` is one lyric line
- Timestamped inline `<span>` elements represent words/syllables

With `itunes:timing="Line"`:

- Primarily uses `<p begin="..." end="...">whole line text</p>`
- Inline word timing spans are usually not used

## Body Structure and Extension Roles

Typical body structure:

```xml
<body>
  <div itunes:song-part="Verse">
    <p begin="10.000" end="12.000" itunes:key="L1" ttm:agent="v1">
      <span begin="10.000" end="10.500">こ</span>
      <span begin="10.500" end="11.000">れ</span>
      <span begin="11.000" end="12.000">は</span>
    </p>
  </div>
</body>
```

Common attributes and conventions:

- `itunes:key="L1"`: unique line ID (`L1`, `L2`, ...)
- `ttm:agent="v1"`: points to `<ttm:agent xml:id="v1">`
- `itunes:song-part`: section info (`Verse`, `Chorus`, etc.)

Inline assistant content uses `ttm:role`:

- `x-translation`: translation
- `x-roman`: transliteration / romanization
- `x-bg`: background vocal

Example:

```xml
<p begin="20.000" end="25.000" itunes:key="L3" ttm:agent="v1000">
  <span begin="20.000" end="21.500">コーラス</span>
  <span begin="21.500" end="22.000">です</span>

  <span ttm:role="x-bg" begin="22.500" end="23.800">
    <span begin="22.500" end="23.800">(背景)</span>
    <span ttm:role="x-translation" xml:lang="en">Background</span>
    <span ttm:role="x-roman" xml:lang="ja-Latn">haikei</span>
  </span>
</p>
```

## Apple Music Style Translation/Transliteration Sidecar

In addition to inline spans, translation/transliteration can be stored in `<iTunesMetadata>`:

```xml
<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
  <translations>
    <translation xml:lang="zh-Hans-CN" type="subtitle">
      <text for="L1">First line translation</text>
    </translation>
  </translations>
  <transliterations>
    <transliteration xml:lang="ja-Latn">
      <text for="L1">dai ichi gyou</text>
    </transliteration>
  </transliterations>
</iTunesMetadata>
```

`for="L1"` links to `itunes:key="L1"` in the body.

## Ruby Annotation

AMLL supports TTML Ruby (`tts:ruby`) for furigana, pinyin, etc.:

- `tts:ruby="container"`: ruby container
- `tts:ruby="base"`: base text
- `tts:ruby="textContainer"`: ruby text container
- `tts:ruby="text"`: ruby text (can carry timing)

```xml
<span tts:ruby="container">
  <span tts:ruby="base">所</span>
  <span tts:ruby="textContainer">
    <span tts:ruby="text" begin="00:27.690" end="00:27.820">しょ</span>
  </span>
</span>
<span tts:ruby="container">
  <span tts:ruby="base">詮</span>
  <span tts:ruby="textContainer">
    <span tts:ruby="text" begin="00:27.820" end="00:27.880">せ</span>
    <span tts:ruby="text" begin="00:27.880" end="00:27.950">ん</span>
  </span>
</span>
```

## Implementation Behavior in This Library

Current parse/export behavior includes:

- Accepts both `itunes:songPart` and `itunes:song-part`; export prefers `song-part`
- Parses and preserves `amll:obscene` and `amll:empty-beat`
- Background vocal text can be with/without parentheses; parser normalizes it
- Can merge inline translations with Head Sidecar translations (same language may duplicate; dedupe in business layer)
- If word-level timing is absent but line timing exists, it can fallback to placeholder word entries to avoid information loss
