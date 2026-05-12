---
title: Development Environment Setup
---

## Required Environment

- pnpm ([official site](https://pnpm.io/)); use the version specified in the repository `package.json` `packageManager` field when possible (currently `pnpm@10.15.1`)

This repository uses `pnpm nx ...` by default for Nx commands, so global Nx installation is not required. For local convenience, you can still install Nx globally; behavior is the same.

Node.js is only used as the runtime in npm publishing related CI steps (currently Node 24 in the publishing workflow).

### Version Check

```bash
pnpm --version
nx --version # optional
```

## First-time Initialization

Run in the repository root:

```bash
pnpm install --frozen-lockfile
```

After setup, build all libraries once with `pnpm run build:libs`. If it succeeds, your environment is ready.

### Dependency installation is slow or fails

First verify your pnpm version matches the lockfile expectations, then retry:

```bash
pnpm install --frozen-lockfile
```
