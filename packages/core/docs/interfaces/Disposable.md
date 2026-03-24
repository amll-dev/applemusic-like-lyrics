[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / Disposable

# Interface: Disposable

实现了这个接口的东西需要在使用完毕后

手动调用 `dispose` 函数来销毁清除占用资源

以免产生泄露

## Implemented by

- [`AbstractBaseRenderer`](../classes/AbstractBaseRenderer.md)
- [`LyricPlayer`](../classes/LyricPlayer.md)

## Table of contents

### Methods

- [dispose](Disposable.md#dispose)

## Methods

### dispose

▸ **dispose**(): `void`

销毁实现了该接口的对象实例，释放占用的资源

一般情况下，调用本函数后就不可以再调用对象的任何函数了

#### Returns

`void`

#### Defined in

[packages/core/src/interfaces.ts:24](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/interfaces.ts#L24)
