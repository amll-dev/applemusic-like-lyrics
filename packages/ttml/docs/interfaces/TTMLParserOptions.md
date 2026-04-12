[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / TTMLParserOptions

# Interface: TTMLParserOptions

Defined in: [types/index.ts:10](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L10)

解析器配置选项

## Properties

### domParser?

> `optional` **domParser?**: `object`

Defined in: [types/index.ts:16](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L16)

注入的 DOMParser 实例
- 浏览器环境: 可忽略，默认使用 window.DOMParser
- Node.js 环境: 必须传入 (例如: `new (require('@xmldom/xmldom').DOMParser)()`)

#### parseFromString()

> **parseFromString**(`string`, `type`): `Document`

##### Parameters

###### string

`string`

###### type

`DOMParserSupportedType`

##### Returns

`Document`
