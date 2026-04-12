[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / TTMLParser

# Class: TTMLParser

Defined in: [parser.ts:51](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/parser.ts#L51)

TTML 歌词生成器类

用于将 AMLL 项目使用的 TTML 字符串解析为结构化的 [TTMLResult](../interfaces/TTMLResult.md) 数据结构

## See

https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83

## Constructors

### Constructor

> **new TTMLParser**(`options?`): `TTMLParser`

Defined in: [parser.ts:76](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/parser.ts#L76)

构造一个 TTML 解析器实例

#### Parameters

##### options?

[`TTMLParserOptions`](../interfaces/TTMLParserOptions.md)

生成器配置选项

在 Node.js 环境下必须注入 `domParser` 实例（例如用 `@xmldom/xmldom` 等）

#### Returns

`TTMLParser`

## Methods

### parse()

> **parse**(`xmlStr`): [`TTMLResult`](../interfaces/TTMLResult.md)

Defined in: [parser.ts:106](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/parser.ts#L106)

解析 TTML 字符串

#### Parameters

##### xmlStr

`string`

需要解析的 TTML XML 字符串

#### Returns

[`TTMLResult`](../interfaces/TTMLResult.md)

解析后的结构化 TTML 数据结构

#### Throws

当输入的 XML 字符串格式无效时抛出异常

***

### parse()

> `static` **parse**(`xmlStr`, `options?`): [`TTMLResult`](../interfaces/TTMLResult.md)

Defined in: [parser.ts:95](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/parser.ts#L95)

解析 TTML 字符串的静态便捷方法

#### Parameters

##### xmlStr

`string`

需要解析的 TTML XML 字符串

##### options?

[`TTMLParserOptions`](../interfaces/TTMLParserOptions.md)

解析器配置选项，用于注入 DOM 依赖

#### Returns

[`TTMLResult`](../interfaces/TTMLResult.md)

解析后的结构化 TTML 数据结构

#### Throws

当输入的 XML 字符串格式无效时抛出异常
