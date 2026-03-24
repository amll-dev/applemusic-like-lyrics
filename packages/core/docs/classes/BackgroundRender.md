[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / BackgroundRender

# Class: BackgroundRender<Renderer\>

实现了这个接口的东西需要在使用完毕后

手动调用 `dispose` 函数来销毁清除占用资源

以免产生泄露

## Type parameters

| Name | Type |
| :------ | :------ |
| `Renderer` | extends [`BaseRenderer`](BaseRenderer.md) |

## Implements

- [`AbstractBaseRenderer`](AbstractBaseRenderer.md)

## Table of contents

### Constructors

- [constructor](BackgroundRender.md#constructor)

### Properties

- [element](BackgroundRender.md#element)
- [renderer](BackgroundRender.md#renderer)

### Methods

- [dispose](BackgroundRender.md#dispose)
- [getElement](BackgroundRender.md#getelement)
- [pause](BackgroundRender.md#pause)
- [resume](BackgroundRender.md#resume)
- [setAlbumImage](BackgroundRender.md#setalbumimage)
- [setFPS](BackgroundRender.md#setfps)
- [setFlowSpeed](BackgroundRender.md#setflowspeed)
- [setRenderScale](BackgroundRender.md#setrenderscale)
- [setStaticMode](BackgroundRender.md#setstaticmode)
- [new](BackgroundRender.md#new)

## Constructors

### constructor

• **new BackgroundRender**<`Renderer`\>(`renderer`, `canvas`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Renderer` | extends [`BaseRenderer`](BaseRenderer.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `renderer` | `Renderer` |
| `canvas` | `HTMLCanvasElement` |

#### Defined in

[packages/core/src/bg-render/index.ts:17](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L17)

## Properties

### element

• `Private` **element**: `HTMLCanvasElement`

#### Defined in

[packages/core/src/bg-render/index.ts:15](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L15)

___

### renderer

• `Private` **renderer**: `Renderer`

#### Defined in

[packages/core/src/bg-render/index.ts:16](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L16)

## Methods

### dispose

▸ **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[dispose](AbstractBaseRenderer.md#dispose)

#### Defined in

[packages/core/src/bg-render/index.ts:58](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L58)

___

### getElement

▸ **getElement**(): `HTMLCanvasElement`

获取这个类所对应的 HTML 元素实例

#### Returns

`HTMLCanvasElement`

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[getElement](AbstractBaseRenderer.md#getelement)

#### Defined in

[packages/core/src/bg-render/index.ts:55](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L55)

___

### pause

▸ **pause**(): `void`

暂停背景动画，画面即便是更新了图片也不会发生变化

#### Returns

`void`

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[pause](AbstractBaseRenderer.md#pause)

#### Defined in

[packages/core/src/bg-render/index.ts:46](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L46)

___

### resume

▸ **resume**(): `void`

恢复播放背景动画

#### Returns

`void`

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[resume](AbstractBaseRenderer.md#resume)

#### Defined in

[packages/core/src/bg-render/index.ts:49](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L49)

___

### setAlbumImage

▸ **setAlbumImage**(`albumUrl`): `Promise`<`void`\>

设置背景专辑图片，图片材质加载并设置完成后会返回

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `albumUrl` | `string` | 图片的目标链接 |

#### Returns

`Promise`<`void`\>

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setAlbumImage](AbstractBaseRenderer.md#setalbumimage)

#### Defined in

[packages/core/src/bg-render/index.ts:52](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L52)

___

### setFPS

▸ **setFPS**(`fps`): `void`

修改背景动画帧率，默认是 30 FPS

如果设置成 0 则会停止动画

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `fps` | `number` | 目标帧率，默认 30 FPS |

#### Returns

`void`

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setFPS](AbstractBaseRenderer.md#setfps)

#### Defined in

[packages/core/src/bg-render/index.ts:43](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L43)

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

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setFlowSpeed](AbstractBaseRenderer.md#setflowspeed)

#### Defined in

[packages/core/src/bg-render/index.ts:37](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L37)

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

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setRenderScale](AbstractBaseRenderer.md#setrenderscale)

#### Defined in

[packages/core/src/bg-render/index.ts:33](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L33)

___

### setStaticMode

▸ **setStaticMode**(`enable`): `void`

是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `enable` | `boolean` | 是否启用静态模式 |

#### Returns

`void`

#### Implementation of

[AbstractBaseRenderer](AbstractBaseRenderer.md).[setStaticMode](AbstractBaseRenderer.md#setstaticmode)

#### Defined in

[packages/core/src/bg-render/index.ts:40](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L40)

___

### new

▸ `Static` **new**<`Renderer`\>(`type`): [`BackgroundRender`](BackgroundRender.md)<`Renderer`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Renderer` | extends [`BaseRenderer`](BaseRenderer.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | (`canvas`: `HTMLCanvasElement`) => `Renderer` |

#### Returns

[`BackgroundRender`](BackgroundRender.md)<`Renderer`\>

#### Defined in

[packages/core/src/bg-render/index.ts:26](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/index.ts#L26)
