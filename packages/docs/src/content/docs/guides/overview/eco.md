---
title: 生态
---

经过一段时间的发展，AMLL 建立起了一个围绕逐字歌词的开源生态，包含逐字歌词库、编辑器、音乐播放器等。

## 第一方生态

第一方生态是指在 GitHub 上以 [amll-dev](https://github.com/amll-dev/) 组织下的仓库。以下项目的内容与文档均各自独立维护，问题反馈请至各仓库处理。

### AMLL TTML Database

[AMLL TTML Database](https://github.com/amll-dev/amll-ttml-db) 是一个高质量的开放逐字歌词数据库。其中的歌词均由社区贡献并经过审核，以 [CC0-1.0](https://github.com/amll-dev/amll-ttml-db/blob/main/LICENSE) 协议公开。

如果你正在制作音乐播放器，可以将其作为歌词源。你也可以制作逐字歌词并提交到歌词库中。有关提交与使用的相关说明，请转到其 [仓库 wiki](https://github.com/amll-dev/amll-ttml-db/wiki)。

### AMLL TTML Tool

[AMLL TTML Tool](https://github.com/amll-dev/amll-ttml-tool) 是基于 React 编写的逐字歌词编辑器，涵盖歌词内容编辑、打轴等功能。歌词库中大部分逐字歌词均使用此工具制作。

![AMLL TTML Tool 截图](https://github.com/user-attachments/assets/929eefee-ebda-43db-ad04-c0f099077053)

其部署在 <https://tool.amll.dev/> 上，可以直接访问并开始使用。

### AMLL Editor

[AMLL Editor](https://github.com/amll-dev/amll-editor) 是基于 Vue 编写的下一代逐字歌词编辑器，仍处于早期开发阶段。相比 AMLL TTML Tool 增加了查找替换等更便利的功能。

其部署在 <https://editor.amll.dev/> 上，可以直接访问并开始使用。使用文档位于其 [仓库 wiki](https://github.com/amll-dev/amll-editor/wiki)。

### AMLL Player

[AMLL Player](https://github.com/amll-dev/amll-player) 是基于 AMLL 的音乐播放器。可以作为本地音乐播放器使用，也可以配合 WS protocol 等功能搭配其他音乐软件使用。

## 第三方生态推荐

下面列举部分集成了 AMLL 的优秀第三方应用。得益于 GPL 协议的传染性，这些应用均以 GPL 协议开放源代码并免费使用。我们也为此建立了一个 [GitHub discussion](https://github.com/orgs/amll-dev/discussions/397)。

### SPlayer

[SPlayer](https://github.com/imsyy/SPlayer) 是一款基于 Vue 构建的第三方网易云音乐客户端。

![SPlayer 宣传图](https://raw.githubusercontent.com/imsyy/SPlayer/dev/screenshots/SPlayer.jpg)

## 沿革

AMLL 诞生于 [2022 年 12 月](https://github.com/amll-dev/applemusic-like-lyrics/commit/88a3c1d)，起初是基于 [BetterNCM](https://std.microblock.cc/betterncm) 框架的网易云音乐 PC 客户端插件，用于美化网易云 UI 中的歌词。

![早期截图](https://raw.githubusercontent.com/amll-dev/applemusic-like-lyrics/88a3c1d60d09a0e34debe3509fdcc4fac4f54e00/assets/demo0.png)

2023 年 7 月，AMLL 发布了第一个 npm 包 [@applemusic-like-lyrics/core@0.0.1](https://www.npmjs.com/package/@applemusic-like-lyrics/core/v/0.0.1)。

由于网易云客户端中的诸多限制与性能问题，[2023 年 8 月](https://github.com/amll-dev/applemusic-like-lyrics/commit/28d3f6f)，AMLL Player 开始开发。它通过一个基于 WebSocket 的协议与客户端通信，将歌词展示转变成独立应用，不再受限于网易云客户端。

2024 年 2 月，插件发布了最终版本 [v3.1.0](https://github.com/amll-dev/applemusic-like-lyrics/releases/tag/v3.1.0)，至此结束插件版本的开发与维护。后续一段时间里 AMLL 插件部分的 UI 开始整理为可复用的组件库。

2024 年 9 月，原插件中的组件发布为 [@applemusic-like-lyrics/react-full@0.2.0-alpha.0](https://www.npmjs.com/package/@applemusic-like-lyrics/react-full/v/0.2.0-alpha.0)。

2026 年 4 月，AMLL Player 从主仓库 [剥离](https://github.com/amll-dev/applemusic-like-lyrics/pull/455) 到 [独立仓库](https://github.com/amll-dev/amll-player) 进行维护；并建立了自动化版本发布工作流，通过 GitHub Actions 发布了第一个 provenace 包 [@applemusic-like-lyrics/core@0.3.0](https://www.npmjs.com/package/@applemusic-like-lyrics/core/v/0.3.0)。

AMLL 仍在积极开发中。也期待你的贡献！转到 [贡献指南](/contribute) 以查阅相关文档。
