---
title: 各歌词格式介绍
---

本文介绍 [@applemusic-like-lyrics/lyric](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric) 库支持的一些歌词文件格式。

在本文中，「逐字歌词」**泛指时间戳精度高于行级别的歌词**。不同平台、格式实现有所不同，可能对应逐音节或逐词的时间戳。

## TTML

TTML 格式是 AMLL 生态的主要歌词存储与交换格式，支持 AMLL 生态的所有能力，包括翻译音译、背景对唱、逐字音译、注音等等。

有关 TTML 的介绍详见 [TTML](./ttml) 一文。

**本库提供 [`parseTTML`](/reference/lyric/functionparsettml) 和 [`stringifyTTML`](/reference/lyric/functionstringifyttml) 方法用于正反序列化 TTML 歌词。**

## LRC

LRC 是最常见的歌词文件格式，只支持逐行歌词。扩展名为 `.lrc`，是 **l**y**r**i**c**s 的缩写。

我们这里所说的 LRC 是最基本、未作任何扩展的 LRC 格式，有时也称为简单 LRC。LRC 并不是某个机构公开声明定义的，其最初来源已经不可考，目前已经成为业界的某种约定俗成，因此各种变体繁多，很多细节也没有固定。

一般地，LRC 格式中每一行对应着一个歌词行。歌词行的开头有时间戳，表示该行的开始时间。常见的格式有

- `[mm:ss]`
- `[mm:ss.xx]`
- `[mm:ss.xxx]`

其中 `mm` 为分钟，`ss.xxx` 为秒，小数点后可能不保留、保留 2 位或保留 3 位。特别地，同一行歌词可以使用多个时间戳，表示在不同时间重复出现。兼容起见，秒与毫秒之间也接受半角冒号，即 `3:12:5` 等同于 `3:12.5`。不符合该形式的写法一律当作普通文本，例如 `[1]`、`[61]`、`[1234:00.000]` 都不会被当作时间戳。

LRC 格式还支持在开头添加元数据。元数据的格式为 `[tag:content]`。

一些实现允许使用 `#` 开头的行作为注释。本库除了支持 `#` 开头，还额外支持 `//` 开头的行作为注释。只有注释标记在行开头才会被识别为注释行，歌词行中间的注释不会被识别，以免确实有歌词正文包含这些字符。

这里给出一段 LRC 歌词的示例。

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

LRC 没有规定翻译与音译的存储方式。一般的处理方法有两种：
- 通过额外的独立文件提供，时间戳与原文歌词文件相同，对应时间戳对应行的翻译与音译。
- 翻译或音译行紧跟在原文行之后，与原文行的时间戳相同

本库不会特别处理时间戳相同的歌词行，即使这些歌词行内容上是上一行的翻译或音译。因此，解析结果中同一时间可能出现多条歌词行，使用者需自行决定如何使用这些时间相同的歌词行。

若一行歌词完全由括号包裹，这行歌词会被解析为背景人声行。如果有多行连续的括号行，会按原样保留。

