[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / BaseRenderer

# Class: BaseRenderer

实现了这个接口的东西需要在使用完毕后

手动调用 `dispose` 函数来销毁清除占用资源

以免产生泄露

## Hierarchy

- [`AbstractBaseRenderer`](AbstractBaseRenderer.md)

  ↳ **`BaseRenderer`**

  ↳↳ [`PixiRenderer`](PixiRenderer.md)

  ↳↳ [`EplorRenderer`](EplorRenderer.md)

## Table of contents

### Constructors

- [constructor](BaseRenderer.md#constructor)

### Properties

- [canvas](BaseRenderer.md#canvas)
- [currerntRenderScale](BaseRenderer.md#currerntrenderscale)
- [flowSpeed](BaseRenderer.md#flowspeed)
- [observer](BaseRenderer.md#observer)

### Methods

- [dispose](BaseRenderer.md#dispose)
- [getElement](BaseRenderer.md#getelement)
- [onResize](BaseRenderer.md#onresize)
- [pause](BaseRenderer.md#pause)
- [resume](BaseRenderer.md#resume)
- [setAlbumImage](BaseRenderer.md#setalbumimage)
- [setFPS](BaseRenderer.md#setfps)
- [setFlowSpeed](BaseRenderer.md#setflowspeed)
- [setRenderScale](BaseRenderer.md#setrenderscale)
- [setStaticMode](BaseRenderer.md#setstaticmode)

## Constructors

### constructor

• **new BaseRenderer**(`canvas`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `canvas` | `HTMLCanvasElement` |

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[constructor](AbstractBaseRenderer.md#constructor)

#### Defined in

[packages/core/src/bg-render/base.ts:49](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L49)

## Properties

### canvas

• `Protected` **canvas**: `HTMLCanvasElement`

#### Defined in

[packages/core/src/bg-render/base.ts:49](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L49)

___

### currerntRenderScale

• `Protected` **currerntRenderScale**: `number` = `0.75`

#### Defined in

[packages/core/src/bg-render/base.ts:48](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L48)

___

### flowSpeed

• `Protected` **flowSpeed**: `number` = `2`

#### Defined in

[packages/core/src/bg-render/base.ts:47](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L47)

___

### observer

• `Private` **observer**: `ResizeObserver`

#### Defined in

[packages/core/src/bg-render/base.ts:46](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L46)

## Methods

### dispose

▸ **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[dispose](AbstractBaseRenderer.md#dispose)

#### Defined in

[packages/core/src/bg-render/base.ts:110](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L110)

___

### getElement

▸ `Abstract` **getElement**(): `HTMLElement`

获取这个类所对应的 HTML 元素实例

#### Returns

`HTMLElement`

#### Inherited from

[AbstractBaseRenderer](AbstractBaseRenderer.md).[getElement](AbstractBaseRenderer.md#getelement)

#### Defined in

[packages/core/src/bg-render/base.ts:42](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L42)

___

### onResize

▸ `Protected` **onResize**(`width`, `height`): `void`

当画板元素大小发生变化时此函数会被调用
可以在此处重设和渲染器相关的尺寸设置
考虑到初始化的时候元素不一定在文档中或出于某些特殊样式状态，尺寸长宽有可能会为 0，请注意进行特判处理

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `width` | `number` | 画板元素实际的物理像素宽度，有可能为 0 |
| `height` | `number` | 画板元素实际的物理像素高度，有可能为 0 |

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/base.ts:74](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L74)

___

### pause

▸ `Abstract` **pause**(): `void`

暂停背景动画，画面即便是更新了图片也不会发生变化

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[pause](AbstractBaseRenderer.md#pause)

#### Defined in

[packages/core/src/bg-render/base.ts:100](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L100)

___

### resume

▸ `Abstract` **resume**(): `void`

恢复播放背景动画

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[resume](AbstractBaseRenderer.md#resume)

#### Defined in

[packages/core/src/bg-render/base.ts:104](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L104)

___

### setAlbumImage

▸ `Abstract` **setAlbumImage**(`albumUrl`): `Promise`<`void`\>

设置背景专辑图片，图片材质加载并设置完成后会返回

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `albumUrl` | `string` | 图片的目标链接 |

#### Returns

`Promise`<`void`\>

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setAlbumImage](AbstractBaseRenderer.md#setalbumimage)

#### Defined in

[packages/core/src/bg-render/base.ts:109](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L109)

___

### setFPS

▸ `Abstract` **setFPS**(`fps`): `void`

修改背景动画帧率，默认是 30 FPS

如果设置成 0 则会停止动画

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `fps` | `number` | 目标帧率，默认 30 FPS |

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setFPS](AbstractBaseRenderer.md#setfps)

#### Defined in

[packages/core/src/bg-render/base.ts:96](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L96)

___

### setFlowSpeed

▸ **setFlowSpeed**(`speed`): `void`

修改背景的流动速度，数字越大越快，默认为 8

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `speed` | `number` | 背景的流动速度，默认为 8 |

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setFlowSpeed](AbstractBaseRenderer.md#setflowspeed)

#### Defined in

[packages/core/src/bg-render/base.ts:82](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L82)

___

### setRenderScale

▸ **setRenderScale**(`scale`): `void`

修改背景的渲染比例，默认是 0.5

一般情况下这个程度既没有明显瑕疵也不会特别吃性能

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `scale` | `number` | 背景的渲染比例 |

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setRenderScale](AbstractBaseRenderer.md#setrenderscale)

#### Defined in

[packages/core/src/bg-render/base.ts:59](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L59)

___

### setStaticMode

▸ `Abstract` **setStaticMode**(`enable`): `void`

是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `enable` | `boolean` | 是否启用静态模式 |

#### Returns

`void`

#### Overrides

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setStaticMode](AbstractBaseRenderer.md#setstaticmode)

#### Defined in

[packages/core/src/bg-render/base.ts:89](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L89)
