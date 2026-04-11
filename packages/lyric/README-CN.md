# Lyric parser/writer for AMLL

[English](./README.md) / 简体中文

此为基于 TypeScript 的重构版本 Lyrics 包，文档未完成。

以下是原文档：

---

> 警告：此为个人项目，且尚未完成开发，可能仍有大量问题，所以请勿直接用于生产环境！

![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/lyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Flyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)

一个 AMLL 的歌词解析/生成模块，使用 Rust 编写，并通过 `wasm-pack`
构建成 WASM 模块以提供给其他项目使用。

本模块由于只着重于歌词内容，所以会丢弃一切和歌词无关的信息，如需获取一个歌词文件中的详细信息（例如歌手）请考虑使用其他框架。

歌词格式支持表：

| 源格式＼目标格式                      | 解析自身格式 | LyRiC 格式 `.lrc` | ESLyric 逐词歌词格式 `.lrc` | 网易云音乐逐词歌词格式 `.yrc` | QQ 音乐逐词歌词格式 `.qrc` | Lyricify Syllable 逐词歌词格式 `.lys` | TTML 歌词格式 `.ttml` | ASS 字幕格式 `.ass` |
| ------------------------------------- | ------------ | ----------------- | --------------------------- | ----------------------------- | -------------------------- | ------------------------------------- | --------------------- | ------------------- |
| LyRiC 格式 `.lrc`                     | ✅           | ／                | ✅                          | ✅                            | ✅                         | ✅                                    | ✅                    | ✅                  |
| ESLyric 逐词歌词格式 `.lrc`           | ✅           | ✅                | ／                          | ✅                            | ✅                         | ✅                                    | ✅                    | ✅                  |
| 网易云音乐逐词歌词格式 `.yrc`         | ✅           | ✅ [^1]           | ✅ [^1]                     | ／                            | ✅                         | ✅                                    | ✅                    | ✅                  |
| QQ 音乐逐词歌词格式 `.qrc`            | ✅           | ✅ [^1]           | ✅ [^1]                     | ✅                            | ／                         | ✅                                    | ✅                    | ✅                  |
| Lyricify Syllable 逐词歌词格式 `.lys` | ✅           | ✅ [^1]           | ✅ [^1]                     | ✅ [^2]                       | ✅ [^2]                    | ／                                    | ✅                    | ✅                  |
| TTML 歌词格式 `.ttml`                 | ✅           | ✅ [^1]           | ✅ [^1]                     | ✅ [^2]                       | ✅ [^2]                    | ✅ [^3]                               | ／                    | ✅                  |
| ASS 字幕格式 `.ass`                   | ❌           | ❌                | ❌                          | ❌                            | ❌                         | ❌                                    | ❌                    | ／                  |

[^1]: 会丢失逐词时间数据、演唱属性（背景人声，对唱人声）和 AMLL 元数据

[^2]: 会丢失演唱属性（背景人声，对唱人声）和 AMLL 元数据

[^3]: 会丢失 AMLL 元数据

## 与 Core 歌词组件一起使用

在和二者合用的时候，需要注意**两者的歌词行结构并不完全相同**，需要进行诸如（以 LyRiC 举例）下面的方式进行转换方可被歌词组件正确解析：

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
// 此时就可以将 converted 传给 LyricPlayer 了
```

推荐使用 TypeScript，这样可以更方便地查错。

## 构建

```shell
wasm-pack build --target bundler --release --scope applemusic-like-lyrics
```
