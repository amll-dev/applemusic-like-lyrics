[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / LyricPlayer

# Class: LyricPlayer

歌词播放组件，本框架的核心组件

尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施

## 渲染说明

- 单词渲染统一采用底部对齐，避免包含注音与不包含注音的视觉偏移
- 当行内存在逐字音译时，未提供逐字音译的单词会生成占位以保持布局高度一致
- 注音渲染按每个注音片段保留时间信息，用于与逐字动画同步

## Hierarchy

- `EventTarget`

  ↳ **`LyricPlayer`**

## Implements

- [`HasElement`](../interfaces/HasElement.md)
- [`Disposable`](../interfaces/Disposable.md)

## Table of contents

### Constructors

- [constructor](LyricPlayer.md#constructor)

### Properties

- [alignAnchor](LyricPlayer.md#alignanchor)
- [alignPosition](LyricPlayer.md#alignposition)
- [allowScroll](LyricPlayer.md#allowscroll)
- [bottomLine](LyricPlayer.md#bottomline)
- [bufferedLines](LyricPlayer.md#bufferedlines)
- [currentTime](LyricPlayer.md#currenttime)
- [disableSpring](LyricPlayer.md#disablespring)
- [element](LyricPlayer.md#element)
- [emUnit](LyricPlayer.md#emunit)
- [enableBlur](LyricPlayer.md#enableblur)
- [enableScale](LyricPlayer.md#enablescale)
- [hidePassedLines](LyricPlayer.md#hidepassedlines)
- [hotLines](LyricPlayer.md#hotlines)
- [innerSize](LyricPlayer.md#innersize)
- [interludeDots](LyricPlayer.md#interludedots)
- [interludeDotsSize](LyricPlayer.md#interludedotssize)
- [invokedByScrollEvent](LyricPlayer.md#invokedbyscrollevent)
- [isNonDynamic](LyricPlayer.md#isnondynamic)
- [isScrolled](LyricPlayer.md#isscrolled)
- [lyricLines](LyricPlayer.md#lyriclines)
- [lyricLinesEl](LyricPlayer.md#lyriclinesel)
- [lyricLinesIndexes](LyricPlayer.md#lyriclinesindexes)
- [lyricLinesSize](LyricPlayer.md#lyriclinessize)
- [padding](LyricPlayer.md#padding)
- [posXSpringParams](LyricPlayer.md#posxspringparams)
- [posYSpringParams](LyricPlayer.md#posyspringparams)
- [processedLines](LyricPlayer.md#processedlines)
- [resizeObserver](LyricPlayer.md#resizeobserver)
- [scaleSpringParams](LyricPlayer.md#scalespringparams)
- [scrollBoundary](LyricPlayer.md#scrollboundary)
- [scrollOffset](LyricPlayer.md#scrolloffset)
- [scrollToIndex](LyricPlayer.md#scrolltoindex)
- [scrolledHandler](LyricPlayer.md#scrolledhandler)
- [size](LyricPlayer.md#size)
- [style](LyricPlayer.md#style)
- [supportMaskImage](LyricPlayer.md#supportmaskimage)
- [supportPlusLighter](LyricPlayer.md#supportpluslighter)

### Methods

- [\_getIsNonDynamic](LyricPlayer.md#_getisnondynamic)
- [addEventListener](LyricPlayer.md#addeventlistener)
- [beginScrollHandler](LyricPlayer.md#beginscrollhandler)
- [calcLayout](LyricPlayer.md#calclayout)
- [dispatchEvent](LyricPlayer.md#dispatchevent)
- [dispose](LyricPlayer.md#dispose)
- [endScrollHandler](LyricPlayer.md#endscrollhandler)
- [getBottomLineElement](LyricPlayer.md#getbottomlineelement)
- [getCurrentInterlude](LyricPlayer.md#getcurrentinterlude)
- [getCurrentTime](LyricPlayer.md#getcurrenttime)
- [getElement](LyricPlayer.md#getelement)
- [getEnableScale](LyricPlayer.md#getenablescale)
- [getEnableSpring](LyricPlayer.md#getenablespring)
- [getLyricLines](LyricPlayer.md#getlyriclines)
- [limitScrollOffset](LyricPlayer.md#limitscrolloffset)
- [onLineClickedHandler](LyricPlayer.md#onlineclickedhandler)
- [onPageShow](LyricPlayer.md#onpageshow)
- [rebuildStyle](LyricPlayer.md#rebuildstyle)
- [removeEventListener](LyricPlayer.md#removeeventlistener)
- [resetScroll](LyricPlayer.md#resetscroll)
- [setAlignAnchor](LyricPlayer.md#setalignanchor)
- [setAlignPosition](LyricPlayer.md#setalignposition)
- [setCurrentTime](LyricPlayer.md#setcurrenttime)
- [setEnableBlur](LyricPlayer.md#setenableblur)
- [setEnableScale](LyricPlayer.md#setenablescale)
- [setEnableSpring](LyricPlayer.md#setenablespring)
- [setHidePassedLines](LyricPlayer.md#sethidepassedlines)
- [setLinePosXSpringParams](LyricPlayer.md#setlineposxspringparams)
- [setLinePosYSpringParams](LyricPlayer.md#setlineposyspringparams)
- [setLineScaleSpringParams](LyricPlayer.md#setlinescalespringparams)
- [setLyricLines](LyricPlayer.md#setlyriclines)
- [update](LyricPlayer.md#update)

## Constructors

### constructor

• **new LyricPlayer**()

#### Overrides

EventTarget.constructor

#### Defined in

[packages/core/src/lyric-player/index.ts:300](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L300)

## Properties

### alignAnchor

• `Private` **alignAnchor**: ``"bottom"`` \| ``"center"`` \| ``"top"`` = `"center"`

#### Defined in

[packages/core/src/lyric-player/index.ts:108](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L108)

___

### alignPosition

• `Private` **alignPosition**: `number` = `0.5`

#### Defined in

[packages/core/src/lyric-player/index.ts:109](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L109)

___

### allowScroll

• `Private` **allowScroll**: `boolean` = `true`

#### Defined in

[packages/core/src/lyric-player/index.ts:58](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L58)

___

### bottomLine

• `Private` **bottomLine**: `BottomLineEl`

#### Defined in

[packages/core/src/lyric-player/index.ts:104](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L104)

___

### bufferedLines

• `Private` **bufferedLines**: `Set`<`number`\>

#### Defined in

[packages/core/src/lyric-player/index.ts:56](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L56)

___

### currentTime

• `Private` **currentTime**: `number` = `0`

#### Defined in

[packages/core/src/lyric-player/index.ts:48](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L48)

___

### disableSpring

• `Private` **disableSpring**: `boolean` = `false`

#### Defined in

[packages/core/src/lyric-player/index.ts:107](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L107)

___

### element

• `Private` **element**: `HTMLElement`

#### Defined in

[packages/core/src/lyric-player/index.ts:47](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L47)

___

### emUnit

• `Private` **emUnit**: `number`

#### Defined in

[packages/core/src/lyric-player/index.ts:98](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L98)

___

### enableBlur

• `Private` **enableBlur**: `boolean` = `true`

#### Defined in

[packages/core/src/lyric-player/index.ts:100](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L100)

___

### enableScale

• `Private` **enableScale**: `boolean` = `true`

#### Defined in

[packages/core/src/lyric-player/index.ts:101](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L101)

___

### hidePassedLines

• `Private` **hidePassedLines**: `boolean` = `false`

#### Defined in

[packages/core/src/lyric-player/index.ts:63](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L63)

___

### hotLines

• `Private` **hotLines**: `Set`<`number`\>

#### Defined in

[packages/core/src/lyric-player/index.ts:55](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L55)

___

### innerSize

• `Readonly` **innerSize**: [`number`, `number`]

#### Defined in

[packages/core/src/lyric-player/index.ts:113](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L113)

___

### interludeDots

• `Private` **interludeDots**: `InterludeDots`

#### Defined in

[packages/core/src/lyric-player/index.ts:102](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L102)

___

### interludeDotsSize

• `Private` **interludeDotsSize**: [`number`, `number`]

#### Defined in

[packages/core/src/lyric-player/index.ts:103](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L103)

___

### invokedByScrollEvent

• `Private` **invokedByScrollEvent**: `boolean` = `false`

#### Defined in

[packages/core/src/lyric-player/index.ts:61](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L61)

___

### isNonDynamic

• `Private` **isNonDynamic**: `boolean` = `false`

#### Defined in

[packages/core/src/lyric-player/index.ts:110](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L110)

___

### isScrolled

• `Private` **isScrolled**: `boolean` = `false`

#### Defined in

[packages/core/src/lyric-player/index.ts:60](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L60)

___

### lyricLines

• `Private` **lyricLines**: [`LyricLine`](../interfaces/LyricLine.md)[] = `[]`

#### Defined in

[packages/core/src/lyric-player/index.ts:49](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L49)

___

### lyricLinesEl

• `Private` **lyricLinesEl**: `LyricLineEl`[] = `[]`

#### Defined in

[packages/core/src/lyric-player/index.ts:51](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L51)

___

### lyricLinesIndexes

• `Private` **lyricLinesIndexes**: `WeakMap`<`LyricLineEl`, `number`\>

#### Defined in

[packages/core/src/lyric-player/index.ts:54](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L54)

___

### lyricLinesSize

• `Private` **lyricLinesSize**: `WeakMap`<`LyricLineEl`, [`number`, `number`]\>

#### Defined in

[packages/core/src/lyric-player/index.ts:52](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L52)

___

### padding

• `Private` **padding**: `number`

#### Defined in

[packages/core/src/lyric-player/index.ts:99](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L99)

___

### posXSpringParams

• `Private` **posXSpringParams**: `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\>

#### Defined in

[packages/core/src/lyric-player/index.ts:83](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L83)

___

### posYSpringParams

• `Private` **posYSpringParams**: `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\>

#### Defined in

[packages/core/src/lyric-player/index.ts:88](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L88)

___

### processedLines

• `Private` **processedLines**: [`LyricLine`](../interfaces/LyricLine.md)[] = `[]`

#### Defined in

[packages/core/src/lyric-player/index.ts:50](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L50)

___

### resizeObserver

• `Private` **resizeObserver**: `ResizeObserver`

#### Defined in

[packages/core/src/lyric-player/index.ts:64](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L64)

___

### scaleSpringParams

• `Private` **scaleSpringParams**: `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\>

#### Defined in

[packages/core/src/lyric-player/index.ts:93](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L93)

___

### scrollBoundary

• `Private` **scrollBoundary**: `number`[]

#### Defined in

[packages/core/src/lyric-player/index.ts:111](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L111)

___

### scrollOffset

• `Private` **scrollOffset**: `number` = `0`

#### Defined in

[packages/core/src/lyric-player/index.ts:62](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L62)

___

### scrollToIndex

• `Private` **scrollToIndex**: `number` = `0`

#### Defined in

[packages/core/src/lyric-player/index.ts:57](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L57)

___

### scrolledHandler

• `Private` **scrolledHandler**: `number` = `0`

#### Defined in

[packages/core/src/lyric-player/index.ts:59](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L59)

___

### size

• `Readonly` **size**: [`number`, `number`]

#### Defined in

[packages/core/src/lyric-player/index.ts:112](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L112)

___

### style

• `Readonly` **style**: `StyleSheet`<``"lyricPlayer"`` \| ``"lyricLine"`` \| ``"@media (max-width: 1024px)"`` \| ``"lyricDuetLine"`` \| ``"lyricBgLine"`` \| ``"lyricMainLine"`` \| ``"lyricSubLine"`` \| ``"disableSpring"`` \| ``"interludeDots"`` \| ``"@supports (mix-blend-mode: plus-lighter)"`` \| ``"tmpDisableTransition"``\>

#### Defined in

[packages/core/src/lyric-player/index.ts:171](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L171)

___

### supportMaskImage

• `Readonly` **supportMaskImage**: `boolean`

#### Defined in

[packages/core/src/lyric-player/index.ts:106](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L106)

___

### supportPlusLighter

• `Readonly` **supportPlusLighter**: `boolean`

#### Defined in

[packages/core/src/lyric-player/index.ts:105](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L105)

## Methods

### \_getIsNonDynamic

▸ **_getIsNonDynamic**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/core/src/lyric-player/index.ts:126](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L126)

___

### addEventListener

▸ **addEventListener**(`type`, `callback`, `options?`): `void`

Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.

The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.

When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.

When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.

When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.

If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.

The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `callback` | ``null`` \| `EventListenerOrEventListenerObject` |
| `options?` | `boolean` \| `AddEventListenerOptions` |

#### Returns

`void`

#### Inherited from

EventTarget.addEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8209

___

### beginScrollHandler

▸ `Private` **beginScrollHandler**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/core/src/lyric-player/index.ts:403](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L403)

___

### calcLayout

▸ **calcLayout**(`force?`, `reflow?`): `void`

重新布局定位歌词行的位置，调用完成后再逐帧调用 `update`
函数即可让歌词通过动画移动到目标位置。

函数有一个 `force` 参数，用于指定是否强制修改布局，也就是不经过动画直接调整元素位置和大小。

此函数还有一个 `reflow` 参数，用于指定是否需要重新计算布局

因为计算布局必定会导致浏览器重排布局，所以会大幅度影响流畅度和性能，故请只在以下情况下将其​设置为 true：

1. 歌词页面大小发生改变时（这个组件会自行处理）
2. 加载了新的歌词时（不论前后歌词是否完全一样）
3. 用户自行跳转了歌曲播放位置（不论距离远近）

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `force` | `boolean` | `false` | 是否不经过动画直接修改布局定位 |
| `reflow` | `boolean` | `false` | 是否进行重新布局（重新计算每行歌词大小） |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:645](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L645)

___

### dispatchEvent

▸ **dispatchEvent**(`event`): `boolean`

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | `Event` |

#### Returns

`boolean`

#### Inherited from

EventTarget.dispatchEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8215

___

### dispose

▸ **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Implementation of

[Disposable](../interfaces/Disposable.md).[dispose](../interfaces/Disposable.md#dispose)

#### Defined in

[packages/core/src/lyric-player/index.ts:1000](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L1000)

___

### endScrollHandler

▸ `Private` **endScrollHandler**(): `void`

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:416](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L416)

___

### getBottomLineElement

▸ **getBottomLineElement**(): `HTMLElement`

获取一个特殊的底栏元素，默认是空白的，可以往内部添加任意元素

这个元素始终在歌词的底部，可以用于显示歌曲创作者等信息

但是请勿删除该元素，只能在内部存放元素

#### Returns

`HTMLElement`

一个元素，可以往内部添加任意元素

#### Defined in

[packages/core/src/lyric-player/index.ts:795](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L795)

___

### getCurrentInterlude

▸ **getCurrentInterlude**(): `undefined` \| [`number`, `number`, `number`, `boolean`]

获取当前播放时间里是否处于间奏区间
如果是则会返回单位为毫秒的始末时间
否则返回 undefined

这个只允许内部调用

#### Returns

`undefined` \| [`number`, `number`, `number`, `boolean`]

[开始时间,结束时间,大概处于的歌词行ID,下一句是否为对唱歌词] 或 undefined 如果不处于间奏区间

#### Defined in

[packages/core/src/lyric-player/index.ts:433](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L433)

___

### getCurrentTime

▸ **getCurrentTime**(): `number`

获取当前歌词的播放位置

一般和最后调用 `setCurrentTime` 给予的参数一样

#### Returns

`number`

当前播放位置

#### Defined in

[packages/core/src/lyric-player/index.ts:771](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L771)

___

### getElement

▸ **getElement**(): `HTMLElement`

获取这个类所对应的 HTML 元素实例

#### Returns

`HTMLElement`

#### Implementation of

[HasElement](../interfaces/HasElement.md).[getElement](../interfaces/HasElement.md#getelement)

#### Defined in

[packages/core/src/lyric-player/index.ts:783](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L783)

___

### getEnableScale

▸ **getEnableScale**(): `boolean`

获取当前是否启用了歌词行缩放效果

#### Returns

`boolean`

是否启用歌词行缩放效果

#### Defined in

[packages/core/src/lyric-player/index.ts:168](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L168)

___

### getEnableSpring

▸ **getEnableSpring**(): `boolean`

获取当前是否启用了物理弹簧

#### Returns

`boolean`

是否启用物理弹簧

#### Defined in

[packages/core/src/lyric-player/index.ts:149](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L149)

___

### getLyricLines

▸ **getLyricLines**(): [`LyricLine`](../interfaces/LyricLine.md)[]

获取当前歌词数组

一般和最后调用 `setLyricLines` 给予的参数一样

#### Returns

[`LyricLine`](../interfaces/LyricLine.md)[]

当前歌词数组

#### Defined in

[packages/core/src/lyric-player/index.ts:780](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L780)

___

### limitScrollOffset

▸ `Private` **limitScrollOffset**(): `void`

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:419](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L419)

___

### onLineClickedHandler

▸ `Private` `Readonly` **onLineClickedHandler**(`e`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `e` | `RawLyricLineMouseEvent` |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:114](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L114)

___

### onPageShow

▸ `Private` **onPageShow**(): `void`

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:297](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L297)

___

### rebuildStyle

▸ **rebuildStyle**(): `void`

重建样式

这个只允许内部调用

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:471](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L471)

___

### removeEventListener

▸ **removeEventListener**(`type`, `callback`, `options?`): `void`

Removes the event listener in target's event listener list with the same type, callback, and options.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `callback` | ``null`` \| `EventListenerOrEventListenerObject` |
| `options?` | `boolean` \| `EventListenerOptions` |

#### Returns

`void`

#### Inherited from

EventTarget.removeEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8221

___

### resetScroll

▸ **resetScroll**(): `void`

重置用户滚动状态

请在用户完成滚动点击跳转歌词时调用本事件再调用 `calcLayout` 以正确滚动到目标位置

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:621](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L621)

___

### setAlignAnchor

▸ **setAlignAnchor**(`alignAnchor`): `void`

设置目标歌词行的对齐方式，默认为 `center`

- 设置成 `top` 的话将会向目标歌词行的顶部对齐
- 设置成 `bottom` 的话将会向目标歌词行的底部对齐
- 设置成 `center` 的话将会向目标歌词行的垂直中心对齐

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `alignAnchor` | ``"bottom"`` \| ``"center"`` \| ``"top"`` | 歌词行对齐方式，详情见函数说明 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:806](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L806)

___

### setAlignPosition

▸ **setAlignPosition**(`alignPosition`): `void`

设置默认的歌词行对齐位置，相对于整个歌词播放组件的大小位置，默认为 `0.5`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `alignPosition` | `number` | 一个 `[0.0-1.0]` 之间的任意数字，代表组件高度由上到下的比例位置 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:813](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L813)

___

### setCurrentTime

▸ **setCurrentTime**(`time`, `isSeek?`): `void`

设置当前播放进度，单位为毫秒且**必须是整数**，此时将会更新内部的歌词进度信息
内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好

调用完成后，可以每帧调用 `update` 函数来执行歌词动画效果

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `time` | `number` | `undefined` | 当前播放进度，单位为毫秒 |
| `isSeek` | `boolean` | `false` | - |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:823](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L823)

___

### setEnableBlur

▸ **setEnableBlur**(`enable`): `void`

设置是否启用歌词行的模糊效果

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `enable` | `boolean` | 是否启用 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:496](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L496)

___

### setEnableScale

▸ **setEnableScale**(`enable?`): `void`

是否启用歌词行缩放效果，默认启用

如果启用，非选中的歌词行会轻微缩小以凸显当前播放歌词行效果

此效果对性能影响微乎其微，推荐启用

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `enable` | `boolean` | `true` | 是否启用歌词行缩放效果 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:160](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L160)

___

### setEnableSpring

▸ **setEnableSpring**(`enable?`): `void`

设置是否使用物理弹簧算法实现歌词动画效果，默认启用

如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行

如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `enable` | `boolean` | `true` |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:136](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L136)

___

### setHidePassedLines

▸ **setHidePassedLines**(`hide`): `void`

设置是否隐藏已经播放过的歌词行，默认不隐藏

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `hide` | `boolean` | 是否隐藏已经播放过的歌词行，默认不隐藏 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:488](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L488)

___

### setLinePosXSpringParams

▸ **setLinePosXSpringParams**(`params`): `void`

设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\> | 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:961](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L961)

___

### setLinePosYSpringParams

▸ **setLinePosYSpringParams**(`params`): `void`

设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\> | 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:976](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L976)

___

### setLineScaleSpringParams

▸ **setLineScaleSpringParams**(`params`): `void`

设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\> | 需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:991](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L991)

___

### setLyricLines

▸ **setLyricLines**(`lines`): `void`

设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `lines` | [`LyricLine`](../interfaces/LyricLine.md)[] | 歌词数组 |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:505](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L505)

___

### update

▸ **update**(`delta?`): `void`

更新动画，这个函数应该被逐帧调用或者在以下情况下调用一次：

1. 刚刚调用完设置歌词函数的时候

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `delta` | `number` | `0` | 距离上一次被调用到现在的时长，单位为毫秒（可为浮点数） |

#### Returns

`void`

#### Defined in

[packages/core/src/lyric-player/index.ts:950](https://github.com/Steve-xmh/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L950)
