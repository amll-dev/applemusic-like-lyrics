[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / LyricLineMouseEvent

# Class: LyricLineMouseEvent

歌词行鼠标相关事件，可以获取到歌词行的索引和歌词行元素

## Hierarchy

- `MouseEvent`

  ↳ **`LyricLineMouseEvent`**

## Table of contents

### Constructors

- [constructor](LyricLineMouseEvent.md#constructor)

### Properties

- [AT\_TARGET](LyricLineMouseEvent.md#at_target)
- [BUBBLING\_PHASE](LyricLineMouseEvent.md#bubbling_phase)
- [CAPTURING\_PHASE](LyricLineMouseEvent.md#capturing_phase)
- [NONE](LyricLineMouseEvent.md#none)
- [altKey](LyricLineMouseEvent.md#altkey)
- [bubbles](LyricLineMouseEvent.md#bubbles)
- [button](LyricLineMouseEvent.md#button)
- [buttons](LyricLineMouseEvent.md#buttons)
- [cancelBubble](LyricLineMouseEvent.md#cancelbubble)
- [cancelable](LyricLineMouseEvent.md#cancelable)
- [clientX](LyricLineMouseEvent.md#clientx)
- [clientY](LyricLineMouseEvent.md#clienty)
- [composed](LyricLineMouseEvent.md#composed)
- [ctrlKey](LyricLineMouseEvent.md#ctrlkey)
- [currentTarget](LyricLineMouseEvent.md#currenttarget)
- [defaultPrevented](LyricLineMouseEvent.md#defaultprevented)
- [detail](LyricLineMouseEvent.md#detail)
- [eventPhase](LyricLineMouseEvent.md#eventphase)
- [isTrusted](LyricLineMouseEvent.md#istrusted)
- [line](LyricLineMouseEvent.md#line)
- [lineIndex](LyricLineMouseEvent.md#lineindex)
- [metaKey](LyricLineMouseEvent.md#metakey)
- [movementX](LyricLineMouseEvent.md#movementx)
- [movementY](LyricLineMouseEvent.md#movementy)
- [offsetX](LyricLineMouseEvent.md#offsetx)
- [offsetY](LyricLineMouseEvent.md#offsety)
- [pageX](LyricLineMouseEvent.md#pagex)
- [pageY](LyricLineMouseEvent.md#pagey)
- [relatedTarget](LyricLineMouseEvent.md#relatedtarget)
- [returnValue](LyricLineMouseEvent.md#returnvalue)
- [screenX](LyricLineMouseEvent.md#screenx)
- [screenY](LyricLineMouseEvent.md#screeny)
- [shiftKey](LyricLineMouseEvent.md#shiftkey)
- [srcElement](LyricLineMouseEvent.md#srcelement)
- [target](LyricLineMouseEvent.md#target)
- [timeStamp](LyricLineMouseEvent.md#timestamp)
- [type](LyricLineMouseEvent.md#type)
- [view](LyricLineMouseEvent.md#view)
- [which](LyricLineMouseEvent.md#which)
- [x](LyricLineMouseEvent.md#x)
- [y](LyricLineMouseEvent.md#y)

### Methods

- [composedPath](LyricLineMouseEvent.md#composedpath)
- [getModifierState](LyricLineMouseEvent.md#getmodifierstate)
- [initEvent](LyricLineMouseEvent.md#initevent)
- [initMouseEvent](LyricLineMouseEvent.md#initmouseevent)
- [initUIEvent](LyricLineMouseEvent.md#inituievent)
- [preventDefault](LyricLineMouseEvent.md#preventdefault)
- [stopImmediatePropagation](LyricLineMouseEvent.md#stopimmediatepropagation)
- [stopPropagation](LyricLineMouseEvent.md#stoppropagation)

## Constructors

### constructor

• **new LyricLineMouseEvent**(`lineIndex`, `line`, `event`)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `lineIndex` | `number` | 歌词行索引 |
| `line` | `LyricLineEl` | 歌词行元素 |
| `event` | `MouseEvent` | - |

#### Overrides

MouseEvent.constructor

#### Defined in

[packages/core/src/lyric-player/index.ts:26](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L26)

## Properties

### AT\_TARGET

• `Readonly` **AT\_TARGET**: ``2``

#### Inherited from

MouseEvent.AT\_TARGET

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8098

___

### BUBBLING\_PHASE

• `Readonly` **BUBBLING\_PHASE**: ``3``

#### Inherited from

MouseEvent.BUBBLING\_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8099

___

### CAPTURING\_PHASE

• `Readonly` **CAPTURING\_PHASE**: ``1``

#### Inherited from

MouseEvent.CAPTURING\_PHASE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8097

___

### NONE

• `Readonly` **NONE**: ``0``

#### Inherited from

MouseEvent.NONE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8096

___

### altKey

• `Readonly` **altKey**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/altKey)

#### Inherited from

MouseEvent.altKey

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15587

___

### bubbles

• `Readonly` **bubbles**: `boolean`

Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)

#### Inherited from

MouseEvent.bubbles

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7993

___

### button

• `Readonly` **button**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/button)

#### Inherited from

MouseEvent.button

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15589

___

### buttons

• `Readonly` **buttons**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/buttons)

#### Inherited from

MouseEvent.buttons

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15591

___

### cancelBubble

• **cancelBubble**: `boolean`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)

#### Inherited from

MouseEvent.cancelBubble

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7999

___

### cancelable

• `Readonly` **cancelable**: `boolean`

Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)

#### Inherited from

MouseEvent.cancelable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8005

___

### clientX

• `Readonly` **clientX**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/clientX)

#### Inherited from

MouseEvent.clientX

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15593

___

### clientY

• `Readonly` **clientY**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/clientY)

#### Inherited from

MouseEvent.clientY

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15595

___

### composed

• `Readonly` **composed**: `boolean`

Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)

#### Inherited from

MouseEvent.composed

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8011

___

### ctrlKey

• `Readonly` **ctrlKey**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/ctrlKey)

#### Inherited from

MouseEvent.ctrlKey

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15597

___

### currentTarget

• `Readonly` **currentTarget**: ``null`` \| `EventTarget`

Returns the object whose event listener's callback is currently being invoked.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)

#### Inherited from

MouseEvent.currentTarget

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8017

___

### defaultPrevented

• `Readonly` **defaultPrevented**: `boolean`

Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)

#### Inherited from

MouseEvent.defaultPrevented

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8023

___

### detail

• `Readonly` **detail**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/UIEvent/detail)

#### Inherited from

MouseEvent.detail

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:22501

___

### eventPhase

• `Readonly` **eventPhase**: `number`

Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)

#### Inherited from

MouseEvent.eventPhase

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8029

___

### isTrusted

• `Readonly` **isTrusted**: `boolean`

Returns true if event was dispatched by the user agent, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)

#### Inherited from

MouseEvent.isTrusted

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8035

___

### line

• `Readonly` **line**: `LyricLineEl`

歌词行元素

#### Defined in

[packages/core/src/lyric-player/index.ts:34](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L34)

___

### lineIndex

• `Readonly` **lineIndex**: `number`

歌词行索引

#### Defined in

[packages/core/src/lyric-player/index.ts:30](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/lyric-player/index.ts#L30)

___

### metaKey

• `Readonly` **metaKey**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/metaKey)

#### Inherited from

MouseEvent.metaKey

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15599

___

### movementX

• `Readonly` **movementX**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/movementX)

#### Inherited from

MouseEvent.movementX

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15601

___

### movementY

• `Readonly` **movementY**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/movementY)

#### Inherited from

MouseEvent.movementY

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15603

___

### offsetX

• `Readonly` **offsetX**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/offsetX)

#### Inherited from

MouseEvent.offsetX

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15605

___

### offsetY

• `Readonly` **offsetY**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/offsetY)

#### Inherited from

MouseEvent.offsetY

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15607

___

### pageX

• `Readonly` **pageX**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/pageX)

#### Inherited from

MouseEvent.pageX

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15609

___

### pageY

• `Readonly` **pageY**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/pageY)

#### Inherited from

MouseEvent.pageY

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15611

___

### relatedTarget

• `Readonly` **relatedTarget**: ``null`` \| `EventTarget`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/relatedTarget)

#### Inherited from

MouseEvent.relatedTarget

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15613

___

### returnValue

• **returnValue**: `boolean`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)

#### Inherited from

MouseEvent.returnValue

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8041

___

### screenX

• `Readonly` **screenX**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/screenX)

#### Inherited from

MouseEvent.screenX

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15615

___

### screenY

• `Readonly` **screenY**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/screenY)

#### Inherited from

MouseEvent.screenY

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15617

___

### shiftKey

• `Readonly` **shiftKey**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/shiftKey)

#### Inherited from

MouseEvent.shiftKey

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15619

___

### srcElement

• `Readonly` **srcElement**: ``null`` \| `EventTarget`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)

#### Inherited from

MouseEvent.srcElement

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8047

___

### target

• `Readonly` **target**: ``null`` \| `EventTarget`

Returns the object to which event is dispatched (its target).

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)

#### Inherited from

MouseEvent.target

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8053

___

### timeStamp

• `Readonly` **timeStamp**: `number`

Returns the event's timestamp as the number of milliseconds measured relative to the time origin.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)

#### Inherited from

MouseEvent.timeStamp

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8059

___

### type

• `Readonly` **type**: `string`

Returns the type of event, e.g. "click", "hashchange", or "submit".

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)

#### Inherited from

MouseEvent.type

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8065

___

### view

• `Readonly` **view**: ``null`` \| `Window`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/UIEvent/view)

#### Inherited from

MouseEvent.view

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:22503

___

### which

• `Readonly` **which**: `number`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/UIEvent/which)

#### Inherited from

MouseEvent.which

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:22509

___

### x

• `Readonly` **x**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/x)

#### Inherited from

MouseEvent.x

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15621

___

### y

• `Readonly` **y**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/y)

#### Inherited from

MouseEvent.y

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15623

## Methods

### composedPath

▸ **composedPath**(): `EventTarget`[]

Returns the invocation target objects of event's path (objects on which listeners will be invoked), except for any nodes in shadow trees of which the shadow root's mode is "closed" that are not reachable from event's currentTarget.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)

#### Returns

`EventTarget`[]

#### Inherited from

MouseEvent.composedPath

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8071

___

### getModifierState

▸ **getModifierState**(`keyArg`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/getModifierState)

#### Parameters

| Name | Type |
| :------ | :------ |
| `keyArg` | `string` |

#### Returns

`boolean`

#### Inherited from

MouseEvent.getModifierState

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15625

___

### initEvent

▸ **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `bubbles?` | `boolean` |
| `cancelable?` | `boolean` |

#### Returns

`void`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

#### Inherited from

MouseEvent.initEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8077

___

### initMouseEvent

▸ **initMouseEvent**(`typeArg`, `canBubbleArg`, `cancelableArg`, `viewArg`, `detailArg`, `screenXArg`, `screenYArg`, `clientXArg`, `clientYArg`, `ctrlKeyArg`, `altKeyArg`, `shiftKeyArg`, `metaKeyArg`, `buttonArg`, `relatedTargetArg`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `typeArg` | `string` |
| `canBubbleArg` | `boolean` |
| `cancelableArg` | `boolean` |
| `viewArg` | `Window` |
| `detailArg` | `number` |
| `screenXArg` | `number` |
| `screenYArg` | `number` |
| `clientXArg` | `number` |
| `clientYArg` | `number` |
| `ctrlKeyArg` | `boolean` |
| `altKeyArg` | `boolean` |
| `shiftKeyArg` | `boolean` |
| `metaKeyArg` | `boolean` |
| `buttonArg` | `number` |
| `relatedTargetArg` | ``null`` \| `EventTarget` |

#### Returns

`void`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/MouseEvent/initMouseEvent)

#### Inherited from

MouseEvent.initMouseEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:15631

___

### initUIEvent

▸ **initUIEvent**(`typeArg`, `bubblesArg?`, `cancelableArg?`, `viewArg?`, `detailArg?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `typeArg` | `string` |
| `bubblesArg?` | `boolean` |
| `cancelableArg?` | `boolean` |
| `viewArg?` | ``null`` \| `Window` |
| `detailArg?` | `number` |

#### Returns

`void`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/UIEvent/initUIEvent)

#### Inherited from

MouseEvent.initUIEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:22515

___

### preventDefault

▸ **preventDefault**(): `void`

If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

#### Returns

`void`

#### Inherited from

MouseEvent.preventDefault

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8083

___

### stopImmediatePropagation

▸ **stopImmediatePropagation**(): `void`

Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

#### Returns

`void`

#### Inherited from

MouseEvent.stopImmediatePropagation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8089

___

### stopPropagation

▸ **stopPropagation**(): `void`

When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

#### Returns

`void`

#### Inherited from

MouseEvent.stopPropagation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8095
