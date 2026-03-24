[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / LyricLine

# Interface: LyricLine

一行歌词，存储多个单词

## Table of contents

### Properties

- [endTime](LyricLine.md#endtime)
- [isBG](LyricLine.md#isbg)
- [isDuet](LyricLine.md#isduet)
- [romanLyric](LyricLine.md#romanlyric)
- [startTime](LyricLine.md#starttime)
- [translatedLyric](LyricLine.md#translatedlyric)
- [words](LyricLine.md#words)

## Properties

### endTime

• **endTime**: `number`

句子的结束时间，单位为毫秒

#### Defined in

[packages/core/src/interfaces.ts:51](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L51)

___

### isBG

• **isBG**: `boolean`

该行是否为背景歌词行，当该行歌词的上一句非背景歌词被激活时，这行歌词将会显示出来，注意每个非背景歌词下方只能拥有一个背景歌词

#### Defined in

[packages/core/src/interfaces.ts:53](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L53)

___

### isDuet

• **isDuet**: `boolean`

该行是否为对唱歌词行（即歌词行靠右对齐）

#### Defined in

[packages/core/src/interfaces.ts:55](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L55)

___

### romanLyric

• **romanLyric**: `string`

该行的音译歌词，将会显示在翻译歌词行的下方

#### Defined in

[packages/core/src/interfaces.ts:47](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L47)

___

### startTime

• **startTime**: `number`

句子的起始时间，单位为毫秒

#### Defined in

[packages/core/src/interfaces.ts:49](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L49)

___

### translatedLyric

• **translatedLyric**: `string`

该行的翻译歌词，将会显示在主歌词行的下方

#### Defined in

[packages/core/src/interfaces.ts:45](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L45)

___

### words

• **words**: [`LyricWord`](LyricWord.md)[]

该行的所有单词
如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词且通常其始末时间和本结构的 `startTime` 和 `endTime` 相同

#### Defined in

[packages/core/src/interfaces.ts:43](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L43)
