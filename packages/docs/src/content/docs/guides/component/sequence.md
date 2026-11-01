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

设置或修改歌词优化选项会重新处理歌词并自动重建视图。你可以在 `setLyricLines` 之前调用 `setOptimizeOptions`，也可以在已有歌词时随时调用它。

如果需要同时修改歌词优化选项、不雅用语掩码模式等多个配置，推荐使用 `updateLyricProcessConfig` 方法进行批量更新，以避免多次触发视图重建：

```ts
player.updateLyricProcessConfig({
	optimizeOptions: { normalizeSpaces: true },
	maskMode: "full-mask",
	maskChar: "*",
});
```

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

在正常播放之外，播放进度有可能产生跳变，歌词组件对这类进度变化会切换到另一套布局与动画行为。

有关更多信息，请转到 [跳转与进度对齐](./seeking)。

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

React 绑定额外提供 `isSeeking` 属性，对应 `setCurrentTime` 的第二个参数；Vue 绑定目前功能较为残缺，没有对应的属性。两者的自动推导都默认启用，因此一般同步 `currentTime` 即可，详见 [跳转与进度对齐](./seeking#react-与-vue-绑定)。我们将会在接下来的版本中逐步优化 Vue 绑定的功能与使用体验。

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
- 跳转默认由组件自动识别；已知发生跳转时，可以额外用 seek 标志显式标识。
- 卸载时取消动画帧、移除事件监听并释放组件。
