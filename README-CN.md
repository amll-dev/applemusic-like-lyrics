<div align=center>

![Apple Music-like Lyrics - A lyric page component library for Web](https://github.com/user-attachments/assets/ca6a98d4-28ea-4fb6-beec-7948f2ac87ec)

# Apple Music-like Lyrics

[English](./README.md) / 简体中文

一个基于 Web 技术制作的类 Apple Music 歌词显示组件库，同时支持[ DOM 原生](./packages/core/README.md)、[React ](./packages/react/README.md)和[ Vue ](./packages/react/README.md)绑定。

这是你能在前端系里能见到的最像 iPad Apple Music 的播放页面了。

尽管这个项目的目标并非完全模仿，但是会更好地打磨一些细节，以优于现阶段最好的歌词播放器。

**—— AMLL 生态作品 ——**

[AMLL TTML DB 逐词歌词仓库](https://github.com/amll-dev/amll-ttml-db)

[AMLL TTML Tool 逐词歌词编辑器](https://github.com/amll-dev/amll-ttml-tool)
/
[AMLL Editor 下一代逐词歌词编辑器](https://github.com/amll-dev/amll-editor)
[AMLL Page 网页播放器](https://github.com/apoint123/amll-page)


[引用了 AMLL 的项目汇总](https://github.com/amll-dev/applemusic-like-lyrics/discussions/397)

</div>

## AMLL 生态及源码结构

### 主要模块

-   [![AMLL-Core](https://img.shields.io/badge/Core-%233178c6?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/core/README.md)：AMLL 核心组件库，以 DOM 原生方式编写，提供歌词显示组件和动态流体背景组件
-   [![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/react/README.md)：AMLL React 绑定，提供 React 组件形式的歌词显示组件和动态流体背景组件
-   [![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/vue/README.md)：AMLL Vue 绑定，提供 Vue 组件形式的歌词显示组件和动态流体背景组件
-   [![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/lyric/README.md)：AMLL 歌词解析模块，提供对 LyRiC, YRC, QRC, Lyricify Syllable 各种歌词格式的解析和序列化支持

## 浏览器兼容性提醒

本组件框架最低要求使用以下浏览器或更新版本：

-   Chromuim/Edge 91+
-   Firefox 100+
-   Safari 9.1+

完整呈现组件所有效果需要使用以下浏览器或更新版本：

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

## 开发/构建/打包流程

### 前置依赖

-   [Node.js](https://nodejs.org/)
-   [Bun](https://bun.sh/)
-   [Rust 工具链](https://rustup.rs/)
-   [wasm-pack](https://rustwasm.github.io/wasm-pack/)

### 构建组件库

克隆本仓库后，在项目根目录执行以下指令：

```bash
# 安装依赖
bun install

# 生产构建所有库包
bun run build:libs
```

### 构建单个包

```bash
# 示例：仅构建 @applemusic-like-lyrics/core
bunx nx run @applemusic-like-lyrics/core:build

# 示例：开发构建 @applemusic-like-lyrics/lyric
bunx nx run @applemusic-like-lyrics/lyric:build:dev
```

## 鸣谢

-   [woshizja/sound-processor](https://github.com/woshizja/sound-processor)
-   [FFmpeg](http://ffmpeg.org/)
-   还有很多被 AMLL 使用的框架和库，非常感谢！

### 特别鸣谢

<div align="center">
<image src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg"></image>
<div>
感谢 <a href=https://jb.gg/OpenSourceSupport>JetBrains</a> 系列开发工具为 AMLL 项目提供的大力支持
</div>
</div>
