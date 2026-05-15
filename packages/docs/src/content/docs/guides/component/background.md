---
title: 动态背景
---

AMLL Core 提供了独立的背景渲染组件 [`BackgroundRender`](/reference/core/classbackgroundrender)。它负责把专辑图或专辑视频渲染成 Apple Music 风格的动态背景；歌词组件仍然只负责歌词视图本身，音频播放、资源加载与图层挂载需要由宿主环境管理。

本文主要使用原生 Core API 说明背景集成方式，如果你使用 React 或 Vue 绑定，请直接转到 [绑定部分](#react-与-vue-绑定)。

## 基本结构

背景组件由两部分组成：

- [`BackgroundRender`](/reference/core/classbackgroundrender)：统一的包装器，提供设置专辑图、帧率、渲染比例、暂停恢复等方法。
- 渲染器：目前 Core 提供 [`MeshGradientRenderer`](/reference/core/classmeshgradientrenderer) 和 [`PixiRenderer`](/reference/core/classpixirenderer)。

创建背景时需要选择其中一个渲染器：

```ts
// 使用 Mesh Gradient
import {
	BackgroundRender,
	MeshGradientRenderer,
} from "@applemusic-like-lyrics/core";
const meshBackground = BackgroundRender.new(MeshGradientRenderer);

// 使用 Pixi
import { BackgroundRender, PixiRenderer } from "@applemusic-like-lyrics/core";
const pixiBackground = BackgroundRender.new(PixiRenderer);
```

## 与歌词组件叠放

背景元素是一个 `<canvas>`。通常把它和歌词组件放在同一个容器中，并放置在歌词元素之前。

```ts
import {
	BackgroundRender,
	DomLyricPlayer,
	MeshGradientRenderer,
} from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css";

const background = BackgroundRender.new(MeshGradientRenderer);
const lyricPlayer = new DomLyricPlayer();

function mountPlayer(host: HTMLElement) {
	const backgroundElement = background.getElement();
	const lyricElement = lyricPlayer.getElement();

	host.appendChild(backgroundElement);
	host.appendChild(lyricElement);
}

const host = document.querySelector<HTMLElement>("#player");
if (!host) throw new Error("missing #player");

mountPlayer(host);
```

背景的 canvas 尺寸由 CSS 决定，内部会通过 `ResizeObserver` 按设备像素比和渲染比例调整实际绘制尺寸。因此，宿主容器应有明确宽高。

AMLL 本身不会定义背景组件与歌词组件的定位与层级样式，这部分样式应由宿主定义。

## 设置专辑资源

调用 [`setAlbum`](/reference/core/classbackgroundrender#setalbum) 设置背景来源。它可以接收图片或视频 URL、`HTMLImageElement` 或 `HTMLVideoElement`。

如果传入字符串 URL 且资源是视频，需要把第二个参数设为 `true`：

```ts
// 图片 URL
await background.setAlbum("/album-cover.jpg");

// 视频 URL
await background.setAlbum("/album-video.webm", true);
```

若你已经持有 `File` 或 `Blob` 对象，可以使用 [`URL.createObjectURL`](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static) 创建对象 URL 并提供给 `setAlbum`。

背景渲染会把资源绘制到 canvas / WebGL 纹理中。

## 同步播放状态

背景组件拥有自己的动画循环，不需要像 `DomLyricPlayer` 一样手动逐帧调用 `update(delta)`。只需要在播放、暂停时调用 `resume()` 与 `pause()`：

```ts
audio.addEventListener("play", () => {
	lyricPlayer.resume();
	background.resume();
});

audio.addEventListener("pause", () => {
	lyricPlayer.pause();
	background.pause();
});
```

背景动画的播放状态与歌词动画独立，你也可以只控制背景动画。

```ts
function setBackgroundPlaying(playing: boolean) {
	if (playing) background.resume();
	else background.pause();
}
```

## 应用渲染设置

常用设置可以在初始化后或用户调整选项时应用，设置后即时生效。

```ts
function applyBackgroundSettings() {
	background.setFPS(60);
	background.setRenderScale(1);
	background.setFlowSpeed(0.2);
	background.setStaticMode(false);
	background.setLowFreqVolume(1);
}
```

| 方法                                                                                 | 说明                                                           |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`setFPS(fps)`](/reference/core/classbackgroundrender#setfps)                        | 设置背景动画帧率                                               |
| [`setRenderScale(scale)`](/reference/core/classbackgroundrender#setrenderscale)      | 设置渲染比例，数值越高越清晰，也越消耗性能                     |
| [`setFlowSpeed(speed)`](/reference/core/classbackgroundrender#setflowspeed)          | 设置背景流动速度                                               |
| [`setStaticMode(enable)`](/reference/core/classbackgroundrender#setstaticmode)       | 开启后，背景在资源切换动画结束后可以停在静态状态，以节省性能   |
| [`setLowFreqVolume(volume)`](/reference/core/classbackgroundrender#setlowfreqvolume) | 传入低频音量提示，部分渲染器可能会据此调整动态效果             |
| [`setHasLyric(hasLyric)`](/reference/core/classbackgroundrender#sethaslyric)         | 告诉渲染器当前歌曲是否有歌词，部分渲染器可能会据此调整动态效果 |

`setRenderScale` 的值通常在 `0.5` 到 `1` 之间取舍。移动端或低性能设备可以降低渲染比例和帧率；播放器全屏展示时可以提高渲染比例。

## 更换渲染器

`BackgroundRender` 创建后不能替换内部渲染器。如果用户从 `MeshGradientRenderer` 切换到 `PixiRenderer`，应该释放旧实例并创建新实例：

```ts
type PlayerBackground =
	| BackgroundRender<MeshGradientRenderer>
	| BackgroundRender<PixiRenderer>;

function switchToPixiRenderer(
	host: HTMLElement,
	lyricPlayer: DomLyricPlayer,
	currentBackground: PlayerBackground,
) {
	currentBackground.dispose();

	const nextBackground = BackgroundRender.new(PixiRenderer);
	host.insertBefore(nextBackground.getElement(), lyricPlayer.getElement());
	return nextBackground;
}
```

## 清理

页面卸载、播放器销毁或永久切换实现时，需要释放背景实例：

```ts
background.dispose();
lyricPlayer.dispose();
```

`dispose()` 会释放渲染器内部资源，并移除背景 canvas。若你自己创建了 `ObjectURL`、音频事件监听或其他异步加载状态，也需要在宿主代码中一并清理。

## React 与 Vue 绑定

背景组件没有歌词组件那么复杂的中间状态维护，因此组件化轻松许多。

React 与 Vue 是类似的，均通过 props 设置选项与维护状态。是否播放使用 `playing` 属性指定，专辑图片或视频资源使用 `album` 属性指定。你可以在 API 参考中查看完整的属性列表。

- React 属性列表参考：[BackgroundRenderProps](/reference/react/interfacebackgroundrenderprops)
- Vue 属性列表参考：[BackgroundRender](/reference/vue/classbackgroundrender)

组件在卸载时会自动释放内部资源。但你自行定义的监听器、Object URL 等仍需你自行释放。

下面是一个 React 的最小示例：

```tsx
import { LyricPlayer, BackgroundRender } from "@applemusic-like-lyrics/react";

function app() {
	const albumUrl = "/album-cover.jpg";
	return (
		<>
			<BackgroundRender album={albumUrl} />
			<LyricPlayer lyricLines={lyricLines} currentTime={currentTime} />
		</>
	);
}
```

下面是一个 Vue 的最小示例：

```vue
<template>
	<BackgroundRender :album="albumUrl" />
	<LyricPlayer :lyricLines="lyricLines" :currentTime="currentTime" />
</template>

<script setup lang="ts">
import { BackgroundRender, LyricPlayer } from "@applemusic-like-lyrics/vue";
import { ref } from "vue";

const albumUrl = ref("/album-cover.jpg");
const currentTime = ref(0);
const lyricLines = ref([]);
</script>
```

## 检查清单

- 宿主容器有明确尺寸。
- 背景 canvas 插入在歌词元素之前，且歌词层级高于背景层级。
- 图片或视频资源允许跨域读取，或与页面同源。
- 视频 URL 调用 `setAlbum(source, true)`。
- 播放状态同步到 `resume()` / `pause()`。
- 切换渲染器时先 `dispose()` 旧背景，再创建新背景。
- 卸载时释放背景、歌词组件和宿主代码创建的资源。
