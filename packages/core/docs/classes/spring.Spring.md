[@applemusic-like-lyrics/core](../README.md) / [Exports](../modules.md) / [spring](../modules/spring.md) / Spring

# Class: Spring

[spring](../modules/spring.md).Spring

## Table of contents

### Constructors

- [constructor](spring.Spring.md#constructor)

### Properties

- [currentPosition](spring.Spring.md#currentposition)
- [currentSolver](spring.Spring.md#currentsolver)
- [currentTime](spring.Spring.md#currenttime)
- [getV](spring.Spring.md#getv)
- [getV2](spring.Spring.md#getv2)
- [params](spring.Spring.md#params)
- [queueParams](spring.Spring.md#queueparams)
- [queuePosition](spring.Spring.md#queueposition)
- [targetPosition](spring.Spring.md#targetposition)

### Methods

- [arrived](spring.Spring.md#arrived)
- [getCurrentPosition](spring.Spring.md#getcurrentposition)
- [resetSolver](spring.Spring.md#resetsolver)
- [setPosition](spring.Spring.md#setposition)
- [setTargetPosition](spring.Spring.md#settargetposition)
- [update](spring.Spring.md#update)
- [updateParams](spring.Spring.md#updateparams)

## Constructors

### constructor

• **new Spring**(`currentPosition?`)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `currentPosition` | `number` | `0` |

#### Defined in

[packages/core/src/utils/spring.ts:30](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L30)

## Properties

### currentPosition

• `Private` **currentPosition**: `number` = `0`

#### Defined in

[packages/core/src/utils/spring.ts:12](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L12)

___

### currentSolver

• `Private` **currentSolver**: (`t`: `number`) => `number`

#### Type declaration

▸ (`t`): `number`

##### Parameters

| Name | Type |
| :------ | :------ |
| `t` | `number` |

##### Returns

`number`

#### Defined in

[packages/core/src/utils/spring.ts:16](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L16)

___

### currentTime

• `Private` **currentTime**: `number` = `0`

#### Defined in

[packages/core/src/utils/spring.ts:14](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L14)

___

### getV

• `Private` **getV**: (`t`: `number`) => `number`

#### Type declaration

▸ (`t`): `number`

##### Parameters

| Name | Type |
| :------ | :------ |
| `t` | `number` |

##### Returns

`number`

#### Defined in

[packages/core/src/utils/spring.ts:17](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L17)

___

### getV2

• `Private` **getV2**: (`t`: `number`) => `number`

#### Type declaration

▸ (`t`): `number`

##### Parameters

| Name | Type |
| :------ | :------ |
| `t` | `number` |

##### Returns

`number`

#### Defined in

[packages/core/src/utils/spring.ts:18](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L18)

___

### params

• `Private` **params**: `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\> = `{}`

#### Defined in

[packages/core/src/utils/spring.ts:15](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L15)

___

### queueParams

• `Private` **queueParams**: `undefined` \| `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\> & { `time`: `number`  }

#### Defined in

[packages/core/src/utils/spring.ts:19](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L19)

___

### queuePosition

• `Private` **queuePosition**: `undefined` \| { `position`: `number` ; `time`: `number`  }

#### Defined in

[packages/core/src/utils/spring.ts:24](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L24)

___

### targetPosition

• `Private` **targetPosition**: `number` = `0`

#### Defined in

[packages/core/src/utils/spring.ts:13](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L13)

## Methods

### arrived

▸ **arrived**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/core/src/utils/spring.ts:50](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L50)

___

### getCurrentPosition

▸ **getCurrentPosition**(): `number`

#### Returns

`number`

#### Defined in

[packages/core/src/utils/spring.ts:116](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L116)

___

### resetSolver

▸ `Private` **resetSolver**(): `void`

#### Returns

`void`

#### Defined in

[packages/core/src/utils/spring.ts:37](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L37)

___

### setPosition

▸ **setPosition**(`targetPosition`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetPosition` | `number` |

#### Returns

`void`

#### Defined in

[packages/core/src/utils/spring.ts:59](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L59)

___

### setTargetPosition

▸ **setTargetPosition**(`targetPosition`, `delay?`): `void`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `targetPosition` | `number` | `undefined` |
| `delay` | `number` | `0` |

#### Returns

`void`

#### Defined in

[packages/core/src/utils/spring.ts:103](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L103)

___

### update

▸ **update**(`delta?`): `void`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `delta` | `number` | `0` |

#### Returns

`void`

#### Defined in

[packages/core/src/utils/spring.ts:66](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L66)

___

### updateParams

▸ **updateParams**(`params`, `delay?`): `void`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `params` | `Partial`<[`SpringParams`](../interfaces/spring.SpringParams.md)\> | `undefined` |
| `delay` | `number` | `0` |

#### Returns

`void`

#### Defined in

[packages/core/src/utils/spring.ts:87](https://github.com/amll-dev/applemusic-like-lyrics/blob/98c389d/packages/core/src/utils/spring.ts#L87)
