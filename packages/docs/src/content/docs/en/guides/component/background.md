---
title: Dynamic Background
---

AMLL Core provides a standalone background rendering component, [`BackgroundRender`](/en/reference/core/classbackgroundrender). It renders album artwork or album video into an Apple Music style dynamic background. The lyric component still only handles the lyric view itself; audio playback, resource loading, and layer mounting should be managed by the host environment.

This page mainly explains background integration with the vanilla Core API. If you use the React or Vue bindings, jump directly to the [bindings section](#react-and-vue-bindings).

## Basic Structure

The background component consists of two parts:

- [`BackgroundRender`](/en/reference/core/classbackgroundrender): a unified wrapper that provides methods for setting album media, frame rate, render scale, pause/resume state, and more.
- Renderer: Core currently provides [`MeshGradientRenderer`](/en/reference/core/classmeshgradientrenderer) and [`PixiRenderer`](/en/reference/core/classpixirenderer).

When creating a background, choose one of these renderers:

```ts
// Use Mesh Gradient
import {
	BackgroundRender,
	MeshGradientRenderer,
} from "@applemusic-like-lyrics/core";
const meshBackground = BackgroundRender.new(MeshGradientRenderer);

// Use Pixi
import { BackgroundRender, PixiRenderer } from "@applemusic-like-lyrics/core";
const pixiBackground = BackgroundRender.new(PixiRenderer);
```

## Layering With the Lyric Component

The background element is a `<canvas>`. Usually, place it in the same container as the lyric component and insert it before the lyric element.

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

The canvas size is determined by CSS. Internally, a `ResizeObserver` adjusts the actual drawing size according to the device pixel ratio and render scale. Therefore, the host container should have an explicit width and height.

AMLL does not define positioning or z-index styles for the background and lyric components. Define those styles in your host application.

## Setting Album Media

Call [`setAlbum`](/en/reference/core/classbackgroundrender#setalbum) to set the background source. It accepts an image or video URL, an `HTMLImageElement`, or an `HTMLVideoElement`.

If you pass a string URL and the resource is a video, set the second parameter to `true`:

```ts
// Image URL
await background.setAlbum("/album-cover.jpg");

// Video URL
await background.setAlbum("/album-video.webm", true);
```

If you already have a `File` or `Blob` object, use [`URL.createObjectURL`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) to create an object URL and pass it to `setAlbum`.

The background renderer draws the resource into a canvas or WebGL texture.

## Syncing Playback State

The background component has its own animation loop, so you do not need to manually call `update(delta)` frame by frame as you do with `DomLyricPlayer`. Just call `resume()` and `pause()` when playback starts or pauses:

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

The background animation state is independent from the lyric animation state. You can also control only the background animation.

```ts
function setBackgroundPlaying(playing: boolean) {
	if (playing) background.resume();
	else background.pause();
}
```

## Applying Render Settings

Common settings can be applied after initialization or when the user changes options. They take effect immediately.

```ts
function applyBackgroundSettings() {
	background.setFPS(60);
	background.setRenderScale(1);
	background.setFlowSpeed(0.2);
	background.setStaticMode(false);
	background.setLowFreqVolume(1);
}
```

| Method                                                                                     | Description                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [`setFPS(fps)`](/en/reference/core/classbackgroundrender#setfps)                           | Sets the frame rate of the background animation                                                  |
| [`setRenderScale(scale)`](/en/reference/core/classbackgroundrender#setrenderscale)         | Sets the render scale. Higher values are clearer and also more performance-intensive              |
| [`setFlowSpeed(speed)`](/en/reference/core/classbackgroundrender#setflowspeed)             | Sets the background flow speed                                                                   |
| [`setStaticMode(enable)`](/en/reference/core/classbackgroundrender#setstaticmode)          | When enabled, the background can stay static after the resource transition animation to save work |
| [`setLowFreqVolume(volume)`](/en/reference/core/classbackgroundrender#setlowfreqvolume)    | Passes a low-frequency volume hint. Some renderers may use it to adjust dynamic effects           |
| [`setHasLyric(hasLyric)`](/en/reference/core/classbackgroundrender#sethaslyric)            | Tells the renderer whether the current song has lyrics. Some renderers may adjust effects         |

`setRenderScale` is usually a tradeoff between `0.5` and `1`. On mobile or low-performance devices, lower the render scale and frame rate. For a fullscreen player, you can increase the render scale.

## Changing Renderers

After `BackgroundRender` is created, its internal renderer cannot be replaced. If the user switches from `MeshGradientRenderer` to `PixiRenderer`, dispose the old instance and create a new one:

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

## Cleanup

When the page unloads, the player is destroyed, or you permanently switch implementations, release the background instance:

```ts
background.dispose();
lyricPlayer.dispose();
```

`dispose()` releases internal renderer resources and removes the background canvas. If you created an `ObjectURL`, audio event listeners, or other async loading state yourself, clean those up in your host code as well.

## React and Vue Bindings

The background component has much less intermediate state than the lyric component, so componentized usage is simpler.

React and Vue are similar: both set options and maintain state through props. Use the `playing` prop to specify playback state, and use the `album` prop to specify album image or video media. See the API reference for the complete prop list.

- React prop reference: [BackgroundRenderProps](/en/reference/react/interfacebackgroundrenderprops)
- Vue prop reference: [BackgroundRender](/en/reference/vue/classbackgroundrender)

The component automatically releases internal resources when unmounted. You still need to release listeners, object URLs, and similar resources that you create yourself.

Here is a minimal React example:

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

Here is a minimal Vue example:

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

## Checklist

- The host container has an explicit size.
- The background canvas is inserted before the lyric element, and the lyric layer is above the background layer.
- Image or video resources allow cross-origin reads, or are same-origin with the page.
- Video URLs are passed with `setAlbum(source, true)`.
- Playback state is synced to `resume()` / `pause()`.
- When switching renderers, call `dispose()` on the old background before creating the new one.
- On unmount, release the background, lyric component, and resources created by host code.
