---
title: Seeking and Progress Alignment
---

The lyric component sorts every progress value you push through `setCurrentTime` into one of two categories: **normal playback advance** and **seeking**. This page explains the difference between the two, how the component recognizes seeks automatically, and the cases where you may need to tell it explicitly.

Before reading this page, it is recommended to first read the part of [Timing and Lifecycle](./sequence) about pushing playback progress frame by frame. This page assumes you already call `setCurrentTime` continuously as described there.

## Why Seeking Is Distinguished

Besides advancing naturally with time, playback progress may also jump. Common cases include:

- Dragging the progress bar
- Fast-forwarding or rewinding
- Clicking a lyric line to seek
- Loop playback, where progress jumps from the end back to the beginning

During normal playback, the displacement between two adjacent lyric lines is small, so the component can safely present them with refined animation:

- Lyric lines animate staggered in index order, producing a cascading displacement
- The vertical spring parameters adjust dynamically according to the time interval between adjacent lines, becoming snappier as the interval gets shorter
- The word-by-word mask advances on its own through animation

A seek, on the other hand, may span the whole song. Keeping the behavior above, every lyric line would move with its own incremental delay, so during a long-distance seek you would see lyric lines that had larger delays sitting still where they were. The word-by-word mask of already highlighted lines would also stay at its pre-seek position, out of sync with the new progress.

Therefore, on the frame where a seek is recognized, the component switches to a different set of behavior:

| Behavior                | Normal Playback                                                  | Seeking                                                                |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Word-by-word mask       | Aligned once, only for lines that just started playing           | Aligns the masks of all currently highlighted lines to the target time |
| Animation delay         | Increments line by line, cascading displacement                  | All lines move at the same time                                        |
| Vertical spring         | Adjusted dynamically by the time interval between adjacent lines | Fixed, slower parameters                                               |
| Interlude dot animation | Keeps playing                                                    | Restarts from the target time                                          |
| User scroll position    | Preserved                                                        | Cleared, and auto-alignment resumes                                    |

Note that if the user scroll position came from touch, that position is preserved.

Seeking is an instantaneous state derived frame by frame. It only holds for the frame where the seek happens, and the next frame returns to normal playback. There is therefore no need to maintain a persistent seeking state on the host side, and you should not keep the seeking state for a long time either.

## Automatic Derivation

The component recognizes seeks automatically by default. Given the common premise of **pushing high-precision progress every frame**, the derivation covers the common cases very well: you do not need to do anything extra for seeking, as long as you keep pushing progress with `setCurrentTime` during playback. Passing the seek flag explicitly is a nice-to-have, not a requirement for normal use of the lyric component.

