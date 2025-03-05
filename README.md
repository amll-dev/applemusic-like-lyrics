<div align=center>

![Apple Music-like Lyrics - A lyric page component library for Web](https://github.com/user-attachments/assets/ca6a98d4-28ea-4fb6-beec-7948f2ac87ec)

English / [简体中文](./README-CN.md)

</div>

> [!WARNING]
> English readme is still under construction!

<div align=center>

A lyric player component library aims to look similar to iPad version of Apple Music. Also with[ DOM](./packages/core/README.md),[ React ](./packages/react/README.md)and[ Vue ](./packages/react/README.md)bindings. [Also there's a local player based on it!](./packages/player/README.md)

This's maybe the most like iPad Apple Music style lyric page you've seen in frontend.

Although the goal of this project is not to imitate it completely, it will polish some details better to be better than currently the best lyric players.

**—— AMLL Series Projects ——**

[AMLL TTML DB - TTML Syllable Lyric Database](https://github.com/Steve-xmh/amll-ttml-db)
/
[AMLL TTML Tool - TTML Syllable Lyric Editor](https://github.com/Steve-xmh/amll-ttml-tool)

</div>

## AMLL Ecology and source code structure

### Main modules

-   [![AMLL-Core](https://img.shields.io/badge/Core-%233178c6?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/core/README.md)：AMLL Core Component Library，以 DOM Written natively，Provides a lyric display component and a dynamic fluid background component
-   [![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/react/README.md)：AMLL React bind**，Provision React Lyrics in the form of components display components and dynamic fluid background components
-   [![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/vue/README.md)：AMLL Vue bind，Provision Vue Lyrics in the form of components display components and dynamic fluid background components
-   [![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/lyric/README.md)：AMLL 歌词解析模块，提供对 LyRiC, YRC, QRC, Lyricify Syllable 各种歌词格式的解析和序列化支持

### 外部工具

-   [AMLL Player](./packages/player/README.md)：AMLL 外置播放器，提供独立的外置歌词播放器，并通过独有的 WebSocket 协议与 AMLL 任意实现了协议的程序进行通信展示歌词
-   [AMLL TTML Tool](https://github.com/Steve-xmh/amll-ttml-tool)： AMLL TTML 编辑器，提供对 TTML 格式歌词的编辑支持，并使用 AMLL Core 进行实时预览
-   [AMLL TTML Database](https://github.com/Steve-xmh/amll-ttml-db)： AMLL TTML 数据库，提供 TTML 歌词存储仓库，以让各类歌词播放器可以使用由社区制作的 TTML 逐词歌词

## AMLL Player Preview Gallery

![AMLL Player Preview](https://github.com/user-attachments/assets/2b93b28f-7f79-4092-a0a5-bc7c66e731a9)

## Browser compatibility alerts

This component framework requires the following browsers or newer versions at a minimum：

-   Chromuim/Edge 91+
-   Firefox 100+
-   Safari 9.1+

The following browser or newer version is required to render all effects of the component：

-   Chromuim 120+
-   Firefox 100+
-   Safari 15.4+

参考链接：

-   [https://caniuse.com/mdn-css_properties_mask-image](https://caniuse.com/mdn-css_properties_mask-image)
-   [https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter](https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter)

## 性能配置参考

经过性能基准测试，五年内的主流 CPU 处理器均可以以 30FPS 正常带动歌词组件，但如果需要 60FPS 流畅运行，请确保 CPU 频率至少为 3.0Ghz 或以上。如果需要 144FPS 以上流畅运行，请确保 CPU 频率至少为 4.2Ghz 或以上。

GPU 性能在以下状况下能够以预期尺寸下满 60 帧运行：

-   `1080p (1920x1080)`: NVIDIA GTX 10 系列及以上
-   `2160p (3840x2160)`: NVIDIA RTX 2070 及以上

## 代码贡献

由于作者精力有限，已经无力处理大家使用过程中产生的问题，所以关闭了 Issues 板块，但是欢迎任何对代码有积极贡献的 Pull Request！

## 开发/构建/打包流程

安装好 `yarn`, `rustc`, `wasm-pack`，克隆本仓库到任意文件夹后在终端输入以下指令即可构建：

```bash
yarn
yarn lerna run build:dev --scope "@applemusic-like-lyrics/*" # 开发构建
yarn lerna run build --scope "@applemusic-like-lyrics/*" # 发行构建
```

## 鸣谢

-   [woshizja/sound-processor](https://github.com/woshizja/sound-processor)
-   还有很多被 AMLL 使用的框架和库，非常感谢！

### 特别鸣谢

<div align="center">
<image src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg"></image>
<div>
感谢 <a href=https://jb.gg/OpenSourceSupport>JetBrains</a> 系列开发工具为 AMLL 项目提供的大力支持
</div>
</div>
