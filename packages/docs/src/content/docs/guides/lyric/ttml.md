---
title: TTML 格式介绍
---

TTML 全称 Timed Text Markup Language，是 [W3C](https://www.w3.org/) 定义的时序文本标记语言标准。它基于 XML 表达结构化文本与时间信息，因此天然具备可扩展、可机器解析、跨平台交换的特点。

需要注意，TTML 是空格敏感的 XML。行内的空格等空白字符会如实反映在歌词上。为方便阅读，本文中的 TTML 代码进行了格式化。实际使用时不应随意增减空格或换行。

Apple Music 使用 TTML 作为逐字歌词格式，因此 AMLL 生态也主要采用 TTML 为歌词存储与交换格式。TTML 是 AMLL 生态里能力最完整的歌词格式，支持：

- 逐字时间
- 翻译与音译
- 背景人声（`x-bg`）
- 对唱/多人演唱者信息（`ttm:agent`）
- 歌曲分段（`itunes:song-part`）
- Ruby 注音

AMLL 的 TTML 规范可参考：[AMLL TTML DB Wiki - 格式规范](https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83)

## 整体架构

一个最小可用的 TTML 文件通常包含：

- 根节点 `<tt>`
- `<head><metadata>...</metadata></head>` 元数据区
- `<body><div><p>...</p></div></body>` 歌词正文区

命名空间：

- `xmlns="http://www.w3.org/ns/ttml"`
- `xmlns:ttm="http://www.w3.org/ns/ttml#metadata"`
- `xmlns:itunes="http://music.apple.com/lyric-ttml-internal"`
- `xmlns:amll="http://www.example.com/ns/amll"`
- `xmlns:tts="http://www.w3.org/ns/ttml#styling"`（Ruby 需要）

根属性：

- `xml:lang`：歌词主语言（BCP-47，如 `ja`、`zh-Hans`、`en-US`）
- `itunes:timing`：`Word`（逐字）或 `Line`（逐行）

## 元数据

TTML 元数据主要放在 `<head><metadata>` 中，AMLL 里常见两类：

1. `ttm:*` 元数据（TTML 标准）
2. `amll:meta` 元数据（AMLL 扩展）

例如：

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

常见 `amll:meta` 键：

- `musicName`、`artists`、`album`、`isrc`
- 平台 ID：`ncmMusicId`、`qqMusicId`、`spotifyId`、`appleMusicId`
- 贡献者：`ttmlAuthorGithub`、`ttmlAuthorGithubLogin`

## 时间与模式

时间一般通过 `begin` / `end` / `dur` 表达，单位支持：

- 时钟格式：`MM:SS.fff`、`HH:MM:SS.fff`，小数点后可保留 1~3 位或不保留
- 秒值格式：`12.3s`

`itunes:timing="Word"`（逐字）时：

- `<p>` 表示行
- 行内多个带时间戳的 `<span>` 表示字词

`itunes:timing="Line"`（逐行）时：

- 主要依赖 `<p begin="..." end="...">整行文本</p>`
- 内部 `span` 的逐字时间通常不使用

## 正文结构与扩展角色

正文结构一般为：

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

常见属性与约定：

- `itunes:key="L1"`：行唯一 ID（通常 `L1`、`L2`...）
- `ttm:agent="v1"`：对应 `<ttm:agent xml:id="v1">`
- `itunes:song-part`：段落信息（如 `Verse`、`Chorus`）

行内辅助信息通过 `ttm:role` 标记：

- `x-translation`：翻译
- `x-roman`：音译/罗马音
- `x-bg`：背景人声

示例：

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

## Apple Music 风格翻译音译

除了把翻译/音译写在行内，也可以放在 `<iTunesMetadata>`：

```xml
<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
  <translations>
    <translation xml:lang="zh-Hans-CN" type="subtitle">
      <text for="L1">第一行翻译</text>
    </translation>
  </translations>
  <transliterations>
    <transliteration xml:lang="ja-Latn">
      <text for="L1">dai ichi gyou</text>
    </transliteration>
  </transliterations>
</iTunesMetadata>
```

其中 `for="L1"` 会关联到正文中的 `itunes:key="L1"`。

## Ruby 注音

AMLL 支持 TTML Ruby 结构（`tts:ruby`），适合日语振假名、拼音等：

- `tts:ruby="container"`：整个 Ruby 容器
- `tts:ruby="base"`：基文本
- `tts:ruby="textContainer"`：注音容器
- `tts:ruby="text"`：注音文本（可带时间）

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

## 与本库的实现对齐

本库中的解析/导出实现有如下行为：

- 同时兼容 `itunes:songPart` 与 `itunes:song-part`，导出时优先 `song-part`
- 可解析并保留 `amll:obscene`、`amll:empty-beat`
- 背景人声文本可带/不带括号，解析时会做清理
- 可同时合并行内翻译与 Head Sidecar 翻译（同语言可能出现重复，需业务侧去重）
- 在无逐字但有行时间戳时，可回退为单词级占位词条，避免信息丢失
