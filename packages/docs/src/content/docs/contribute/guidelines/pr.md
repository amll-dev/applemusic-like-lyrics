---
title: PR 流程
---

## 基本要求

- 所有改动通过 PR 合入 `main`。
- PR 进入 Ready for Review 后会触发校验工作流：`.github/workflows/pr-release-check.yaml`。
- 通过校验后再合并。

## PR 校验包含什么

工作流会做两类检查：

1. `Release metadata`
  - 判断本次 PR 是否需要 release plan。
  - 在需要时执行 `bun run release:plan:check --base=... --head=...`。

2. `Build libs`
  - 安装 Bun 依赖（`bun install --frozen-lockfile`）。
  - 安装 Rust `stable`、`wasm32-unknown-unknown`、`wasm-pack@v0.13.1`。
  - 执行 `bun run ci:build:libs`。

## 什么时候需要 release plan

检查逻辑来自 `.github/scripts/check-release-requirements.mjs`：

- 如果改动全部是文档/CI/基础设施等忽略范围，PR 必须打上 `no-release` label。
- 否则，即改动包含“非忽略文件”，必须有 release plan（存放于 `.nx/version-plans/`）。
- `no-release` 只能用于“全部改动都在忽略范围”的 PR。

## 创建 release plan（本地）

可在仓库根目录执行：

```bash
# 只为本次 touched 项目生成计划（默认行为）
bun nx release plan
```

然后根据提示选择各包变动幅度并输入 changelog。

命令会在 `.nx/version-plans/` 下生成计划文件，请将该文件一并提交。

## 关于合并

目前设置了分支保护规则，仅允许 squash merge，以保持主分支洁净。
