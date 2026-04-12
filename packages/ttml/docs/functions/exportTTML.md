[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / exportTTML

# Function: exportTTML()

> **exportTTML**(`ttmlLyric`): `string`

Defined in: [index.ts:37](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/index.ts#L37)

将 [AmllLyricResult](../interfaces/AmllLyricResult.md) 对象序列化为 TTML 格式的 XML 字符串的便捷方法

若需要自定义生成选项，建议直接使用 [TTMLParser](../classes/TTMLParser.md) 类

## Parameters

### ttmlLyric

[`AmllLyricResult`](../interfaces/AmllLyricResult.md)

包含歌词行列表和元数据的 [AmllLyricResult](../interfaces/AmllLyricResult.md) 对象

## Returns

`string`

序列化后的 TTML XML 字符串

## Remarks

默认使用全局的 `document.implementation` 和 `XMLSerializer`，若为 Nodejs 环境，
必须使用 [TTMLGenerator](../classes/TTMLGenerator.md) 类注入 `domImplementation` 和 `xmlSerializer`，例如 `@xmldom/xmldom`

## Throws

如果没有全局的 `DOMImplementation` 和 `XMLSerializer`，抛出错误