However, automatic derivation can only reason from progress changes that the component actually receives. Some edge cases may cause it to miss a seek or leave a minor visual blemish; see [Limitations of Automatic Derivation](#limitations-of-automatic-derivation). When the host knows that a seek has occurred, passing the seek flag explicitly can cover these edge cases.

Backward and stalled progress are both treated as a seek whether or not automatic derivation is enabled.

Three kinds of progress change are treated as a seek. The first two hold unconditionally; only the third is the automatic derivation's job:

- Progress going backward, however small
- Progress no longer advancing, that is, pushing the same time repeatedly
- Progress advancing significantly more than it should have: during playback the bar is the real elapsed time; while paused progress should not advance at all, so any advance beyond the jitter range counts

:::note
During playback, if **progress advances more slowly than real time, it will not be treated as a seek**, for example when playing below 1× speed, or when the progress source has latency.
:::

### Pushes Must Be Continuous and Dense Enough

The derivation draws its conclusion from the relationship between two consecutive pushes, so keep syncing frame by frame and do not call `setCurrentTime` only when a seek happens.

- Once the push interval exceeds roughly 1.2 seconds, every push is treated as a seek.
- Rate-adjusted playback is more sensitive to push density. Pushing every frame at 60 fps avoids false positives up to roughly 10× speed; at 30 fps that drops to roughly 5×, and with the push interval widened to 250 milliseconds only about 1.6× remains. When using high playback rates, push every frame or more often.

:::caution
Seek detection does not misfire within a normal range of playback rates. But **The lyric component itself does not support rate-adjusted playback**, the word-by-word mask always advances at 1×. During rate-adjusted playback the mask therefore falls steadily behind the actual progress, reaching only 1/rate of the way through a line by the time that line is over (only halfway at 2×, for instance).
:::

### Progress Source Granularity Must Not Be Coarser Than the Push Interval

Pushing the same time repeatedly is always treated as a seek, regardless of the automatic derivation switch. This makes a user repeatedly clicking the same spot on the progress bar recognizable as well, and pulls back the visual effects that are mid-animation, such as the word-by-word mask.

The cost is that if your progress source is quantized coarser than your push interval, the vast majority of pushes will be treated as seeks. For example, pushing a 250-millisecond-granular progress source once per frame leaves roughly
<math class="not-content">
	<mfrac>
		<mn>15</mn>
		<mn>16</mn>
	</mfrac>
</math>
of the pushes unchanged, so nearly every frame is handled as a seek. If you hit this, improve the precision of your progress source, or skip the push while the progress has not changed. Turning off automatic derivation does not avoid this.

Pausing is unaffected: pushes whose time has not changed are ignored outright, so they are neither treated as seeks nor trigger any relayout. This relies on the component knowing that it is currently paused, so keep `pause()` and `resume()` in sync as described in [Timing and Lifecycle](./sequence#play-and-pause).

### Limitations of Automatic Derivation

#### The Only Visual Blemish

When the premise above holds, exactly one situation leaves a visible blemish: during playback, the user drags the progress bar forward by less than 150 milliseconds. Such a displacement is not recognized, so the word-by-word mask ends up lagging the actual progress by at most 150 milliseconds.

This blemish is usually negligible. A 150-millisecond lag is barely visible, it does not accumulate, and the mask realigns as soon as the next line starts playing. Dragging the progress bar by less than 150 milliseconds on purpose is also extremely hard to do, so users generally do not seek by such a short distance.

The same goes for pausing: a progress change within 150 milliseconds is not recognized, and the mask stays where it is. Again, a user is very unlikely to drag by only that much.

#### Seeks Missed When the Premise Does Not Hold

The following two situations also miss seeks, but both stem from the premise not holding rather than from a limit of the derivation itself:

- **Pushing stops during an interruption**: when the tab goes to the background, pushing is throttled or stops, and a seek that happens meanwhile may go unrecognized. The frame where playback resumes realigns anyway, though, so this is usually invisible. Only an interruption lasting about a second can leave the mask lagging by up to 400 milliseconds, and that too clears when the next line starts.
- **The playback state is out of sync**: if the audio is already paused but the component still thinks it is playing, that is, `pause()` was never called, every seek within roughly 1.2 seconds while paused is missed and the mask stays where it is. Keeping the playback state in sync as described in [Timing and Lifecycle](./sequence#play-and-pause) narrows that back down to the negligible 150 milliseconds above.

## Marking Seeks Explicitly

The second parameter of `setCurrentTime` means **force this to be handled as a seek**:

```ts
function onSeeked() {
	player.setCurrentTime(Math.round(audio.currentTime * 1000), true);
}
audio.addEventListener("seeked", onSeeked);
```

Passing the seek flag explicitly is an optional nice-to-have. Automatic derivation is enabled by default and usually works very well when high-precision progress is pushed continuously.

Because the seeking state consumes more resources and interrupts gesture interaction (except for touch), keeping the seeking state for a long time is not recommended.

If you know for sure that a seek happened, you can mark it explicitly in the corresponding `setCurrentTime` call. This makes the decision independent of the push cadence and avoids the short-seek blemish and the two missed cases described above.

Passing the seek flag explicitly never overrides the result of the automatic derivation, so the two are safe to use together.

## When the Component Aligns on Its Own

The component handles the following cases as seeks on its own, with no intervention needed from you:

- When rebuilding the lyric view (such as `setLyricLines`, `setOptimizeOptions`, `updateLyricProcessConfig`), aligning with the initial time given at rebuild time
- When the page is shown (`pageshow`), realigning with the current progress

## Turning Off Automatic Derivation

If your host's progress source is too imprecise, so that the size of a forward advance is frequently misjudged, you can turn off the automatic derivation with [`setEnableAutoSeekDetection`](/en/reference/core/classlyricplayerbase#setenableautoseekdetection).

After that, only the third rule above stops applying, that is, the media clock is no longer compared against the wall clock; backward and stalled progress are still treated as seeks. The current state can be read with [`getEnableAutoSeekDetection`](/en/reference/core/classlyricplayerbase#getenableautoseekdetection).

## Lyric Line Click Events

The component provides a `line-click` event, fired when a lyric line is left-clicked with the mouse. Its event type is [`LyricLineMouseEvent`](/en/reference/core/classlyriclinemouseevent).

The component itself does not respond to lyric line clicks. You need to listen to the event and perform actions such as seeking the audio progress. For example:

```ts
import type { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";

player.addEventListener("line-click", (event) => {
	const lineEvent = event as LyricLineMouseEvent;
	audio.currentTime = lineEvent.line.getLine().startTime / 1000;
	player.setCurrentTime(lineEvent.line.getLine().startTime, true);
});
```

Clicking a lyric line to jump is also a seek. The explicit `true` above has the same effect as the automatic derivation, so the jump is generally still recognized correctly even if you omit it.

When the lyric component is no longer needed, remember to remove the listener added here. See [Timing and Lifecycle](./sequence#cleanup) for details.

## React and Vue Bindings

The React binding provides an `isSeeking` prop, which maps to the second parameter of `setCurrentTime` and can be passed when seeking:

```tsx
<LyricPlayer
	lyricLines={lyricLines}
	currentTime={currentTime}
	isSeeking={isSeeking}
	playing={playing}
/>
```

Since automatic derivation is enabled by default, this prop can usually be omitted. As with the vanilla API, it should not stay `true` for a long time.

This prop only annotates a change of `currentTime`; it never triggers a push by itself, so changing it while `currentTime` stays the same has no effect.

The Vue binding does not have a corresponding prop, but automatic derivation is enabled by default, so syncing `currentTime` already handles seeks correctly. If you need to mark seeks explicitly or turn off automatic derivation, access the underlying `lyricPlayer` through a component ref and call the corresponding methods yourself.

## Checklist

- Keep pushing progress with `setCurrentTime` during playback; do not call it only when seeking.
- The granularity of the progress source should not be coarser than the push interval.
- When using rate-adjusted playback, keep pushing frame by frame, and note that the component does not support rate-adjusted playback: the word-by-word mask still advances at 1×.
- When you know a seek happened (a lyric line click, for instance), you can optionally use the seek flag as a supplement to automatic derivation.
- Do not leave the seek flag set to `true` for a long time.
