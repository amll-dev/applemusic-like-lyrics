[@applemusic-like-lyrics/react](../README.md) / [Exports](../modules.md) / LyricPlayerProps

# Interface: LyricPlayerProps

歌词播放组件的属性

## Table of contents

### Properties

- [alignAnchor](LyricPlayerProps.md#alignanchor)
- [currentTime](LyricPlayerProps.md#currenttime)
- [enable](LyricPlayerProps.md#enable)
- [enableBlur](LyricPlayerProps.md#enableblur)
- [enableSpring](LyricPlayerProps.md#enablespring)
- [linePosXSpringParams](LyricPlayerProps.md#lineposxspringparams)
- [linePosYSpringParams](LyricPlayerProps.md#lineposyspringparams)
- [lineScaleSpringParams](LyricPlayerProps.md#linescalespringparams)
- [lyricLines](LyricPlayerProps.md#lyriclines)

## Properties

### alignAnchor

• `Optional` **alignAnchor**: `number` \| ``"top"`` \| ``"bottom"``

设置歌词行的对齐方式，如果为 `undefined` 则默认为 `top`

- 设置成 `top` 的话歌词将会向组件顶部对齐
- 设置成 `bottom` 的话歌词将会向组件底部对齐
- 设置成 [0.0-1.0] 之间任意数字的话则会根据当前组件高度从顶部向下位移为对齐位置垂直居中对齐

#### Defined in

[packages/react/src/lyric-player.tsx:31](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L31)

___

### currentTime

• `Optional` **currentTime**: `number`

设置当前播放进度，单位为毫秒且**必须是整数**，此时将会更新内部的歌词进度信息
内部会根据调用间隔和播放进度自动决定如何滚动和显示歌词，所以这个的调用频率越快越准确越好

#### Defined in

[packages/react/src/lyric-player.tsx:52](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L52)

___

### enable

• `Optional` **enable**: `boolean`

是否启用歌词播放组件，默认为 `true`，设置为 `true` 将会开始逐帧更新歌词的动画效果，并对传入的其他参数变更做出反馈。

如果不设置该选项，你也可以通过引用取得原始渲染组件实例，手动逐帧调用其 `update` 函数来更新动画效果。

#### Defined in

[packages/react/src/lyric-player.tsx:23](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L23)

___

### enableBlur

• `Optional` **enableBlur**: `boolean`

设置是否启用歌词行的模糊效果，默认为 `true`

#### Defined in

[packages/react/src/lyric-player.tsx:43](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L43)

___

### enableSpring

• `Optional` **enableSpring**: `boolean`

设置是否使用物理弹簧算法实现歌词动画效果，默认启用

如果启用，则会通过弹簧算法实时处理歌词位置，但是需要性能足够强劲的电脑方可流畅运行

如果不启用，则会回退到基于 `transition` 的过渡效果，对低性能的机器比较友好，但是效果会比较单一

#### Defined in

[packages/react/src/lyric-player.tsx:39](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L39)

___

### linePosXSpringParams

• `Optional` **linePosXSpringParams**: `Partial`<`SpringParams`\>

设置所有歌词行在横坐标上的弹簧属性，包括重量、弹力和阻力。

**`Param`**

需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样

#### Defined in

[packages/react/src/lyric-player.tsx:58](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L58)

___

### linePosYSpringParams

• `Optional` **linePosYSpringParams**: `Partial`<`SpringParams`\>

设置所有歌词行在​纵坐标上的弹簧属性，包括重量、弹力和阻力。

**`Param`**

需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样

#### Defined in

[packages/react/src/lyric-player.tsx:64](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L64)

___

### lineScaleSpringParams

• `Optional` **lineScaleSpringParams**: `Partial`<`SpringParams`\>

设置所有歌词行在​缩放大小上的弹簧属性，包括重量、弹力和阻力。

**`Param`**

需要设置的弹簧属性，提供的属性将会覆盖原来的属性，未提供的属性将会保持原样

#### Defined in

[packages/react/src/lyric-player.tsx:70](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L70)

___

### lyricLines

• `Optional` **lyricLines**: `LyricLine`[]

设置当前播放歌词，要注意传入后这个数组内的信息不得修改，否则会发生错误

#### Defined in

[packages/react/src/lyric-player.tsx:47](https://github.com/amll-dev/applemusic-like-lyrics/blob/3f124db/packages/react/src/lyric-player.tsx#L47)
