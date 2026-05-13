## 0.5.0 (2026-05-12)

### Minor Changes

- **refactor:** 整理核心播放器代码结构，将抽象接口部分集中到统一目录 ([#508](https://github.com/amll-dev/applemusic-like-lyrics/pull/508))
- **refactor:** 整理核心播放器抽象类中时间线、滚动与单行布局部分的结构与状态管理 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))

### Patch Changes

- **fix:** 修复 setCurrentTime 在提供 isSeek 标志时，实际排版未遵守标志导致布局异常漂移的问题 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))
- **fix:** 修复在同一行时间内拖拽进度条时逐字动画不同步的问题 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))
- **fix:** 修复暂停状态下点击行跳转时仍播放逐字动画的问题 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))

### Contributors

- Linho [@Linho1219](https://github.com/Linho1219)

## 0.4.2 (2026-05-01)

### Patch Changes

- **feat(core):** 平衡行长度时优先在标点处换行 ([#503](https://github.com/amll-dev/applemusic-like-lyrics/pull/503))
- **fix:** 修复背景行注音高度错误 ([#497](https://github.com/amll-dev/applemusic-like-lyrics/pull/497))
- **fix(core):** 修正平衡行长度时的行宽度计算 ([#502](https://github.com/amll-dev/applemusic-like-lyrics/pull/502))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)

## 0.4.1 (2026-04-23)

### Patch Changes

- **fix:** 在各绑定中暴露歌词优化选项 ([#492](https://github.com/amll-dev/applemusic-like-lyrics/pull/492))
- **fix(vue):** 修复掩码模式错误的类型 ([#496](https://github.com/amll-dev/applemusic-like-lyrics/pull/496))
- **refactor(core):** 重构平均行长度实现 ([#494](https://github.com/amll-dev/applemusic-like-lyrics/pull/494))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)

## 0.4.0 (2026-04-14)

### Minor Changes

- **chore:** 移除 canvas 歌词渲染器 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))

### Patch Changes

- **refactor:** 重构核心库测试组织模式 ([3db83c93](https://github.com/amll-dev/applemusic-like-lyrics/commit/3db83c93))
- **docs:** 修正 optimize-lyric.ts 和 OptimizeLyricOptions 里 cleanUnintentionalOverlaps 的文档和注释 ([75a8c0bb](https://github.com/amll-dev/applemusic-like-lyrics/commit/75a8c0bb))
- **chore:** 更换工具链 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))
- **chore:** 在项目范围内启用 isolatedDeclarations ([#480](https://github.com/amll-dev/applemusic-like-lyrics/pull/480))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)
- MoYingJi [@MoYingJi](https://github.com/MoYingJi)
