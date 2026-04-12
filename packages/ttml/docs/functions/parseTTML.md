[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / parseTTML

# Function: parseTTML()

> **parseTTML**(`ttmlText`): [`AmllLyricResult`](../interfaces/AmllLyricResult.md)

Defined in: [index.ts:22](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/index.ts#L22)

将 TTML 格式的 XML 字符串解析为 [AmllLyricResult](../interfaces/AmllLyricResult.md) 对象的便捷方法

若需要原始的、内容更丰富的 [TTMLResult](../interfaces/TTMLResult.md) 结构，建议直接使用 [TTMLParser](../classes/TTMLParser.md) 类

## Parameters

### ttmlText

`string`

符合 TTML 规范的 XML 字符串

## Returns

[`AmllLyricResult`](../interfaces/AmllLyricResult.md)

解析后的 [AmllLyricResult](../interfaces/AmllLyricResult.md) 对象，包含歌词行列表和元数据

## Remarks

默认使用全局的 `DOMParser`，若为 Nodejs 环境，必须使用
[TTMLParser](../classes/TTMLParser.md) 类注入 `DOMParser` 实现，例如 `@xmldom/xmldom`

## Throws

如果没有全局的 `DOMParser`，抛出错误
