## 0.6.0 (2026-09-19)

### Minor Changes

- **feat(core):** 添加 Isolation 背景渲染器 ([#604](https://github.com/amll-dev/applemusic-like-lyrics/pull/604))

  新增 `IsolationRenderer`，从封面提取四个主色驱动 WebGL1 四点流动渐变着色器，支持 Light Wave 明度波动与 Dithering 去色带；`BackgroundRender` 新增 `getRenderer()` 以访问渲染器特有的选项

- **feat(react-full):** 添加 Isolation 背景渲染器 ([#605](https://github.com/amll-dev/applemusic-like-lyrics/pull/605))
- **refactor(core):** 重构间奏点实现并改善视觉效果 ([#610](https://github.com/amll-dev/applemusic-like-lyrics/pull/610))
- refactor(core)!: 从基类提取了歌词行后处理逻辑 ([#569](https://github.com/amll-dev/applemusic-like-lyrics/pull/569))

  `setOptimizeOptions` 的行为已发生变化，现在将会自动重建歌词行数组和刷新视图，不再需要手动重新设置歌词行数组

  提供了一个新的 `updateLyricProcessConfig` 和 `setLyricProcessConfig` API 用于批量设置歌词行优化选项和掩码设置以减小刷新开销

- refactor(core)!: 完善歌词优化的边界处理 ([#583](https://github.com/amll-dev/applemusic-like-lyrics/pull/583))

  * 现在 `setLyricLines` 会在遇到非法的时间戳抛出错误
  * `convertExcessiveBackgroundLines` 已弃用，该选项不再有效果

- refactor(core)!: 优化时间线推导 ([#594](https://github.com/amll-dev/applemusic-like-lyrics/pull/594))

  视觉效果已发生变化，现在播放完毕的行将不再熄灭以维持可读性，同时和 Apple Music 的行为保持一致

- refactor(core)!: 移除持续性的跳转状态 ([#595](https://github.com/amll-dev/applemusic-like-lyrics/pull/595))

  `LyricPlayerBase.setIsSeeking` 现已置为空方法，并引入一个默认开启的自动跳转状态推导作为替代


### Patch Changes

- **fix(core):** 逐字音译在有 Ruby 时也居左 ([#614](https://github.com/amll-dev/applemusic-like-lyrics/pull/614))
- **fix(core):** 修复 ruby base 包含多个 CJK 字符时意外换行 ([#564](https://github.com/amll-dev/applemusic-like-lyrics/pull/564))
- **fix(core):** 修复在同时有 ruby 和逐字音译时显示错误 ([#566](https://github.com/amll-dev/applemusic-like-lyrics/pull/566))
- **fix(core):** 修复前置背景人声的样式 ([#571](https://github.com/amll-dev/applemusic-like-lyrics/pull/571))
- **fix(core):** 修复具有 ruby 的音节的空格丢失问题 ([#573](https://github.com/amll-dev/applemusic-like-lyrics/pull/573), [#555](https://github.com/amll-dev/applemusic-like-lyrics/issues/555))
- **fix(core):** 音节有空格且具有逐字音译时，将音节和音译按空格拆分并按索引分配 ([#579](https://github.com/amll-dev/applemusic-like-lyrics/pull/579))
- **fix(core):** 修复文字底部边缘被裁剪 ([#584](https://github.com/amll-dev/applemusic-like-lyrics/pull/584))
- **fix(core):** 保留异步封面切换期间的 Mesh 背景 ([#578](https://github.com/amll-dev/applemusic-like-lyrics/pull/578))
- **fix(core):** 修复底栏的视觉效果以匹配歌词行 ([#600](https://github.com/amll-dev/applemusic-like-lyrics/pull/600))
- **perf(core):** 优化 DOM 渲染性能 ([#563](https://github.com/amll-dev/applemusic-like-lyrics/pull/563))
- **refactor(core):** 将歌词行内嵌 div 替换为 span 并清理未用属性 ([#616](https://github.com/amll-dev/applemusic-like-lyrics/pull/616))
- **refactor(core):** 使用 Apple Music 的滚动重置逻辑 ([#617](https://github.com/amll-dev/applemusic-like-lyrics/pull/617))
- **refactor(core):** 内聚类状态，合并多个不必要的纯函数并消除伪解耦 ([#562](https://github.com/amll-dev/applemusic-like-lyrics/pull/562))
- **refactor(core):** 从基类中拆分出弹簧计算逻辑 ([#568](https://github.com/amll-dev/applemusic-like-lyrics/pull/568))
- **refactor(core):** 从基类拆分出并优化滚动逻辑 ([#570](https://github.com/amll-dev/applemusic-like-lyrics/pull/570))
- **refactor(core):** 从基类拆分出并优化时间线推导逻辑 ([#572](https://github.com/amll-dev/applemusic-like-lyrics/pull/572))
- **refactor(core):** 从基类拆分出并优化排版逻辑 ([#574](https://github.com/amll-dev/applemusic-like-lyrics/pull/574))
- **refactor(core):** 从基类分离 dom 实现的底栏和间奏点 ([#588](https://github.com/amll-dev/applemusic-like-lyrics/pull/588))
- **refactor(core):** 统一时间单位 ([#589](https://github.com/amll-dev/applemusic-like-lyrics/pull/589))
- **refactor(core):** 拆分对齐焦点状态机 ([#590](https://github.com/amll-dev/applemusic-like-lyrics/pull/590))
- **refactor(core):** 统一歌词行与底栏的视觉状态推导 ([#591](https://github.com/amll-dev/applemusic-like-lyrics/pull/591))
- **refactor(core):** 提取 dom 播放器的上浮动画逻辑 ([#607](https://github.com/amll-dev/applemusic-like-lyrics/pull/607))
- **refactor(core):** 提取 dom 播放器的强调动画逻辑 ([#608](https://github.com/amll-dev/applemusic-like-lyrics/pull/608))
- **refactor(core):** 提取 dom 播放器的遮罩动画逻辑 ([#609](https://github.com/amll-dev/applemusic-like-lyrics/pull/609))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- ChouChiu [@ChouChiu](https://github.com/ChouChiu)
- Claude Opus 5
- Luorix [@LuorixDev](https://github.com/LuorixDev)
- MoYingJi [@MoYingJi](https://github.com/MoYingJi)

## 0.5.2 (2026-07-09)

### Patch Changes

- **refactor(core):** 将点击相关事件和样式由歌词行上移至歌词组 ([#538](https://github.com/amll-dev/applemusic-like-lyrics/pull/538))
- **chore(core):** 一些简单的代码优化避免样式重新计算 ([#540](https://github.com/amll-dev/applemusic-like-lyrics/pull/540))
- **chore(core):** 简单优化一点Mesh着色器的代码 ([#558](https://github.com/amll-dev/applemusic-like-lyrics/pull/558))
- **chore:** 修复 linter 警告 ([#539](https://github.com/amll-dev/applemusic-like-lyrics/pull/539))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho
- SteveXMH [@Steve-xmh](https://github.com/Steve-xmh)

## 0.5.1 (2026-05-17)

### Patch Changes

- **fix:** 修复含对唱时歌词错误提前导致的多行高亮 ([#521](https://github.com/amll-dev/applemusic-like-lyrics/pull/521))
- **refactor:** 引入歌词组来包装主歌词和背景人声 & 前置背景人声 ([#531](https://github.com/amll-dev/applemusic-like-lyrics/pull/531))
- **chore:** 更正 package.json 协议声明 ([#534](https://github.com/amll-dev/applemusic-like-lyrics/pull/534))

  仓库根目录的 LICENSE 文件为 AGPL v3.0 协议，但是 package.json 中的 `license` 字段为 `GPL-3.0`。经与原开发者确认，package.json 中的 `license` 字段有误。仓库与其所有产出的 npm 包均应为 AGPL v3 only 协议，SPDX: `AGPL-3.0-only`。因此，更正各包 `package.json` 的 `license` 字段为 `AGPL-3.0-only`。
- **chore(core):** 优化类型定义 ([#519](https://github.com/amll-dev/applemusic-like-lyrics/pull/519))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)

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
