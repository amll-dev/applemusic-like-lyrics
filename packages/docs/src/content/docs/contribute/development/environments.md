---
title: 开发环境配置
---

## 必要环境

- bun（[官网](https://bun.sh/)），建议版本与仓库 `package.json` 中 `packageManager` 一致（当前为 `bun@1.3.12`）
- Rust toolchain（[官网](https://www.rust-lang.org/tools/install)）
- Rust target：`wasm32-unknown-unknown`。
- wasm-pack（[仓库](https://github.com/rustwasm/wasm-pack)）

本仓库默认使用 `bun nx ...` 执行 Nx 命令，不要求全局安装 Nx。为了本地便利开发，你也可以全局安装 Nx，效果是相同的。

Node.js 仅在 npm 发布相关 CI 步骤中作为运行时使用（当前发布工作流为 Node 24）。

### 版本自查

```bash
bun --version
rustc --version
cargo --version
rustup --version
wasm-pack --version
nx --version # 可选
```

如需确认 wasm 目标已安装，可额外执行：

```bash
rustup target list --installed
```

## 首次初始化

在仓库根目录执行：

```bash
bun install --frozen-lockfile
rustup toolchain install stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

如果你没有安装 `wasm-pack`，可按官方方式安装后再继续。

完成后，执行一次构建所有包：`bun run build:libs`，若成功构建完成说明环境无误，可以开始工作。

## 与 Rust/WASM 相关的包

以下包使用 `wasm-pack` 构建：

- `@applemusic-like-lyrics/fft`
- `@applemusic-like-lyrics/lyric`
- `@applemusic-like-lyrics/ws-protocol`

这三个包在本地和 CI 中都依赖 `wasm32-unknown-unknown` target。

## 常见问题

### `wasm-pack: command not found`

说明 `wasm-pack` 未安装或不在 `PATH`。请先安装并确认 `wasm-pack --version` 可执行。

### `target wasm32-unknown-unknown not found`

执行：

```bash
rustup target add wasm32-unknown-unknown
```

### 依赖安装慢或失败

优先确认 Bun 版本与锁文件一致，再重试：

```bash
bun install --frozen-lockfile
```
