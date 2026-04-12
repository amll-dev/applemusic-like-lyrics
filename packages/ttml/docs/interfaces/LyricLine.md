[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / LyricLine

# Interface: LyricLine

Defined in: [types/index.ts:119](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L119)

一个主歌词行

## Extends

- [`LyricBase`](LyricBase.md)

## Properties

### agentId?

> `optional` **agentId?**: `string`

Defined in: [types/index.ts:132](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L132)

演唱者 ID

可用于在 metadata.agents 中查找具体名字

***

### backgroundVocal?

> `optional` **backgroundVocal?**: [`LyricBase`](LyricBase.md)

Defined in: [types/index.ts:113](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L113)

背景人声内容

#### Inherited from

[`LyricBase`](LyricBase.md).[`backgroundVocal`](LyricBase.md#backgroundvocal)

***

### endTime

> **endTime**: `number`

Defined in: [types/index.ts:91](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L91)

结束时间，单位毫秒

#### Inherited from

[`LyricBase`](LyricBase.md).[`endTime`](LyricBase.md#endtime)

***

### id?

> `optional` **id?**: `string`

Defined in: [types/index.ts:125](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L125)

行 ID

例如 "L1", "L2"...

***

### romanizations?

> `optional` **romanizations?**: [`SubLyricContent`](SubLyricContent.md)[]

Defined in: [types/index.ts:108](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L108)

音译内容

#### Inherited from

[`LyricBase`](LyricBase.md).[`romanizations`](LyricBase.md#romanizations)

***

### songPart?

> `optional` **songPart?**: `string`

Defined in: [types/index.ts:139](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L139)

歌曲结构组成

例如: "Verse", "Chorus", "Intro", "Outro"

***

### startTime

> **startTime**: `number`

Defined in: [types/index.ts:86](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L86)

开始时间，单位毫秒

#### Inherited from

[`LyricBase`](LyricBase.md).[`startTime`](LyricBase.md#starttime)

***

### text

> **text**: `string`

Defined in: [types/index.ts:81](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L81)

完整的文本内容
- 如果是逐字歌词，这里是所有字拼接后的结果

#### Inherited from

[`LyricBase`](LyricBase.md).[`text`](LyricBase.md#text)

***

### translations?

> `optional` **translations?**: [`SubLyricContent`](SubLyricContent.md)[]

Defined in: [types/index.ts:103](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L103)

翻译内容

#### Inherited from

[`LyricBase`](LyricBase.md).[`translations`](LyricBase.md#translations)

***

### words?

> `optional` **words?**: [`Syllable`](Syllable.md)[]

Defined in: [types/index.ts:98](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L98)

逐字音节信息

如果数组为空或未定义，一般就是逐行歌词

#### Inherited from

[`LyricBase`](LyricBase.md).[`words`](LyricBase.md#words)
