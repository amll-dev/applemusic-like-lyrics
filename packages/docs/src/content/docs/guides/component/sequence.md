---
title: 时序与生命周期
---

下面介绍歌词组件的时序与生命周期管理。

歌词组件只负责歌词视图本身，**不负责音频播放**。因此 **宿主环境（也就是你的代码）需要管理音频播放，并把音频播放状态与 AMLL 的组件状态桥接起来。**

如果你使用 React 或 Vue 绑定，组件会代管一部分生命周期；如果直接使用原生方式，则需要自己管理完整流程。本文主要介绍原生方式引入的周期管理，并介绍绑定托管的状态。

## 初始化

初始化时需要完成：

1. 创建歌词组件，并把它的元素挂载到一个 **有明确尺寸的** 容器里。
2. （可选）设置自定义歌词优化选项。[`setOptimizeOptions`](/reference/core/classlyricplayerbase#setoptimizeoptions) 方法接受 [`OptimizeLyricOptions`](/reference/core/interfaceoptimizelyricoptions)。
3. 设置歌词数据。[`setLyricLines`](/reference/core/classlyricplayerbase#setlyriclines) 方法接受 [`LyricLine[]`](/reference/core/interfacelyricline)，传入后不应再修改这些对象。
4. 用当前播放进度对齐一次歌词位置。

原生方式的典型顺序如下：

```ts
import { LyricPlayer } from "@applemusic-like-lyrics/core";

const player = new LyricPlayer();
host.appendChild(player.getElement());

const currentTime = Math.round(audio.currentTime * 1000);
player.setOptimizeOptions({}); // 可选
player.setLyricLines(lines, currentTime);
player.setCurrentTime(currentTime, true);
player.update(0);
```

在设置歌词时会执行歌词优化处理，因此这部分选项如需调整，应在 `setLyricLines` 之前调用 `setOptimizeOptions`。在 `setLyricLines` 之后修改不会自动重新处理已有歌词，需要重新设置歌词。

另外需要注意其中 `currentTime` 的单位是毫秒，且应为整数。`audio.currentTime` 单位为秒，所以要乘以 `1000`。

## 播放与暂停

`pause()` 和 `resume()` 控制歌词组件内部的演出状态，包括逐字动画与辉光、间奏点动画。音频开始播放时调用 `resume()`，音频暂停、结束或被外部中断时调用 `pause()`。

例如，若使用 `<audio>` 播放音频，可以使用其事件驱动：

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

## 播放进度

### 正常播放

在播放过程中需要更新歌词组件的时间进度。**AMLL 使用的所有时间，单位均为毫秒**。

其中有两个容易混淆的时间：

| 时间类型     | 接收于                                      | 含义                 |
| ------------ | ------------------------------------------- | -------------------- |
| 当前播放进度 | `setCurrentTime(time)` / `currentTime` 属性 | 歌曲播放的进度       |
| 帧间隔       | `update(delta)`                             | 距离上一帧过去的时间 |

原生方式下，`setCurrentTime` 会更新歌词时间线，`update` 会推进动画。**二者不是同一个值**。

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

**不应依赖 `<audio>` 的 `timeupdate` 事件同步歌词**。这是由于浏览器触发 `timeupdate` 的频率较低且不稳定，通常明显低于动画帧频率。播放中应使用 `requestAnimationFrame` 逐帧同步当前进度。

### 跳转

在正常播放之外，播放进度有可能产生跳变，常见于：

- 拖动进度条
- 快进快退
- 点击某一歌词行跳转
- 循环播放时，进度从结尾跳至开头

播放进度发生跳变时，需要把 `setCurrentTime` 的第二个参数设为 `true`：

```ts
function onSeeked() {
	player.setCurrentTime(Math.round(audio.currentTime * 1000), true);
}
audio.addEventListener("seeked", onSeeked);
```

**这个参数表示本次同步是一次 seek。正常播放状态与 seek 状态的布局与动画行为是不同的：**

- 正常播放时，组件会对视图内的每一行单独执行布局与弹簧动画，实现细腻的视觉效果
- 调整进度时，组件会强制对齐歌词位置，对所有歌词行整体执行布局与弹簧动画效果，减小性能消耗且动画更加利落

如果没有正确标记 seek 状态，可能出现布局异常，例如出现卡顿、歌词行从屏幕一端快速飞到另一端消失等等。你可以在 [issue #429](https://github.com/amll-dev/applemusic-like-lyrics/issues/429) 中看到截图。

### 歌词行点击事件

组件提供了 `line-click` 事件，在某一歌词行被点击时触发，其事件类型为 [`LyricLineMouseEvent`](/reference/core/classlyriclinemouseevent)。

**组件本身不会响应歌词行的点击操作。** 宿主环境需要监听该事件，并作出音频进度跳转等操作。例如：

```ts
import type { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";

player.addEventListener("line-click", (event) => {
	const lineEvent = event as LyricLineMouseEvent;
	audio.currentTime = lineEvent.line.getLine().startTime / 1000;
	player.setCurrentTime(lineEvent.line.getLine().startTime, true);
});
```

值得一提：点击歌词行跳转时也属于 seek。

## 更换歌词

更换歌曲或歌词源时，通过 `setLyricLines` 方法再次设置歌词行对象数组即可。如果加载失败，可以传入空数组清空歌词。

```ts
player.setLyricLines([]);
player.update(0);
```

## React 与 Vue 绑定

React 和 Vue 绑定会创建并销毁底层 Core 组件，也会在未禁用时自动调用 `update`。因此使用绑定时，通常不需要自己调用底层 `update`。

你仍然需要负责这些状态：

| 状态         | React / Vue 传入方式 | 说明                                        |
| ------------ | -------------------- | ------------------------------------------- |
| 歌词数据     | `lyricLines`         | 解析后的 `LyricLine[]`                      |
| 当前播放进度 | `currentTime`        | 播放中用 `requestAnimationFrame` 从音频同步 |
| 播放状态     | `playing`            | 控制歌词组件内部演出暂停或恢复              |

React 绑定额外提供 `isSeeking` 属性，可以在跳转时传入：

```tsx
<LyricPlayer
	lyricLines={lyricLines}
	currentTime={currentTime}
	isSeeking={isSeeking}
	playing={playing}
/>
```

`isSeeking` 不应长期保持为 `true`。通常在用户完成一次跳转时短暂置为 `true`，下一轮同步后再恢复为 `false`。

Vue 绑定目前功能较为残缺，没有单独的 `isSeeking` 属性。一般场景下同步 `currentTime` 就可以工作。如果需要进一步控制状态，建议直接使用原生方式引入。我们将会在接下来的版本中逐步优化 Vue 绑定的功能与使用体验。

如果设置了 `disabled`，绑定将不再代管逐帧动画。此时你可以通过组件 ref 取得底层 `lyricPlayer`，并像原生方式一样自己调用 `update`。

## 清理

当不再需要歌词播放组件时，原生方式需要清理你自己创建的所有资源：

```ts
// 清除你定义的 requestAnimationFrame 逐帧调用
stopFrameLoop();

// 移除你添加的侦听器
audio.removeEventListener("play", onPlay);
audio.removeEventListener("pause", onPause);
audio.removeEventListener("seeked", onSeeked);

// 释放组件资源
player.dispose();
```

`dispose()` 会移除组件元素并释放内部监听。

如果使用 React 或 Vue 绑定，组件卸载时会自动调用底层 `dispose()`；但你自己创建的 `requestAnimationFrame`、音频事件监听、`ObjectURL` 等仍然需要在组件卸载时清理。

## 检查清单

- 容器应有明确尺寸，且已经挂载到 DOM。
- 歌词通过 `setLyricLines(lines, currentTime)` 或 `lyricLines` 属性传入。
- 播放进度用毫秒表示。
- 播放时用 `requestAnimationFrame` 同步 `currentTime`。
- 原生方式逐帧调用 `update(delta)`。
- 暂停、恢复、结束播放时同步 `pause()` / `resume()` 或 `playing`。
- 跳转使用 seek 标志对齐。
- 卸载时取消动画帧、移除事件监听并释放组件。
