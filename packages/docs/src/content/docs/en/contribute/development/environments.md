---
title: Development Environment Setup
---

## Required Environment

- bun ([official site](https://bun.sh/)); use the version specified in the repository `package.json` `packageManager` field when possible (currently `bun@1.3.12`)
- Rust toolchain ([official site](https://www.rust-lang.org/tools/install))
- Rust target: `wasm32-unknown-unknown`
- wasm-pack ([repository](https://github.com/rustwasm/wasm-pack))

This repository uses `bun nx ...` by default for Nx commands, so global Nx installation is not required. For local convenience, you can still install Nx globally; behavior is the same.

Node.js is only used as the runtime in npm publishing related CI steps (currently Node 24 in the publishing workflow).

### Version Check

```bash
bun --version
rustc --version
cargo --version
rustup --version
wasm-pack --version
nx --version # optional
```

To confirm the wasm target is installed, you can also run:

```bash
rustup target list --installed
```

## First-time Initialization

Run in the repository root:

```bash
bun install --frozen-lockfile
rustup toolchain install stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

If you do not have `wasm-pack`, install it first using the official method.

After setup, build all libraries once with `bun run build:libs`. If it succeeds, your environment is ready.

## Rust/WASM Related Packages

The following packages are built with `wasm-pack`:

- `@applemusic-like-lyrics/fft`
- `@applemusic-like-lyrics/lyric`
- `@applemusic-like-lyrics/ws-protocol`

All three depend on the `wasm32-unknown-unknown` target both locally and in CI.

## FAQ

### `wasm-pack: command not found`

`wasm-pack` is not installed or not in your `PATH`. Install it and verify `wasm-pack --version` runs.

### `target wasm32-unknown-unknown not found`

Run:

```bash
rustup target add wasm32-unknown-unknown
```

### Dependency installation is slow or fails

First verify your Bun version matches the lockfile expectations, then retry:

```bash
bun install --frozen-lockfile
```
