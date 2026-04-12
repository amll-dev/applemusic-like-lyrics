[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / Agent

# Interface: Agent

Defined in: [types/index.ts:213](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L213)

演唱者信息结构

## Properties

### id

> **id**: `string`

Defined in: [types/index.ts:220](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L220)

演唱者的 ID

如果是 AMLL 的 TTML，只有 v1 和 v2 分别指代非对唱和对唱。
如果是 Apple Music 的 TTML，还会出现 v3，v4 等指代每个演唱者，以及 v1000 用于指代合唱。

***

### name?

> `optional` **name?**: `string`

Defined in: [types/index.ts:225](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L225)

演唱者名称

***

### type?

> `optional` **type?**: `string`

Defined in: [types/index.ts:232](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L232)

演唱者类型

通常为 "person", "group", "other"，也有可能是其他字符串
