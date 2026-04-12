[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / AmllLyricLine

# Interface: AmllLyricLine

Defined in: [types/amll.ts:33](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L33)

一行歌词，存储多个单词

## Properties

### endTime

> **endTime**: `number`

Defined in: [types/amll.ts:65](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L65)

该行的结束时间

**并不总是等于最后一个单词的开始时间**

***

### isBG

> **isBG**: `boolean`

Defined in: [types/amll.ts:49](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L49)

该行是否为背景歌词行

***

### isDuet

> **isDuet**: `boolean`

Defined in: [types/amll.ts:53](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L53)

该行是否为对唱歌词行（即歌词行靠右对齐）

***

### romanLyric

> **romanLyric**: `string`

Defined in: [types/amll.ts:45](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L45)

该行的音译

***

### startTime

> **startTime**: `number`

Defined in: [types/amll.ts:59](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L59)

该行的开始时间

**并不总是等于第一个单词的开始时间**

***

### translatedLyric

> **translatedLyric**: `string`

Defined in: [types/amll.ts:41](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L41)

该行的翻译

***

### words

> **words**: [`AmllLyricWord`](AmllLyricWord.md)[]

Defined in: [types/amll.ts:37](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L37)

该行的所有单词
