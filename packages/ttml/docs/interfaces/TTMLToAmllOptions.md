[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / TTMLToAmllOptions

# Interface: TTMLToAmllOptions

Defined in: [types/amll.ts:90](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L90)

解析器生成的原始 TTML 数据结构转换为 AMLL 的数据结构时的配置选项

## Properties

### romanizationLanguage?

> `optional` **romanizationLanguage?**: `string`

Defined in: [types/amll.ts:102](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L102)

提取音译时的首选目标语言 (如 `"ja-Latn"`)

未提供或找不到指定的目标语言代码时提取第一个音译

***

### translationLanguage?

> `optional` **translationLanguage?**: `string`

Defined in: [types/amll.ts:96](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/amll.ts#L96)

提取翻译时的首选目标语言 (如 `"zh-Hans"`)

未提供或找不到指定的目标语言代码时提取第一个翻译
