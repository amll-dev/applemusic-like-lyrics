[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / PixiRenderer

# Class: PixiRenderer

实现了这个接口的东西需要在使用完毕后

手动调用 `dispose` 函数来销毁清除占用资源

以免产生泄露

## Hierarchy

- [`BaseRenderer`](BaseRenderer.md)

  ↳ **`PixiRenderer`**

## Table of contents

### Constructors

- [constructor](PixiRenderer.md#constructor)

### Properties

- [app](PixiRenderer.md#app)
- [canvas](PixiRenderer.md#canvas)
- [curContainer](PixiRenderer.md#curcontainer)
- [currerntRenderScale](PixiRenderer.md#currerntrenderscale)
- [flowSpeed](PixiRenderer.md#flowspeed)
- [lastContainer](PixiRenderer.md#lastcontainer)
- [staticMode](PixiRenderer.md#staticmode)

### Methods

- [dispose](PixiRenderer.md#dispose)
- [getElement](PixiRenderer.md#getelement)
- [onResize](PixiRenderer.md#onresize)
- [onTick](PixiRenderer.md#ontick)
- [pause](PixiRenderer.md#pause)
- [rebuildFilters](PixiRenderer.md#rebuildfilters)
- [resume](PixiRenderer.md#resume)
- [setAlbumImage](PixiRenderer.md#setalbumimage)
- [setFPS](PixiRenderer.md#setfps)
- [setFlowSpeed](PixiRenderer.md#setflowspeed)
- [setRenderScale](PixiRenderer.md#setrenderscale)
- [setStaticMode](PixiRenderer.md#setstaticmode)

## Constructors

### constructor

• **new PixiRenderer**(`canvas`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `canvas` | `HTMLCanvasElement` |

#### Overrides

[BaseRenderer](BaseRenderer.md).[constructor](BaseRenderer.md#constructor)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:86](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L86)

## Properties

### app

• `Private` **app**: `Application`<`ICanvas`\>

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:15](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L15)

___

### canvas

• `Protected` **canvas**: `HTMLCanvasElement`

#### Inherited from

[BaseRenderer](BaseRenderer.md).[canvas](BaseRenderer.md#canvas)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:86](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L86)

___

### curContainer

• `Private` `Optional` **curContainer**: `TimedContainer`

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:16](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L16)

___

### currerntRenderScale

• `Protected` **currerntRenderScale**: `number` = `0.75`

#### Inherited from

[BaseRenderer](BaseRenderer.md).[currerntRenderScale](BaseRenderer.md#currerntrenderscale)

#### Defined in

[packages/core/src/bg-render/base.ts:48](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L48)

___

### flowSpeed

• `Protected` **flowSpeed**: `number` = `2`

#### Inherited from

[BaseRenderer](BaseRenderer.md).[flowSpeed](BaseRenderer.md#flowspeed)

#### Defined in

[packages/core/src/bg-render/base.ts:47](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L47)

___

### lastContainer

• `Private` **lastContainer**: `Set`<`TimedContainer`\>

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:18](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L18)

___

### staticMode

• `Private` **staticMode**: `boolean` = `false`

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:17](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L17)

## Methods

### dispose

▸ **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Overrides

[BaseRenderer](BaseRenderer.md).[dispose](BaseRenderer.md#dispose)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:233](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L233)

___

### getElement

▸ **getElement**(): `HTMLElement`

获取这个类所对应的 HTML 元素实例

#### Returns

`HTMLElement`

#### Overrides

[BaseRenderer](BaseRenderer.md).[getElement](BaseRenderer.md#getelement)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:239](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L239)

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

#### Overrides

[BaseRenderer](BaseRenderer.md).[onResize](BaseRenderer.md#onresize)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:100](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L100)

___

### onTick

▸ `Private` **onTick**(`delta`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `delta` | `number` |

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:19](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L19)

___

### pause

▸ **pause**(): `void`

暂停背景动画，画面即便是更新了图片也不会发生变化

#### Returns

`void`

#### Overrides

[BaseRenderer](BaseRenderer.md).[pause](BaseRenderer.md#pause)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:176](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L176)

___

### rebuildFilters

▸ `Private` **rebuildFilters**(): `void`

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:110](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L110)

___

### resume

▸ **resume**(): `void`

恢复播放背景动画

#### Returns

`void`

#### Overrides

[BaseRenderer](BaseRenderer.md).[resume](BaseRenderer.md#resume)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:181](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L181)

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

#### Overrides

[BaseRenderer](BaseRenderer.md).[setAlbumImage](BaseRenderer.md#setalbumimage)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:185](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L185)

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

#### Overrides

[BaseRenderer](BaseRenderer.md).[setFPS](BaseRenderer.md#setfps)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:172](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L172)

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

#### Inherited from

[BaseRenderer](BaseRenderer.md).[setFlowSpeed](BaseRenderer.md#setflowspeed)

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

[BaseRenderer](BaseRenderer.md).[setRenderScale](BaseRenderer.md#setrenderscale)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:106](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L106)

___

### setStaticMode

▸ **setStaticMode**(`enable?`): `void`

是否启用静态模式，即图片在更换后就会保持静止状态并禁用更新，以节省性能

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `enable` | `boolean` | `false` | 是否启用静态模式 |

#### Returns

`void`

#### Overrides

[BaseRenderer](BaseRenderer.md).[setStaticMode](BaseRenderer.md#setstaticmode)

#### Defined in

[packages/core/src/bg-render/pixi-renderer.ts:167](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/pixi-renderer.ts#L167)
