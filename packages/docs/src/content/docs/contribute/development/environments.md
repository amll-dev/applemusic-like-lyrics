---
title: 开发环境配置
---

## 必要环境

- pnpm v12+（[官网](https://pnpm.io/)）
- Node.js v26+（[官网](https://nodejs.org/)）

本仓库使用 monorepo 管理工具 Nx。默认使用 `pnpm nx ...` 执行 Nx 命令，不要求全局安装 Nx。为了本地便利开发，你也可以全局安装 Nx，效果是相同的。

### 版本自查

```bash
pnpm --version
nx --version # 可选
```

## 首次初始化

在仓库根目录执行：

```bash
pnpm i
```

完成后，执行一次构建所有包：`pnpm run build:libs`，若成功构建完成说明环境无误，可以开始工作了。
