# Lyric parser/writer for AMLL

[English](./README.md) / 简体中文

此为基于 TypeScript 的重构版本 Lyrics 包，文档未完成。

以下是原文档： 另可参阅：[AMLL Docs](https://amll.dev/reference/lyric.html)

---

> 警告：此为个人项目，且尚未完成开发，可能仍有大量问题，所以请勿直接用于生产环境！

![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/lyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Flyric)](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)

一个 AMLL 的歌词解析/生成模块，使用纯 TypeScript 编写。

本模块由于只着重于歌词内容，所以会丢弃一切和歌词无关的信息，如需获取一个歌词文件中的详细信息（例如歌手）请考虑使用其他框架。

### 解析与生成支持表

| 格式名称                     | 常见扩展名 | 解析 | 生成 |
| ---------------------------- | ---------- | ---- | ---- |
| **LyRiC**                    | `.lrc`     | ✅    | ✅    |
| **LRC A2** (增强型 LRC)      | `.lrc`     | ✅    | ✅    |
| **ESLyric 逐词歌词**         | `.lrc`     | ✅    | ✅    |
| **Salt Player Lyrics (SPL)** | `.spl`     | ✅    | ✅    |
| **网易云逐字**               | `.yrc`     | ✅    | ✅    |
| **QQ 音乐逐字**              | `.qrc`     | ✅    | ✅    |
| **Lyricify Syllable**        | `.lys`     | ✅    | ✅    |
| **Lyricify Lines**           | `.lyl`     | ✅    | ✅    |
| **Lyricify Quick Export**    | `.lqe`     | ✅    | ✅    |
| **TTML**                     | `.ttml`    | ✅    | ✅    |
| **ASS**                      | `.ass`     | ❌    | ✅    |

---

### 格式能力支持表

各格式本身语法规范不同，所支持的歌词特性维度（如逐词、翻译、声部信息等）存在差异：

| 格式名称                       | 时间颗粒度 | 翻译 / 音译          | 对唱 | 背景人声             | 元数据 |
| ------------------------------ | ---------- | -------------------- | ---- | -------------------- | ------ |
| **LyRiC (`.lrc`)**             | 逐行       | ⚠️ 作为附加歌词行输出 | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |
| **LRC A2 (`.lrc`)**            | 逐词       | ⚠️ 作为附加歌词行输出 | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |
| **ESLyric (`.lrc`)**           | 逐词       | ⚠️ 作为附加歌词行输出 | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |
| **SPL (`.spl`)**               | 逐词       | ⚠️ 作为附加歌词行输出 | ❌    | ⚠️ 括号 `()` 包裹文本 | ✅      |
| **网易云 (`.yrc`)**            | 逐字       | ❌                    | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |
| **QQ 音乐 (`.qrc`)**           | 逐字       | ❌                    | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |
| **Lyricify Syllable (`.lys`)** | 逐词       | ❌                    | ✅    | ✅                    | ❌      |
| **Lyricify Lines (`.lyl`)**    | 逐行       | ❌                    | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |
| **Lyricify 快速导出 (`.lqe`)** | 逐词       | ✅                    | ✅    | ✅                    | ❌      |
| **TTML (`.ttml`)**             | 逐词       | ✅                    | ✅    | ✅                    | ✅      |
| **ASS (`.ass`)**               | 逐词       | ❌                    | ❌    | ⚠️ 括号 `()` 包裹文本 | ❌      |

---

### 转换与降级规则说明

当在不同格式间通过 AMLL 内部结构进行跨格式转换时，目标格式若不具备源格式的特定能力，将触发以下降级策略：

1. **逐词降级**：目标格式为纯行级歌词（如 LyRiC `.lrc`、Lyricify Lines `.lyl`）时，逐词时间戳会被剥离，整行词语合并为单一行显示。
2. **翻译与音译降级**：
   * 导出至 LRC 系格式（LyRiC、LRC A2、ESLyric、SPL）时，翻译与音译会作为额外的主时间戳歌词行插入。
   * 导出至除 TTML 之外的逐字格式（YRC、QRC、LYS、LYL）时，翻译和音译会被丢弃。
3. **背景人声**：目标格式不支持原生背景人声标记时，会统一降级为在歌词文本两端包裹圆括号 `(...)` 输出。
4. **对唱属性**：仅 `LYS`、`LQE` 和 `TTML` 格式具备对唱信息，导出至其他格式时均会丢失。
5. **元数据**：若需向 SPL 保留元数据，需将带有元数据的完整解析对象传递给 `stringifySPL`，元数据将转存为 `[key:value]` 标签行输出（再次解析时 Key 会自动转换为小写）。除 TTML 和 SPL 之外，其余格式均不支持元数据。
6. **时间戳精度折损**：ASS 字幕的卡拉OK效果基于厘秒（1cs）计算，因此从毫秒级格式导出为 ASS 时会四舍五入，存在至多 10 毫秒的精度误差。

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
