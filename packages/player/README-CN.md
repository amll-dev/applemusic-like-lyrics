# AMLL Player

一个通过 本地音乐文件/WebSocket Server 获取音频播放信息的独立歌词页面播放器。

功能/特性列表：

- 与任何实现 AMLL WS Protocol 的客户端进行通信，同步播放信息进度，并获取对应的歌词以进行播放展示
- 支持读取本地音频文件播放，或加载本地歌词文件
- 支持加载各种歌词格式
- 高性能 —— 不会因为某些软件自身问题导致歌词展示效果受到影响
- 预计支持播放状态传输协议：[SMTC (Windows)](https://learn.microsoft.com/en-us/uwp/api/windows.media.systemmediatransportcontrols?view=winrt-26100) / [MPRIS (Linux/XDG)](https://www.freedesktop.org/wiki/Specifications/mpris-spec/) / [MPNowPlayingInfoCenter (macOS)](https://developer.apple.com/documentation/mediaplayer/mpnowplayinginfocenter)

## 安装使用

由于播放器还在兼容状态，所以仅可通过 [Github Action](https://github.com/Steve-xmh/applemusic-like-lyrics/actions/workflows/build-player.yaml) 下载开发构建，日后会推出正式版。

## 为什么会有这个？

歌词播放器相当于外挂字幕一样的软件，在独立于插件环境以外的环境播放歌词。

经过作者的性能测试，发现以插件形式嵌入到播放页面会因为插件运行环境自身浏览器框架问题导致掉帧和不定卡顿的问题。

故作者决定将播放页面分离到一个独立的桌面程序进行以提高播放性能和效果，而原插件则负责将播放的信息和状态传递给歌词播放器。

因此如果你也有少许卡顿现象，可以尝试使用这个歌词播放器，性能应该可以有所改善。

~~毕竟真的不是我插件优化差啊（）~~
