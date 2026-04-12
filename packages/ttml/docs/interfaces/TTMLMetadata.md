[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / TTMLMetadata

# Interface: TTMLMetadata

Defined in: [types/index.ts:247](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L247)

TTML 歌词的元数据内容

## Properties

### agents?

> `optional` **agents?**: `Record`\<`string`, [`Agent`](Agent.md)\>

Defined in: [types/index.ts:296](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L296)

演唱者映射表

***

### album?

> `optional` **album?**: `string`[]

Defined in: [types/index.ts:276](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L276)

专辑名称列表

***

### artist?

> `optional` **artist?**: `string`[]

Defined in: [types/index.ts:271](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L271)

艺术家名称列表

***

### authorIds?

> `optional` **authorIds?**: `string`[]

Defined in: [types/index.ts:286](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L286)

歌词作者 GitHub 数字 ID 列表

***

### authorNames?

> `optional` **authorNames?**: `string`[]

Defined in: [types/index.ts:291](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L291)

歌词作者 GitHub 用户名列表

***

### isrc?

> `optional` **isrc?**: `string`[]

Defined in: [types/index.ts:281](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L281)

ISRC 号码列表

***

### language?

> `optional` **language?**: `string`

Defined in: [types/index.ts:251](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L251)

歌词主语言代码 (BCP-47)

***

### platformIds?

> `optional` **platformIds?**: `Partial`\<`Record`\<[`PlatformId`](../type-aliases/PlatformId.md), `string`[]\>\>

Defined in: [types/index.ts:301](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L301)

平台关联 ID

***

### rawProperties?

> `optional` **rawProperties?**: `Record`\<`string`, `string`[]\>

Defined in: [types/index.ts:306](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L306)

其他原始的自定义属性

***

### songwriters?

> `optional` **songwriters?**: `string`[]

Defined in: [types/index.ts:261](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L261)

歌曲创作者列表

***

### timingMode?

> `optional` **timingMode?**: `"Word"` \| `"Line"`

Defined in: [types/index.ts:256](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L256)

计时模式

***

### title?

> `optional` **title?**: `string`[]

Defined in: [types/index.ts:266](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L266)

歌曲标题列表
