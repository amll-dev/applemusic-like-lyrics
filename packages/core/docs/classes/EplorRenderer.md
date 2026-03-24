[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / EplorRenderer

# Class: EplorRenderer

实现了这个接口的东西需要在使用完毕后

手动调用 `dispose` 函数来销毁清除占用资源

以免产生泄露

## Hierarchy

- [`BaseRenderer`](BaseRenderer.md)

  ↳ **`EplorRenderer`**

## Table of contents

### Constructors

- [constructor](EplorRenderer.md#constructor)

### Properties

- [blendProgram](EplorRenderer.md#blendprogram)
- [canvas](EplorRenderer.md#canvas)
- [copyProgram](EplorRenderer.md#copyprogram)
- [currerntRenderScale](EplorRenderer.md#currerntrenderscale)
- [flowSpeed](EplorRenderer.md#flowspeed)
- [gl](EplorRenderer.md#gl)
- [indexBuffer](EplorRenderer.md#indexbuffer)
- [lastTickTime](EplorRenderer.md#lastticktime)
- [mainProgram](EplorRenderer.md#mainprogram)
- [maxFPS](EplorRenderer.md#maxfps)
- [paused](EplorRenderer.md#paused)
- [randomOffset](EplorRenderer.md#randomoffset)
- [reduceImageSizeCanvas](EplorRenderer.md#reduceimagesizecanvas)
- [sprites](EplorRenderer.md#sprites)
- [staticMode](EplorRenderer.md#staticmode)
- [tickHandle](EplorRenderer.md#tickhandle)
- [vertexBuffer](EplorRenderer.md#vertexbuffer)
- [rawIndexBuffer](EplorRenderer.md#rawindexbuffer)
- [rawVertexBuffer](EplorRenderer.md#rawvertexbuffer)

### Methods

- [dispose](EplorRenderer.md#dispose)
- [getElement](EplorRenderer.md#getelement)
- [loadImage](EplorRenderer.md#loadimage)
- [onRedraw](EplorRenderer.md#onredraw)
- [onResize](EplorRenderer.md#onresize)
- [onTick](EplorRenderer.md#ontick)
- [pause](EplorRenderer.md#pause)
- [requestTick](EplorRenderer.md#requesttick)
- [resume](EplorRenderer.md#resume)
- [setAlbumImage](EplorRenderer.md#setalbumimage)
- [setFPS](EplorRenderer.md#setfps)
- [setFlowSpeed](EplorRenderer.md#setflowspeed)
- [setRenderScale](EplorRenderer.md#setrenderscale)
- [setStaticMode](EplorRenderer.md#setstaticmode)
- [setupGL](EplorRenderer.md#setupgl)

## Constructors

### constructor

• **new EplorRenderer**(`canvas`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `canvas` | `HTMLCanvasElement` |

#### Overrides

[BaseRenderer](BaseRenderer.md).[constructor](BaseRenderer.md#constructor)

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:410](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L410)

## Properties

### blendProgram

• `Private` **blendProgram**: `GLProgram`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:353](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L353)

___

### canvas

• `Protected` **canvas**: `HTMLCanvasElement`

#### Inherited from

[BaseRenderer](BaseRenderer.md).[canvas](BaseRenderer.md#canvas)

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:410](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L410)

___

### copyProgram

• `Private` **copyProgram**: `GLProgram`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:358](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L358)

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

### gl

• `Private` **gl**: `WebGLRenderingContext`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:329](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L329)

___

### indexBuffer

• `Private` **indexBuffer**: `GLBuffer`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:377](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L377)

___

### lastTickTime

• `Private` **lastTickTime**: `number` = `0`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:325](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L325)

___

### mainProgram

• `Private` **mainProgram**: `GLProgram`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:348](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L348)

___

### maxFPS

• `Private` **maxFPS**: `number` = `30`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:324](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L324)

___

### paused

• `Private` **paused**: `boolean` = `false`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:327](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L327)

___

### randomOffset

• `Private` **randomOffset**: `number`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:326](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L326)

___

### reduceImageSizeCanvas

• `Private` **reduceImageSizeCanvas**: `OffscreenCanvas`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:330](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L330)

___

### sprites

• `Private` **sprites**: `AlbumTexture`[] = `[]`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:332](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L332)

___

### staticMode

• `Private` **staticMode**: `boolean` = `false`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:328](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L328)

___

### tickHandle

• `Private` **tickHandle**: `number` = `0`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:331](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L331)

___

### vertexBuffer

• `Private` **vertexBuffer**: `GLBuffer`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:370](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L370)

___

### rawIndexBuffer

▪ `Static` `Private` `Readonly` **rawIndexBuffer**: `Uint16Array`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:368](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L368)

___

### rawVertexBuffer

▪ `Static` `Private` `Readonly` **rawVertexBuffer**: `Float32Array`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:364](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L364)

## Methods

### dispose

▸ **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Inherited from

[BaseRenderer](BaseRenderer.md).[dispose](BaseRenderer.md#dispose)

#### Defined in

[packages/core/src/bg-render/base.ts:110](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L110)

___

### getElement

▸ **getElement**(): `HTMLElement`

获取这个类所对应的 HTML 元素实例

#### Returns

`HTMLElement`

#### Overrides

[BaseRenderer](BaseRenderer.md).[getElement](BaseRenderer.md#getelement)

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:508](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L508)

___

### loadImage

▸ `Private` **loadImage**(`imageUrl`): `Promise`<`HTMLImageElement`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `imageUrl` | `string` |

#### Returns

`Promise`<`HTMLImageElement`\>

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:449](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L449)

___

### onRedraw

▸ `Private` **onRedraw**(`tickTime`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tickTime` | `number` |

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:401](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L401)

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

[packages/core/src/bg-render/eplor-renderer.ts:384](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L384)

___

### onTick

▸ `Private` **onTick**(`tickTime`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tickTime` | `number` |

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:333](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L333)

___

### pause

▸ **pause**(): `void`

暂停背景动画，画面即便是更新了图片也不会发生变化

#### Returns

`void`

#### Overrides

[BaseRenderer](BaseRenderer.md).[pause](BaseRenderer.md#pause)

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:438](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L438)

___

### requestTick

▸ `Private` **requestTick**(): `void`

#### Returns

`void`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:396](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L396)

___

### resume

▸ **resume**(): `void`

恢复播放背景动画

#### Returns

`void`

#### Overrides

[BaseRenderer](BaseRenderer.md).[resume](BaseRenderer.md#resume)

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:445](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L445)

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

[packages/core/src/bg-render/eplor-renderer.ts:458](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L458)

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

[packages/core/src/bg-render/eplor-renderer.ts:435](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L435)

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

#### Inherited from

[BaseRenderer](BaseRenderer.md).[setRenderScale](BaseRenderer.md#setrenderscale)

#### Defined in

[packages/core/src/bg-render/base.ts:59](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/base.ts#L59)

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

#### Overrides

[BaseRenderer](BaseRenderer.md).[setStaticMode](BaseRenderer.md#setstaticmode)

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:432](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L432)

___

### setupGL

▸ `Private` **setupGL**(): `WebGL2RenderingContext`

#### Returns

`WebGL2RenderingContext`

#### Defined in

[packages/core/src/bg-render/eplor-renderer.ts:421](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/bg-render/eplor-renderer.ts#L421)
