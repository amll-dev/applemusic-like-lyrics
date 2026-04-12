---
title: 发布包
---

## 发布方式

npm 包发布通过 GitHub Actions 手动触发，工作流文件：

- `.github/workflows/publish-libs.yaml`

触发方式为 `workflow_dispatch`，并带 `mode` 参数：

- `dry-run`：仅演练版本与发布流程，不真正发布。
- `publish`：执行真实发版并推送 release commit/tag。

## 发布前置条件

- 必须从 `main` 分支触发（工作流内有强校验）。
- `.nx/version-plans/` 下必须存在 release plan 文件。
- 仓库 PR 校验应已通过。

## 工作流执行步骤摘要

1. 校验当前分支是 `main`。
2. 安装依赖与发布环境（Node 24、Bun、Rust、wasm-pack）。
3. 执行 `bunx nx release --dry-run`。
4. 当 `mode=publish` 时：
  - 执行 `bunx nx release --skip-publish` 创建 release commit 与 tags。
  - `git push origin HEAD:main --follow-tags`。
  - 执行 `bunx nx release publish` 发布到 npm。

## 推荐发布流程

1. 先手动触发一次 `mode=dry-run`，确认版本变更和产物正常。
2. 再触发 `mode=publish` 完成正式发布。
3. 发布后检查 npm 与 GitHub tags 是否符合预期。

## 注意事项

- 本仓库使用 Nx release groups，部分包是固定版本（如 `core-bundle`），部分包是独立版本（`libraries`）。
- 发布流程依赖 OIDC trusted publishing 运行时要求，工作流已内置 Node/NPM 版本校验。
