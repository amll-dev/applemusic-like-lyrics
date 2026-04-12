[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / AmllLyricWord

# Interface: AmllLyricWord

Defined in: [types/amll.ts:9](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L9)

一个歌词单词

## Extends

- [`LyricWordBase`](LyricWordBase.md)

## Properties

### emptyBeat?

> `optional` **emptyBeat?**: `number`

Defined in: [types/amll.ts:15](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L15)

单词的空拍数量，一般只用于方便歌词打轴

***

### endTime

> **endTime**: `number`

Defined in: [types/amll.ts:25](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L25)

单词的结束时间，单位为毫秒

#### Inherited from

[`LyricWordBase`](LyricWordBase.md).[`endTime`](LyricWordBase.md#endtime)

***

### obscene?

> `optional` **obscene?**: `boolean`

Defined in: [types/amll.ts:13](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L13)

单词内容是否包含冒犯性的不雅用语

***

### romanWord?

> `optional` **romanWord?**: `string`

Defined in: [types/amll.ts:11](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L11)

单词的音译内容

***

### ruby?

> `optional` **ruby?**: [`LyricWordBase`](LyricWordBase.md)[]

Defined in: [types/amll.ts:17](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L17)

单词的注音内容

***

### startTime

> **startTime**: `number`

Defined in: [types/amll.ts:23](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L23)

单词的起始时间，单位为毫秒

#### Inherited from

[`LyricWordBase`](LyricWordBase.md).[`startTime`](LyricWordBase.md#starttime)

***

### word

> **word**: `string`

Defined in: [types/amll.ts:27](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L27)

单词内容

#### Inherited from

[`LyricWordBase`](LyricWordBase.md).[`word`](LyricWordBase.md#word)
