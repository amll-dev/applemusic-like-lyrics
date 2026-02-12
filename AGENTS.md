# Apple Music-like Lyrics (AMLL) - 项目指南

## 项目概述

Apple Music-like Lyrics (AMLL) 是一个旨在复刻 iPad 版 Apple Music 歌词显示效果的组件库。这是一个 Monorepo 项目，使用 TypeScript/JavaScript 和 Rust 编写，提供 DOM、React 和 Vue 三种框架绑定。

**核心特性：**
- 🎵 逐音节歌词显示动画
- 🎨 动态流体背景效果
- ⚡ 高性能 WebGL/Canvas 渲染
- 🔧 多框架支持 (原生 DOM / React / Vue)
- 🎤 独立播放器应用 (Tauri)
- 📦 多种歌词格式支持 (LRC, YRC, QRC, LYS, TTML, ASS, ESLyric)

## 项目架构

### Monorepo 结构

```
applemusic-like-lyrics/
├── packages/
│   ├── core/           # AMLL 核心组件库 (原生 DOM)
│   ├── react/          # React 绑定
│   ├── vue/            # Vue 绑定
│   ├── react-full/     # React 完整版组件
│   ├── lyric/          # Rust 歌词解析库 (WASM)
│   ├── fft/            # Rust FFT 音频处理 (WASM)
│   ├── ttml/           # TTML 工具库
│   ├── player/         # AMLL 独立播放器 (Tauri + React)
│   ├── player-core/    # 播放器核心逻辑 (Rust)
│   ├── ws-protocol/    # WebSocket 通信协议 (Rust)
│   ├── skia-player/    # Skia 渲染播放器
│   └── docs/           # 文档站点 (Astro)
├── package.json        # 根包配置
├── pnpm-workspace.yaml # pnpm 工作区配置
├── nx.json            # Nx 构建配置
├── lerna.json         # Lerna 版本管理
├── Cargo.toml         # Rust 工作区配置
└── biome.json         # 代码风格配置
```

### 核心包说明

#### 1. `@applemusic-like-lyrics/core`
**路径**: `packages/core/`

纯 JavaScript 核心组件库，包含：
- **歌词播放器** (`lyric-player/`): 逐音节歌词显示、滚动动画
- **背景渲染** (`bg-render/`): 动态流体背景效果
- **工具函数** (`utils/`): 弹簧动画、缓动函数等

**关键文件：**
- `src/lyric-player/base.ts` - 歌词播放器基类
- `src/lyric-player/dom/` - DOM 实现
- `src/bg-render/` - 背景渲染器
- `src/utils/spring.ts` - 弹簧动画系统

#### 2. `@applemusic-like-lyrics/lyric`
**路径**: `packages/lyric/`

Rust 编写的歌词解析库，编译为 WebAssembly：
- 支持格式：LRC, YRC, QRC, LYS, TTML, ASS, ESLyric, E-QRC
- 逐音节时间戳解析
- 高性能序列化/反序列化

#### 3. `@applemusic-like-lyrics/react`
**路径**: `packages/react/`

React 组件绑定，提供：
- `LyricPlayer` 组件
- `BackgroundRenderer` 组件
- Hooks API

#### 4. `@applemusic-like-lyrics/player`
**路径**: `packages/player/`

独立桌面播放器应用：
- 基于 Tauri (Rust + React)
- 支持 WebSocket 协议通信
- 本地音乐播放
- TTML 歌词编辑预览

## 构建和开发

### 环境要求

- **Node.js**: 18+ (推荐 20+)
- **pnpm**: 10.18.3+ (必须，项目使用 workspace 协议)
- **Rust**: 1.70+ (用于 WASM 包)
- **wasm-pack**: 用于构建 WASM 包

### 安装依赖

```bash
# 安装所有依赖 (包括所有子包)
pnpm install
```

### 构建命令

```bash
# 开发构建 (所有库包)
pnpm run build:dev
# 或
nx run-many --target=build:dev --projects=tag:library

# 生产构建 (所有库包)
pnpm run build:libs
# 或
nx run-many --target=build --projects=tag:library

# 构建单个包
cd packages/core
pnpm run build

# 构建 WASM 包 (Rust)
cd packages/lyric
wasm-pack build --target web
```

### 开发模式

```bash
# 启动 core 包开发服务器
cd packages/core
pnpm run dev

# 启动 player 开发服务器
cd packages/player
pnpm run dev

# 启动文档站点
cd packages/docs
pnpm run dev
```

### 代码格式化

```bash
# 格式化所有代码
pnpm run fmt

# 格式化单个包
cd packages/core
pnpm run fmt
```

## 开发规范

### 代码风格

项目使用 **Biome** 进行代码格式化和检查：

- **缩进**: Tab (2 个空格宽度)
- **引号**: 双引号
- **行宽**: 80 字符
- **行尾**: LF (`\n`)

配置见 `biome.json`

### 包管理规范

- **必须使用 pnpm**: 每个包都设置了 `preinstall: "npx only-allow pnpm"`
- **Workspace 协议**: 内部依赖使用 `workspace:^`
- **Catalog 依赖**: 共享依赖在 `pnpm-workspace.yaml` 中定义 catalog

### 构建规范

- **Nx 缓存**: 构建任务支持缓存，配置在 `nx.json`
- **依赖顺序**: 构建时自动处理包依赖顺序 (`dependsOn: ["^build"]`)
- **并行限制**: `maxParallel: 1` 避免资源冲突

### 版本管理

- 使用 **Lerna** 进行独立版本管理 (`version: "independent"`)
- 每个包独立发布，维护自己的版本号

## 浏览器兼容性

### 最低要求

- Chromium/Edge 91+
- Firefox 100+
- Safari 9.1+

### 完整效果要求

- Chromium 120+ (支持 `mask-image` 和 `mix-blend-mode: plus-lighter`)
- Firefox 100+
- Safari 15.4+

## 性能参考

- **30FPS**: 近 5 年主流 CPU 均可
- **60FPS**: CPU 频率需 3.0GHz+
- **144FPS**: CPU 频率需 4.2GHz+

**GPU 要求 (1080p/2160p):**
- 1080p: NVIDIA GTX 10 系列+
- 4K: NVIDIA RTX 2070+

## 常用开发任务

### 添加新歌词格式支持

1. 编辑 `packages/lyric/src/` 下的解析器
2. 在 `Cargo.toml` 中添加 feature flag
3. 重新构建 WASM: `wasm-pack build`
4. 更新 core 包的类型定义

### 修改动画效果

1. 编辑 `packages/core/src/lyric-player/` 相关文件
2. 调整弹簧参数: `src/utils/spring.ts`
3. 测试: `cd packages/core && pnpm run dev`

### 发布新版本

```bash
# 使用 Lerna 发布
npx lerna publish

# 或手动构建后发布
cd packages/core
pnpm run build
npm publish
```

## 相关项目

- [AMLL TTML DB](https://github.com/Steve-xmh/amll-ttml-db) - TTML 逐音节歌词数据库
- [AMLL TTML Tool](https://github.com/Steve-xmh/amll-ttml-tool) - TTML 歌词编辑器

## 许可证

GPL-3.0
