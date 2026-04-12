[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / TTMLGenerator

# Class: TTMLGenerator

Defined in: [generator.ts:28](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/generator.ts#L28)

TTML 歌词生成器类

用于将内部的 [TTMLResult](../interfaces/TTMLResult.md) 数据结构序列化为 AMLL 项目使用的 TTML 字符串

## See

https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83

## Constructors

### Constructor

> **new TTMLGenerator**(`options?`): `TTMLGenerator`

Defined in: [generator.ts:42](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/generator.ts#L42)

构造一个 TTML 生成器实例

#### Parameters

##### options?

[`GeneratorOptions`](../interfaces/GeneratorOptions.md) = `{}`

生成器配置选项

在 Node.js 环境下必须注入 `domImplementation` 和 `xmlSerializer` 实例（例如用 `@xmldom/xmldom` 等）

#### Returns

`TTMLGenerator`

## Methods

### generate()

> **generate**(`result`): `string`

Defined in: [generator.ts:85](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/generator.ts#L85)

生成 TTML 字符串

#### Parameters

##### result

[`TTMLResult`](../interfaces/TTMLResult.md)

包含元数据和歌词行的 TTML 数据结构

#### Returns

`string`

序列化后的 TTML 字符串

***

### generate()

> `static` **generate**(`result`, `options?`): `string`

Defined in: [generator.ts:72](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/generator.ts#L72)

生成 TTML 字符串的静态便捷方法

#### Parameters

##### result

[`TTMLResult`](../interfaces/TTMLResult.md)

包含元数据和歌词行的 TTML 数据结构

##### options?

[`GeneratorOptions`](../interfaces/GeneratorOptions.md)

生成器配置选项，用于注入 DOM 依赖及自定义部分生成行为

#### Returns

`string`

序列化后的 TTML 字符串
