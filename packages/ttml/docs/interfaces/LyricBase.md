[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / LyricBase

# Interface: LyricBase

Defined in: [types/index.ts:76](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L76)

基础歌词内容

## Extended by

- [`LyricLine`](LyricLine.md)

## Properties

### backgroundVocal?

> `optional` **backgroundVocal?**: `LyricBase`

Defined in: [types/index.ts:113](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L113)

背景人声内容

***

### endTime

> **endTime**: `number`

Defined in: [types/index.ts:91](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L91)

结束时间，单位毫秒

***

### romanizations?

> `optional` **romanizations?**: [`SubLyricContent`](SubLyricContent.md)[]

Defined in: [types/index.ts:108](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L108)

音译内容

***

### startTime

> **startTime**: `number`

Defined in: [types/index.ts:86](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L86)

开始时间，单位毫秒

***

### text

> **text**: `string`

Defined in: [types/index.ts:81](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L81)

完整的文本内容
- 如果是逐字歌词，这里是所有字拼接后的结果

***

### translations?

> `optional` **translations?**: [`SubLyricContent`](SubLyricContent.md)[]

Defined in: [types/index.ts:103](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L103)

翻译内容

***

### words?

> `optional` **words?**: [`Syllable`](Syllable.md)[]

Defined in: [types/index.ts:98](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L98)

逐字音节信息

如果数组为空或未定义，一般就是逐行歌词
