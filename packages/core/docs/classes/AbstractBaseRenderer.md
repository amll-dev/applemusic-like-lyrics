[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / AbstractBaseRenderer

# Class: AbstractBaseRenderer

实现了这个接口的东西需要在使用完毕后

手动调用 `dispose` 函数来销毁清除占用资源

以免产生泄露

## Hierarchy

- **`AbstractBaseRenderer`**

  ↳ [`BaseRenderer`](BaseRenderer.md)

## Implements

- [`Disposable`](../interfaces/Disposable.md)
- [`HasElement`](../interfaces/HasElement.md)

## Implemented by

- [`BackgroundRender`](BackgroundRender.md)

## Table of contents

### Constructors

- [constructor](AbstractBaseRenderer.md#constructor)

### Methods

- [dispose](AbstractBaseRenderer.md#dispose)
- [getElement](AbstractBaseRenderer.md#getelement)
- [pause](AbstractBaseRenderer.md#pause)
- [resume](AbstractBaseRenderer.md#resume)
- [setAlbumImage](AbstractBaseRenderer.md#setalbumimage)
- [setFPS](AbstractBaseRenderer.md#setfps)
- [setFlowSpeed](AbstractBaseRenderer.md#setflowspeed)
- [setRenderScale](AbstractBaseRenderer.md#setrenderscale)
- [setStaticMode](AbstractBaseRenderer.md#setstaticmode)

## Constructors

### constructor

• **new AbstractBaseRenderer**()

## Methods

### dispose

▸ `Abstract` **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Implementation of

[Disposable](../interfaces/Disposable.md).[dispose](../interfaces/Disposable.md#dispose)

#### Defined in

[packages/core/src/bg-render/base.ts:41](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L41)

___

### getElement

▸ `Abstract` **getElement**(): `HTMLElement`

获取这个类所对应的 HTML 元素实例

#### Returns

`HTMLElement`

#### Implementation of

[HasElement](../interfaces/HasElement.md).[getElement](../interfaces/HasElement.md#getelement)

#### Defined in

[packages/core/src/bg-render/base.ts:42](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L42)

___

### pause

▸ `Abstract` **pause**(): `void`

暂停背景动画，画面即便是更新了图片也不会发生变化

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/base.ts:31](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L31)

___

### resume

▸ `Abstract` **resume**(): `void`

恢复播放背景动画

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/base.ts:35](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L35)

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

#### Defined in

[packages/core/src/bg-render/base.ts:40](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L40)

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

#### Defined in

[packages/core/src/bg-render/base.ts:27](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L27)

___

### setFlowSpeed

▸ `Abstract` **setFlowSpeed**(`speed`): `void`

修改背景的流动速度，数字越大越快，默认为 8

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `speed` | `number` | 背景的流动速度，默认为 8 |

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/base.ts:8](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L8)

___

### setRenderScale

▸ `Abstract` **setRenderScale**(`scale`): `void`

修改背景的渲染比例，默认是 0.5

一般情况下这个程度既没有明显瑕疵也不会特别吃性能

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `scale` | `number` | 背景的渲染比例 |

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/base.ts:15](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L15)

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

#### Defined in

[packages/core/src/bg-render/base.ts:20](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L20)