[维基百科：LRC (file format)](<https://en.wikipedia.org/wiki/LRC_(file_format)>) 上有更多介绍。

**本库提供 [`parseLrcLike`](/reference/lyric/functionparselrclike) 和 [`stringifyLrcLike`](/reference/lyric/functionstringifylrclike) 作为 LRC 家族歌词的统一解析与生成接口。解析侧的 [`parseLrc`](/reference/lyric/functionparselrc) 是它的等价包装，行内若带有逐字时间戳同样会被解析出来，只是不返回元数据；生成侧的 [`stringifyLrc`](/reference/lyric/functionstringifylrc) 等价于它的普通 LRC 模式，会丢弃逐字信息。**

这些接口生成的逐字时间戳写法略有差异：尖括号形式（LRC A2 与 SPL）先写出行时间戳，再在每个音节之前写开始时间戳；方括号形式（ESLyric）不写行时间戳，行首时间戳改用首个词的时间戳，其后每个词只写结束时间。

## LRC A2

LRC A2 首先由 A2 Media Player 提出，故名。其是在 LRC 基础上扩展的结果，通过在文中加注尖括号包裹的时间戳 `<mm:ss.xx>` 实现了逐字。时间戳格式与 LRC 类似，可能不保留小数点、或小数点后保留 2 位或 3 位。每个尖括号都表示其**后续**一部分文本片段的开始时间。

本库对尖括号时间戳的识别规则与方括号的完全相同，即同样识别 `mm:ss.ms` 的写法，毫秒段也可以省略。**不满足该形式的尖括号按普通字符处理**，例如 `<05>` 不会被当作时间戳。

LRC A2 的扩展名为 `.lrc` 或 `.alrc`。

这里直接给出示例。

```text
[ti: Somebody to Love]
[ar: Jefferson Airplane]
[al: Surrealistic Pillow]
[length: 2:58]

[00:00.00] <00:00.04> When <00:00.16> the <00:00.82> truth <00:01.29> is <00:01.63> found <00:03.09> to <00:03.37> be <00:05.92> lies
[00:06.47] <00:07.67> And <00:07.94> all <00:08.36> the <00:08.63> joy <00:10.28> within <00:10.53> you <00:13.09> dies
[00:13.34] <00:14.32> Don't <00:14.73> you <00:15.14> want <00:15.57> somebody <00:16.09> to <00:16.46> Love
```

本库原样保留歌词文本中的空格，不做合并或裁剪：时间戳紧邻的空白既不会被删去，也不会被挪到相邻的歌词片段上。上例中 `<00:00.04> When` 的 ` When` 会连同前导空格一起作为一个音节保留。

LRC A2 使用尖括号夹入文中，这里涉及到转义的问题：如果歌词中出现了大于号 `>` 或小于号 `<`，应当如何处置？目前没有找到公开的规范说明，业内没有统一的转义方式。在解析时会尽量按时间戳模式匹配 `<mm:ss.xx>`，若歌词中出现 `<` 或 `>` 且不符合时间戳格式，则按普通字符处理。

LRC A2 与普通 LRC 一样没有翻译音译的写法，同时间戳或无时间戳的翻译行都会按上一行的翻译处理，详见[上文](#lrc)。

**本库提供 [`parseLrcA2`](/reference/lyric/functionparselrca2) 和 [`stringifyLrcA2`](/reference/lyric/functionstringifylrca2) 方法用于正反序列化 LRC 歌词。**

## SPL

SPL 全称 Salt Player Lyrics，由 Salt Player（椒盐音乐）提出，基于且兼容（增强型）LRC，规范详见 [Salt Player 歌词格式标准](https://moriafly.com/standards/spl.html)。SPL 把 LRC 生态中五花八门的兼容性写法做了标准化，因此本库以它作为整个 LRC 家族的解析与生成算法，普通 LRC、LRC A2 与 ESLyric 逐词歌词都是它的子集。

时间戳沿用 LRC 的 `[mm:ss.ms]`：分 1 至 3 位、秒 1 至 2 位、毫秒 1 至 6 位，毫秒段可以省略，毫秒不足 3 位时视为在后位补 `0`，因此 `[3:12.5]` 表示 3 分 12 秒 500 毫秒，而不是 3 分 12 秒 5 毫秒。本库为了兼容不规范的既有文件，也接受半角冒号作为秒与毫秒的分隔符。解析出的末行歌词若没有结束时间，会使用 `999:59.999` 作为结束时间。

行的结束时间有两种写法：

- 在行末再写一个时间戳作为**显式行结尾**，如 `[05:20.22]你好椒盐音乐[05:21.22]`。
- 省略不写，由下一行的开始时间决定，即**隐式行结尾**。

一个歌词行还可以重复设置多个时间戳来简写重复出现的歌词，如 `[05:20.22][05:30.22]你好椒盐音乐`。

翻译依靠相同的时间戳识别：主歌词行之后、时间戳与之相同的行是它的翻译，翻译行也可以省略时间戳，但此时必须紧挨着主歌词行。

```text
[05:20.22]你好椒盐音乐
[05:20.22]Hello Salt Player
```

逐字歌词在行内插入逐字标记时间戳，每个标记表示其**后续**一段文本的开始时间：

```text
[05:20.22]你好[05:23.22]椒盐音乐[05:24.22]
```

其中的 `[05:20.22]` 既是行的开始时间也是第一个逐字标记，`[05:24.22]` 既是最后一个逐字标记也是行的结束时间。中间的逐字标记可以改用尖括号包裹。

逐字标记的时间必须递增，且逐字歌词不与重复行特性兼容。

**本库提供 [`parseSPL`](/reference/lyric/functionparsespl) 和 [`stringifySPL`](/reference/lyric/functionstringifyspl) 方法用于正反序列化 SPL 歌词**。

:::note
与规范中「逐字标记乱序则忽略该标记」不同，本库遇到乱序的逐字标记时不会做出任何处理，此行为和其他格式的解析器一致。
:::

## 网易云逐字与 QQ 音乐逐字

二者都是音乐平台私有的逐字歌词格式。网易云音乐使用 `.yrc` 作为扩展名，QQ 音乐使用 `.qrc` 作为扩展名。

二者都使用开头的方括号标注行时间戳，格式均为 `[lineStart,lineDur]`。`lineStart` 为行起始时间，以毫秒计的整数；`lineDur` 是行持续时间，也是以毫秒计的整数。二者也均**不支持**类似 LRC 的重复行使用多个时间戳。

在逐字的表现形式上二者有一些不同。

- 网易云的 YRC 采用 `(sylStart,sylDur,0)text` 格式，先时间戳、后文本，时间戳括号内三个数分别是起始时间、持续时间、`0`。所有 YRC 格式歌词都带有这个 `0`，目前尚未发现其具体含义，可能是为未来扩展预留的字段。
- QQ 音乐的 QRC 采用 `text(sylStart,sylDur)` 格式，先文本、后时间戳。并且没有 YRC 的 `0`。

所有的开始时间均为**绝对时间**，即从音频开始到文本开始所经过的时间。

下面是同一段歌词在两种格式下的示例：

```text
# 网易云音乐 YRC
[190871,1984](190871,361,0)For (191232,172,0)the (191404,376,0)first (191780,1075,0)time
[193459,4198](193459,412,0)What's (193871,574,0)past (194445,506,0)is (194951,2706,0)past

# QQ 音乐 QRC
[190871,1984]For (190871,361)the (191232,172)first (191404,376)time(191780,1075)
[193459,4198]What's (193459,412)past (193871,574)is (194445,506)past(194951,2706)
```

QRC 和 YRC **不具有**类似 LRC A2 的合并相邻空格特性。

由于在文中夹注半角括号 `()` 的时间戳，那歌词文本中的圆括号应当如何转义？由于 YRC 和 QRC 都是私有文件格式，没有官方资料可查，于是我们查找这两个平台上的官方歌词：

- 在我们目前处理到的所有 YRC 歌词中，所有的圆括号均为全角 `（）`，无论是中文还是其他语言
- 在我们目前处理到的所有 QRC 歌词中，圆括号未做转译或替换

因此根据现有样本推测：

- YRC 实际上可能不允许在歌词文本中使用半角圆括号，若有需要应使用全角圆括号。本库也遵守这一原则，在导出为 YRC 时若歌词文本中存在半角圆括号，会自动替换为全角。
- QRC 在匹配时间戳时会略过非时间戳的圆括号，将其作为歌词文本处理。

YRC、QRC 也不支持为歌词添加翻译与音译。一般的做法是伴随提供 LRC 格式的翻译或音译。

另外，本库在解析 YRC 与 QRC 歌词时，若整行被圆括号括起，则会将该行视为背景行并去除括号。

**本库提供 [`parseYrc`](/reference/lyric/functionparseyrc) 和 [`stringifyYrc`](/reference/lyric/functionstringifyyrc) 方法用于正反序列化 YRC 歌词；提供 [`parseQrc`](/reference/lyric/functionparseqrc) 和 [`stringifyQrc`](/reference/lyric/functionstringifyqrc) 方法用于正反序列化 QRC 歌词。**

特别地，QQ 音乐在分发 QRC 歌词时使用了一种加密格式。此格式为包含了 QRC 文本的 XML，经一种类 DES 算法加密后使用 base64 编码而成。**本库提供 [`decryptQrcHex`](/reference/lyric/functiondecryptqrchex) 函数用于解密这样的 base64 串为 XML 文本，提供 [`encryptQrcHex`](/reference/lyric/functionencryptqrchex) 函数用于将明文 XML 加密为 base64 串。**

## Lyricify 系列格式

[Lyricify](https://lyricify.app) 是一款优秀的逐字歌词展示软件。其定义了 Lyricify Lines、Lyricify Syllable 和 Lyricify 快速导出 三种私有格式。

其中：

- Lyricify Lines 为逐行歌词，扩展名 `.lyl`
- Lyricify Syllable 为逐字歌词，扩展名 `.lys`，支持设置背景与对唱行

这两种格式 [官方提供了文档说明](https://github.com/WXRIW/Lyricify-App/blob/main/docs/Lyricify%204/Lyrics.md#lyricify-lines-%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83)。

**本库提供 [`parseLyl`](/reference/lyric/functionparselyl) 和 [`stringifyLyl`](/reference/lyric/functionstringifylyl) 方法用于正反序列化 Lyricify Lines 歌词；提供 [`parseLys`](/reference/lyric/functionparselys) 和 [`stringifyLys`](/reference/lyric/functionstringifylys) 方法用于正反序列化 Lyricify Syllable 歌词。**

Lyricify 快速导出格式扩展名为 `.lqe`（**L**yricify **Q**uick **E**xport 的缩写）。官方没有提供文档说明，但其内容比较易懂。以下说明基于对相关软件实际导出文件的分析，并非官方规范，也可能与未来版本存在差异。

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

头部定义了文件版本信息。此后内容由几部分构成。`[lyrics: format@Lyricify Syllable]` 后携带 Lyricify Syllable 格式的逐字歌词，此后 `[translation: format@LRC]` 后携带 LRC 格式的翻译歌词、`[pronunciation: format@LRC, language@romaji]` 后携带 LRC 格式的罗马字音译歌词。

需要注意的是，翻译或音译区块只包含存在内容的行。若某一行没有翻译或音译，则该区块中不会出现对应时间戳。

可见 Lyricify 快速导出格式支持逐字时间、背景行、对唱行、翻译、音译。

此外，也可以参考 Lyricify 开发者的项目 [Lyricify Lyrics Helper](https://github.com/WXRIW/Lyricify-Lyrics-Helper)，其中有 Lyricify 系列格式的解析与生成逻辑，并以 MIT 开源。

**本库提供 [`parseLqe`](/reference/lyric/functionparselqe) 和 [`stringifyLqe`](/reference/lyric/functionstringifylqe) 方法用于正反序列化 Lyricify 快速导出。**

## 总结表格

| 格式              | 扩展名          | 逐行时间 | 逐字时间 | 原生翻译音译 | 原生背景对唱 |
| ----------------- | --------------- | :------: | :------: | :----------: | :----------: |
| TTML              | `.ttml`         |    ✓     |    ✓     |      ✓       |      ✓       |
| LRC               | `.lrc`          |    ✓     |    ✕     |      ✕       |      ✕       |
| LRC A2 扩展       | `.lrc`, `.alrc` |    ✓     |    ✓     |      ✕       |      ✕       |
| SPL               | `.spl`          |    ✓     |    ✓     |      ✕       |      ✕       |
| 网易云逐字        | `.yrc`          |    ✓     |    ✓     |      ✕       |      ✕       |
| QQ 音乐逐字       | `.qrc`          |    ✓     |    ✓     |      ✕       |      ✕       |
| Lyricify Lines    | `.lyl`          |    ✓     |    ✕     |      ✕       |      ✕       |
| Lyricify Syllable | `.lys`          |    ✓     |    ✓     |      ✕       |      ✓       |
| Lyricify 快速导出 | `.lqe`          |    ✓     |    ✓     |      ✓       |      ✓       |
