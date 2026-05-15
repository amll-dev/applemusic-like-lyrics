---
title: Timing and Lifecycle
---

This page explains timing and lifecycle management for the lyric component.

The lyric component only handles the lyric view itself. It **does not handle audio playback**. Therefore, **the host environment, which is your code, needs to manage audio playback and bridge the audio playback state to AMLL component state.**

If you use the React or Vue bindings, the component manages part of the lifecycle for you. If you use the vanilla API directly, you need to manage the full flow yourself. This page mainly covers lifecycle management with the vanilla API and explains the state managed by the bindings.

## Initialization

During initialization, you need to:

1. Create the lyric component and mount its element into a container with an **explicit size**.
2. Optionally set custom lyric optimization options. The [`setOptimizeOptions`](/en/reference/core/classlyricplayerbase#setoptimizeoptions) method accepts [`OptimizeLyricOptions`](/en/reference/core/interfaceoptimizelyricoptions).
3. Set lyric data. The [`setLyricLines`](/en/reference/core/classlyricplayerbase#setlyriclines) method accepts [`LyricLine[]`](/en/reference/core/interfacelyricline). After passing the objects in, do not modify them.
4. Align the lyric position once with the current playback progress.

A typical vanilla sequence looks like this:

```ts
import { LyricPlayer } from "@applemusic-like-lyrics/core";

const player = new LyricPlayer();
host.appendChild(player.getElement());

const currentTime = Math.round(audio.currentTime * 1000);
player.setOptimizeOptions({}); // Optional
player.setLyricLines(lines, currentTime);
player.setCurrentTime(currentTime, true);
player.update(0);
```

Lyric optimization runs when lyrics are set, so if you need to change these options, call `setOptimizeOptions` before `setLyricLines`. Changes after `setLyricLines` do not automatically reprocess existing lyrics; set the lyrics again to apply them.

Also note that `currentTime` is in milliseconds and should be an integer. `audio.currentTime` is in seconds, so multiply it by `1000`.

## Play and Pause

`pause()` and `resume()` control the lyric component's internal presentation state, including word-by-word animation, glow, and interlude dot animation. Call `resume()` when audio starts playing, and call `pause()` when audio pauses, ends, or is externally interrupted.

For example, when using `<audio>` for playback, drive this with its events:

```ts
const onPlay = () => {
	player.resume();
};
const onPause = () => {
	player.pause();
};

audio.addEventListener("play", onPlay);
audio.addEventListener("pause", onPause);
```

## Playback Progress

### Normal Playback

During playback, you need to update the lyric component's time progress. **All time values used by AMLL are in milliseconds**.

Two time values are easy to confuse:

| Time Type         | Accepted By                                | Meaning                         |
| ----------------- | ------------------------------------------ | ------------------------------- |
| Current progress  | `setCurrentTime(time)` / `currentTime` prop | Song playback progress          |
| Frame delta       | `update(delta)`                            | Time elapsed since the previous frame |

In vanilla usage, `setCurrentTime` updates the lyric timeline, and `update` advances animation. **They are not the same value**.

```ts
let frameId = 0;
let lastFrameTime = -1;

function startFrameLoop() {
	const onFrame = (frameTime: number) => {
		const delta = lastFrameTime === -1 ? 0 : frameTime - lastFrameTime;
		lastFrameTime = frameTime;
		if (!audio.paused) {
			player.setCurrentTime(Math.round(audio.currentTime * 1000));
		}
		player.update(delta);
		frameId = requestAnimationFrame(onFrame);
	};
	frameId = requestAnimationFrame(onFrame);
}

function stopFrameLoop() {
	cancelAnimationFrame(frameId);
	frameId = 0;
	lastFrameTime = -1;
}
```

**Do not rely on the `<audio>` `timeupdate` event to sync lyrics**. Browsers fire `timeupdate` at a low and unstable frequency, usually far below the animation frame rate. During playback, use `requestAnimationFrame` to sync current progress frame by frame.

### Seeking

Outside normal playback, playback progress may jump. Common cases include:

- Dragging the progress bar
- Fast-forwarding or rewinding
- Clicking a lyric line to seek
- Loop playback, where progress jumps from the end back to the beginning

When playback progress jumps, set the second parameter of `setCurrentTime` to `true`:

```ts
function onSeeked() {
	player.setCurrentTime(Math.round(audio.currentTime * 1000), true);
}
audio.addEventListener("seeked", onSeeked);
```

**This parameter indicates that the current sync is a seek. Normal playback and seek state use different layout and animation behavior:**

- During normal playback, the component lays out and applies spring animation to each visible line individually for a refined visual effect.
- During seeking, the component force-aligns the lyric position and applies layout plus spring animation to all lyric lines as a whole, reducing work and making the animation snappier.

If seek state is not marked correctly, layout glitches may occur, such as stutters or lyric lines quickly flying from one side of the screen to the other and disappearing. You can see screenshots in [issue #429](https://github.com/amll-dev/applemusic-like-lyrics/issues/429).

### Lyric Line Click Events

The component provides a `line-click` event, fired when a lyric line is clicked. Its event type is [`LyricLineMouseEvent`](/en/reference/core/classlyriclinemouseevent).

**The component itself does not respond to lyric line clicks.** The host environment needs to listen to the event and perform actions such as seeking the audio progress. For example:

```ts
import type { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";

player.addEventListener("line-click", (event) => {
	const lineEvent = event as LyricLineMouseEvent;
	audio.currentTime = lineEvent.line.getLine().startTime / 1000;
	player.setCurrentTime(lineEvent.line.getLine().startTime, true);
});
```

It is worth noting that clicking a lyric line to jump is also a seek.

## Changing Lyrics

When changing songs or lyric sources, set a new lyric line object array with `setLyricLines`. If loading fails, pass an empty array to clear the lyrics.

```ts
player.setLyricLines([]);
player.update(0);
```

## React and Vue Bindings

The React and Vue bindings create and destroy the underlying Core component. They also automatically call `update` unless disabled. Therefore, when using bindings, you usually do not need to call the underlying `update` yourself.

You still need to provide these states:

| State              | React / Vue Input | Description                                      |
| ------------------ | ----------------- | ------------------------------------------------ |
| Lyric data         | `lyricLines`      | Parsed `LyricLine[]`                             |
| Current progress   | `currentTime`     | Synced from audio with `requestAnimationFrame` during playback |
| Playback state     | `playing`         | Pauses or resumes the lyric component's internal presentation |

The React binding additionally provides an `isSeeking` prop, which you can pass during seeking:

```tsx
<LyricPlayer
	lyricLines={lyricLines}
	currentTime={currentTime}
	isSeeking={isSeeking}
	playing={playing}
/>
```

`isSeeking` should not stay `true` for a long time. Usually, set it to `true` briefly when the user completes a seek, then restore it to `false` after the next sync.

The Vue binding is currently less complete and does not have a separate `isSeeking` prop. In common scenarios, syncing `currentTime` is enough to work. If you need finer state control, use the vanilla API directly. We will continue improving the Vue binding functionality and usage experience in upcoming versions.

If `disabled` is set, the binding no longer manages frame-by-frame animation. In that case, you can access the underlying `lyricPlayer` through a component ref and call `update` yourself, just like with the vanilla API.

## Cleanup

When the lyric player component is no longer needed, vanilla usage requires cleaning up every resource you created yourself:

```ts
// Clear the requestAnimationFrame loop you defined.
stopFrameLoop();

// Remove listeners you added.
audio.removeEventListener("play", onPlay);
audio.removeEventListener("pause", onPause);
audio.removeEventListener("seeked", onSeeked);

// Release component resources.
player.dispose();
```

`dispose()` removes the component element and releases internal listeners.

If you use the React or Vue bindings, the component automatically calls the underlying `dispose()` when unmounted. However, `requestAnimationFrame`, audio event listeners, `ObjectURL`s, and similar resources that you create yourself still need to be cleaned up when the component unmounts.

## Checklist

- The container has an explicit size and has been mounted to the DOM.
- Lyrics are passed through `setLyricLines(lines, currentTime)` or the `lyricLines` prop.
- Playback progress is represented in milliseconds.
- During playback, `currentTime` is synced with `requestAnimationFrame`.
- In vanilla usage, `update(delta)` is called frame by frame.
- Pause, resume, and playback end are synced to `pause()` / `resume()` or `playing`.
- Seeking uses the seek flag to align the lyric position.
- On unmount, cancel animation frames, remove event listeners, and dispose the component.
