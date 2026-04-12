[**@applemusic-like-lyrics/ttml**](../README.md)

***

[@applemusic-like-lyrics/ttml](../globals.md) / GeneratorOptions

# Interface: GeneratorOptions

Defined in: [types/index.ts:24](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L24)

生成器配置选项

## Properties

### domImplementation?

> `optional` **domImplementation?**: `DOMImplementation`

Defined in: [types/index.ts:30](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L30)

注入的 DOMImplementation 实例
- 浏览器: 可忽略，默认使用 document.implementation
- Node.js 环境: 必须传入 (例如: `new (require('@xmldom/xmldom').DOMImplementation)()`)

***

### useSidecar?

> `optional` **useSidecar?**: `boolean`

Defined in: [types/index.ts:45](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L45)

对于逐行翻译/音译，是否将其放入 Head (Apple Music 风格)

注意逐字翻译/音译将始终强制放入 Head，无论此值如何

#### Default

```ts
false
```

***

### xmlSerializer?

> `optional` **xmlSerializer?**: `XMLSerializer`

Defined in: [types/index.ts:37](https://github.com/amll-dev/applemusic-like-lyrics/blob/91e5d5732d45c73fd3855b048b8bd91a2bdc3af1/packages/ttml/src/types/index.ts#L37)

注入的 XMLSerializer 实例
- 浏览器: 可忽略，默认使用 new XMLSerializer()
- Node.js 环境: 必须传入 (例如: `new (require('@xmldom/xmldom').XMLSerializer)()`)
