---
title: 开发环境配置
---

## 必要环境

- pnpm（[官网](https://pnpm.io/)），建议版本与仓库 `package.json` 中 `packageManager` 一致（当前为 `pnpm@11.1.0`）

本仓库默认使用 `pnpm nx ...` 执行 Nx 命令，不要求全局安装 Nx。为了本地便利开发，你也可以全局安装 Nx，效果是相同的。

Node.js 仅在 npm 发布相关 CI 步骤中作为运行时使用（当前发布工作流为 Node 24）。

### 版本自查

```bash
pnpm --version
nx --version # 可选
```

## 首次初始化

在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
```

完成后，执行一次构建所有包：`pnpm run build:libs`，若成功构建完成说明环境无误，可以开始工作。

### 依赖安装慢或失败

优先确认 pnpm 版本与锁文件一致，再重试：

```bash
pnpm install --frozen-lockfile
```
