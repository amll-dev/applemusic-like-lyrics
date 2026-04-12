[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / Syllable

# Interface: Syllable

Defined in: [types/index.ts:165](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L165)

一个歌词音节

## Properties

### emptyBeat?

> `optional` **emptyBeat?**: `number`

Defined in: [types/index.ts:207](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L207)

单词的空拍数量，一般只用于方便歌词打轴

***

### endsWithSpace?

> `optional` **endsWithSpace?**: `boolean`

Defined in: [types/index.ts:190](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L190)

该音节后面是否应该跟着一个空格

注意必须根据此标志在歌词后面添加空格，text 中不应包含空格

***

### endTime

> **endTime**: `number`

Defined in: [types/index.ts:183](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L183)

该音节的结束时间，单位毫秒
- 如果是 Ruby 标注，此值为最后一个 RubyTag 的 endTime

***

### obscene?

> `optional` **obscene?**: `boolean`

Defined in: [types/index.ts:202](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L202)

单词内容是否包含冒犯性的不雅用语

***

### ruby?

> `optional` **ruby?**: [`RubyTag`](RubyTag.md)[]

Defined in: [types/index.ts:197](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L197)

Ruby 标注信息

如果存在此属性，说明该音节是一个 Ruby 容器

***

### startTime

> **startTime**: `number`

Defined in: [types/index.ts:177](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L177)

该音节的开始时间，单位毫秒
- 如果是 Ruby 标注，此值为第一个 RubyTag 的 startTime

***

### text

> **text**: `string`

Defined in: [types/index.ts:171](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L171)

该音节的内容
- 如果是普通音节，为常规歌词文本
- 如果是 Ruby 标注，这里对应 ruby 的基文本，通常为汉字
