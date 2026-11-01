## 0.5.0 (2026-09-19)

### Minor Changes

- **feat(react-full):** 添加 Isolation 背景渲染器 ([#605](https://github.com/amll-dev/applemusic-like-lyrics/pull/605))

### Patch Changes

- **fix(react-full):** 只为远程资源设置 crossOrigin 属性 ([#560](https://github.com/amll-dev/applemusic-like-lyrics/pull/560))
- **chore(react-full):** 移除未使用的 SongData 类型 ([#559](https://github.com/amll-dev/applemusic-like-lyrics/pull/559))
- **style:** 格式化 SVG 和 HTML 文件 ([#580](https://github.com/amll-dev/applemusic-like-lyrics/pull/580))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- ChouChiu [@ChouChiu](https://github.com/ChouChiu)

## 0.4.2 (2026-07-09)

### Patch Changes

- **chore:** 修复 linter 警告 ([#539](https://github.com/amll-dev/applemusic-like-lyrics/pull/539))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)

## 0.4.1 (2026-05-17)

### Patch Changes

- **chore:** 更正 package.json 协议声明 ([#534](https://github.com/amll-dev/applemusic-like-lyrics/pull/534))

  仓库根目录的 LICENSE 文件为 AGPL v3.0 协议，但是 package.json 中的 `license` 字段为 `GPL-3.0`。经与原开发者确认，package.json 中的 `license` 字段有误。仓库与其所有产出的 npm 包均应为 AGPL v3 only 协议，SPDX: `AGPL-3.0-only`。因此，更正各包 `package.json` 的 `license` 字段为 `AGPL-3.0-only`。

### Contributors

- Linho [@Linho1219](https://github.com/Linho1219)

## 0.4.0 (2026-05-12)

### Minor Changes

- **refactor:** 整理核心播放器代码结构，将抽象接口部分集中到统一目录 ([#508](https://github.com/amll-dev/applemusic-like-lyrics/pull/508))

### Contributors

- Linho [@Linho1219](https://github.com/Linho1219)

## 0.3.2 (2026-04-23)

### Patch Changes

- **fix:** 在各绑定中暴露歌词优化选项 ([#492](https://github.com/amll-dev/applemusic-like-lyrics/pull/492))
- **refactor(core):** 重构平均行长度实现 ([#494](https://github.com/amll-dev/applemusic-like-lyrics/pull/494))
- **build:** 内联 CSS 中的 url ([#493](https://github.com/amll-dev/applemusic-like-lyrics/pull/493))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)

## 0.3.1 (2026-04-14)

### Patch Changes

- **ci:** 修复工作流错误导致的不成功发布 ([#483](https://github.com/amll-dev/applemusic-like-lyrics/pull/483))

### Contributors

- Linho [@Linho1219](https://github.com/Linho1219)

## 0.3.0 (2026-04-14)

### Minor Changes

- **chore:** 移除 canvas 歌词渲染器 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))

### Patch Changes

- **fix:** 修复纵向布局下封面定位错误 ([0f5805f7](https://github.com/amll-dev/applemusic-like-lyrics/commit/0f5805f7))
- **chore:** 更换工具链 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))
- **chore:** 在项目范围内启用 isolatedDeclarations ([#480](https://github.com/amll-dev/applemusic-like-lyrics/pull/480))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)
