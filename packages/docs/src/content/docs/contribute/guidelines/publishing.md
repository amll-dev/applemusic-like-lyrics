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

- `publish` 必须从 `main` 分支触发，`dry-run` 可以从其他分支触发。
- `.nx/version-plans/` 下必须存在 release plan 文件。

## 工作流执行步骤摘要

1. 当 `mode=publish` 时，强校验当前分支必须是 `main`。
2. 安装依赖与发布环境（Bun、Node 24、Rust、wasm-pack）。
3. 校验 trusted publishing 运行时（Node 版本等）。
4. 执行 `bun install --frozen-lockfile`。
5. 执行 `npx nx release --skip-publish --preid alpha` 创建 release commit 与 tags。
6. 格式化 `package.json` 并 amend release commit。
7. 当 `mode=publish` 时：
  - `git push origin HEAD:main --follow-tags`。
  - 调整发布前清单（强制 npm 发布器、准备 npm manifests）。
  - 执行 `npx nx release publish --excludeTaskDependencies` 发布到 npm。

## 推荐发布流程

1. 先手动触发一次 `mode=dry-run`，确认版本变更与发布前检查正常（该模式不会推送 tags，也不会发布到 npm）。
2. 再触发 `mode=publish` 完成正式发布。
3. 发布后检查 npm 与 GitHub tags 是否符合预期。
