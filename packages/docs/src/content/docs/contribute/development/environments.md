---
title: 开发环境配置
---

## 必要环境

- Node.js 22+（[官网](https://nodejs.org/)）
- bun（[官网](https://bun.sh/)）
- Rust toolchain（[官网](https://www.rust-lang.org/tools/install)）
- Rust target：`wasm32-unknown-unknown`。
- wasm-pack（[仓库](https://github.com/rustwasm/wasm-pack)）

另外，建议全局安装 Nx。全局安装后 Nx 相关命令直接为 `nx ...`，否则使用 `bunx nx ...`。此后不再赘述。

### 版本自查

```bash
node --version
bun --version
rustc --version
cargo --version
rustup --version
wasm-pack --version
nx --version
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

## 本地开发常用命令

```bash
# 构建所有 library
bun run build:libs

# 构建某个包
nx build core

# 仅启动文档站
nx dev docs

# 构建文档站
nx build docs
```

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

优先确认 Node/bun 版本与锁文件一致，再重试：

```bash
bun install --frozen-lockfile
```
