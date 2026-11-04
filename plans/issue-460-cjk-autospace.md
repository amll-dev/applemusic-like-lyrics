# Issue #460：CJK 与西文自动间距实现计划

状态：功能、文档及 Chromium 真实浏览器验收完成；Firefox、Safari/WKWebView 和不支持原生属性的旧浏览器尚未实测。

- 需求：[自动为 CJK 与英文单词之间添加适当间距](https://github.com/amll-dev/applemusic-like-lyrics/issues/460)，包含两条评论与原始对照截图。
- 计划分支：`plan/issue-460-cjk-autospace`。
- 基线：从已 fetch 的 `origin/main`（`6911611dd`，用户 fork 的主线）创建，不叠加此前的背景歌词功能分支。
- 本次交付：渲染层间距、断行/遮罩同步、core/React/Vue 开关、回归测试、中英文文档和发布记录；仅创建本地提交，不自动推送。

## 1. 结论与范围

采用**渲染层自动间距**：识别原文中的混排边界，用布局间距呈现；不向歌词插入空格，不改变词的时间戳。不能仅添加 `text-autospace: normal`，也不能调用 pangu 一类字符串替换后交回歌词解析或分词流程。

默认开启，提供关闭入口，兼顾 Issue 评论中作者刻意保持紧排的情况。间距先采用 `0.125em`；这是本方案的初始设计值，不声称等于 Apple Music 的精确参数，最终按 Issue 截图、字体和设备验收。

覆盖：

- 汉字、平假名、片假名、韩文与拉丁字母、半角数字之间的双向边界。
- 逐字歌词、非逐字歌词，主行、背景行、对唱行，以及翻译、整行音译。
- 单词内部、不同时间词之间、英文音节分组之间、强调字形之间的边界。
- 带 `ruby`、`romanWord` 的词：正文间距不能取自注音或音译文字；注音仍与原词对齐。
- Issue 提到的数字与波浪号：将 `~`、`〜`、`～` 与数字相邻的情况纳入显式规则和验收，不假设浏览器会处理。

不做：歌词文件清洗、TTML/LRC 导出改写、通用标点排版引擎、英文词间距调整、背景歌词激活行为改动、React Full 新增持久化设置页。

## 2. 调研基线与证据

### 2.1 代码约束

| 位置 | 已观察的行为 | 实现影响 |
| --- | --- | --- |
| [`lyric-line.ts`](../packages/core/src/lyric-player/dom/lyric-line.ts) 的 `rebuildElement`、`createWord`、`buildWord` | 非逐字主行和副行使用 `textContent`；逐字主行按词、分组、强调字符创建嵌套节点 | 必须处理同节点内部和跨节点边界，不能只检查相邻 `LyricWord` |
| [`lyric-player.module.css`](../packages/core/src/styles/lyric-player.module.css) 的 `.lyricMainLine` | 子 `span` 使用 `inline-block`；强调分组有 `1em` padding 与 `-1em` margin；注音使用 flex | 原生自动间距不跨这些原子盒；新增间距不能覆盖既有负 margin，也不能破坏上浮与辉光空间 |
| [`lyric-split-words.ts`](../packages/core/src/utils/lyric-split-words.ts) | 空白参与分组、拆词和时间分配；已有音译、注音处理 | 不把渲染间距伪装为空格词，不为本功能改变时间分配 |
| [`is-cjk.ts`](../packages/core/src/utils/is-cjk.ts) | 当前判定包含较宽的 `U+0800–U+9FFC` 范围 | 不直接用它定义新的排版字符分类，也不顺便修改其现有消费者 |
| [`line-balancer.ts`](../packages/core/src/utils/line-balancer.ts) | 动态路径累加节点宽度及 margin；非动态路径逐段 Canvas 测量，再用整行 Range 比例校准；重建时恢复纯文本 | 局部新增间距不能用整行比例摊匀；非动态重建也必须保留呈现片段 |
| [`lyric-line-break.ts`](../packages/core/src/utils/lyric-line-break.ts) | 通过前缀宽度计算候选断行 | 要区分字形宽度与边界间距，避免换行后行首保留自动间距 |
| `LyricLineEl.measureWords`、`computeMaskSignature`、`updateMaskImageSync` | 逐词遮罩使用测量尺寸，并按尺寸、行宽等签名复用 | 开关变化不能只改 CSS；须同步清理断行缓存、遮罩签名和相关尺寸状态 |
| [`line-brightness.ts`](../packages/core/src/lyric-player/dom/line-brightness.ts) | 暗层由主行克隆，并随结构、几何变化更新 | 复用已有副本同步机制，不能只改变亮层间距 |

### 2.2 已执行的浏览器实验

环境：Windows / Edge `156.0.4314.58`，字号 `48px`。已启动仓库的 core playground，并通过 Vite 加载真实 `LyricPlayer` 与 `LyricLineEl`；未替换渲染器或模拟布局。

下表为切换前后的宽度增量，不是字形绝对宽度；实际数值受字体影响。

| 实验 | 仅启用原生 `text-autospace: normal` | 临时在真实词 wrapper 上补 `0.125em` 间距 |
| --- | --- | --- |
| 连续文本或普通 inline：`中AMLL2026文` | 增加 `12px` | 未试验 |
| 独立 inline-block：`中` / `AMLL2026` / `文` | 增加 `0px` | 未试验 |
| 真实逐字节点：`し` / `て` / `take` / `2` / `だ` / `よ` | 增加 `0px` | 两处边界合计增加 `12px` |
| 真实逐字节点：`鳴らせ君の3〜6マス` | 增加 `0px` | 四处边界合计增加 `24px` |
| 真实单个混排词：`中AMLL2026文` | 增加 `12px` | 未试验词内呈现片段 |
| 真实逐字节点，已有空格：`中 AMLL 文` | 增加 `0px` | 不补间距，增加 `0px` |
| 连续文本：`3~6`、`3〜6`、`3～6` | 均增加 `0px` | 未试验 |

另外观察到：该浏览器支持 `normal`、`no-autospace`，不支持 `auto`、`ideograph-alpha ideograph-numeric` 和 `punctuation`。不能把属性名支持等同于所有值和 DOM 结构均生效。

实验只证明原生方案的缺口与 wrapper 间距的可行性；尚未证明完整算法、断行、动画或 Safari/Firefox 行为。临时样例与样式只存在于浏览器内存，不是功能实现。

参考：

- [MDN：text-autospace](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-autospace)
- [MDN 浏览器兼容数据](https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-autospace.json)：不同浏览器、不同关键字的支持存在差异。
- [CSS Text Level 4：text-autospace](https://drafts.csswg.org/css-text-4/#propdef-text-autospace)

## 3. 设计决策

### 3.1 单一字符边界规则

新增一个 core 内部工具，例如 `packages/core/src/utils/text-autospace.ts`，负责原文边界分析；动态与非动态呈现共用规则，不新增第三方 pangu 依赖。

- 按 grapheme cluster 分析，复用已有 `Intl.Segmenter` 使用方式；兼容路径至少按码点遍历，组合附加符不得成为独立间距边界。
- CJK 分类明确覆盖 Han、Hiragana、Katakana、Hangul；西文分类区分拉丁字母、数字与全角形式。补充平面汉字、半角片假名、重音字母须有用例。
- CJK 与西文/数字直接相邻时加一个间距；`take2`、`AMLL2026` 内部不加。
- 数字与三种波浪号直接相邻时加一个间距；不扩展成所有标点两侧自动加宽。
- 任何已有空白都阻断自动补间距，包括普通空格、NBSP、窄空格和全角空格。不替换、不叠加；保留现有歌词优化器本来具有的规范化行为。
- Emoji、ZWJ 序列、变体选择符、全角字母数字及普通 CJK 标点不因本功能被拆开或额外加宽。
- 输出原文偏移和边界信息，不输出改写后的歌词，不携带新的时间信息。

### 3.2 呈现片段与原词分离

保持 `LyricWord`、`ruby`、`romanWord` 和 `splittedWords` 的时间语义不变。将边界映射到实际呈现位置：

1. 不同分组之间：作用于相邻 wrapper 的布局间距，叠加而非替换原有负 margin。
2. 同分组内不同时间词之间：作用于实际词盒；不能把一个混合分组只当成首尾两个字符。
3. 单个词内部：仅在必要处创建保留原文的呈现片段；强调模式复用已有 grapheme 节点。不拆出额外的定时词或动画。
4. 注音/逐词音译：以 `word.word` 的正文确定边界，将外部间距放在合适的词盒上，不把 annotation 的 `textContent` 当成正文，也不拉散注音居中关系。
5. 非逐字主行、翻译、整行音译：共用保留原文的文本片段构建函数；无混排边界时保留纯文本快速路径。逐词音译和 ruby 自身如含混排，独立应用其文本规则，不能与正文跨层配对。

使用独立样式类标识呈现片段，避免误命中现有所有 `span` 的 margin/padding 选择器。布局间距使用 margin 等几何属性，不用 `::before { content: " " }` 或可复制的空格字符。

在受控歌词文本上明确设置 `text-autospace: no-autospace`，防止浏览器原生间距与自定义间距重复。无此属性支持的旧浏览器仍使用同一套自定义布局，而不是静默缺失功能。

### 3.3 默认与关闭入口

拟定接口：core 提供 `setEnableTextAutospace(enable = true)`，React/Vue 对应 `enableTextAutospace?: boolean`，默认开启。沿用已有 `enableScale`、`enableBlur` 的声明、绑定及默认恢复方式，不引入配置对象或多档模式。

开关由 `LyricPlayerBase` 持有，DOM 实现处理重建。重复赋相同值直接返回；实际切换时：

- 更新当前已构建主行和背景行；未构建行在首次显示时使用最新状态。
- 重置断行缓存、遮罩签名和阻止重测的尺寸缓存；即使容器宽高没变，也必须更新。
- 重新测量、平衡断行并同步明暗副本，不依赖下一次 ResizeObserver 恰好触发。
- 不重置播放进度、不改变歌词源数据、不重建时间轴控制逻辑。

React Full 继续使用默认行为；检查其预制播放器调用，避免新增可选属性导致类型或默认值回退错误，不新增独立设置存储。

### 3.4 断行与遮罩使用同一份宽度

- 将边界间距作为显式布局信息传入测量与断行过程，而不是把它混入文本长度。
- 动态路径计入外部间距；内部呈现片段的宽度由实际 DOM 给出。正文偏移仍从正文取得，排除注音文字。
- 非动态路径在既有 Canvas 字形宽度基础上计入对应位置的间距，不把局部间距通过整行校准比例摊到所有字上。`resetDOM`、`applyBreaks` 共用文本片段构建函数，不能一轮平衡后退回纯 `textContent`。
- 给断行候选提供“行首可丢弃的边界间距”信息；计算某段行宽时扣除其起点间距，实际插入 `<br>` 后也移除相同间距。两端不增加额外留白，不能靠循环试错校准。
- 只有几何发生变化才重建遮罩；词外 margin 不伪装成辉光用的对称 padding。词内间距仍属于原词持续时间，不新增空白时间片。
- 新分析仅在文本构建、配置变化或必要的布局失效时执行；不在逐帧 `update` 中扫描文本或新增 DOM 测量循环。

## 4. 实施顺序与文件范围

以下任务均已完成；第 6 节记录实际验证结果与环境限制。

1. [x] **边界规则及回归用例。** 新增 `utils/text-autospace.ts`、`utils/text-autospace-dom.ts` 及测试，覆盖空白优先、全角字符、组合字符、补充平面与波浪号。CJK 分词复用 grapheme 迭代，保留 UTF-16 时间分配与总时长，不拆开代理对。
2. [x] **接入真实 DOM。** 接入跨 wrapper、组内、词内、强调、注音及副行；保留原始文本与时间词，不创建空白时间片或额外逐字动画。
3. [x] **完成尺寸闭环。** 动态/非动态路径共享间距规则；主行及含混排边界的翻译、音译复用 `LineBalancer`，换行时丢弃行首间距。遮罩与暗层副本同步刷新；字体变化使宽度缓存失效。
4. [x] **接入可关闭配置。** 提供 `getEnableTextAutospace()` / `setEnableTextAutospace(enable = true)`，React/Vue 提供默认开启的 `enableTextAutospace`。移除属性后恢复默认，不重置播放进度；React Full 继承默认行为，不增加设置页。
5. [x] **真实浏览器验收。** 临时页面导入真实 core、React、Vue 模块，完成 Chromium 验收；包括播放/暂停、seek、懒构建、背景/对唱、字号及字体加载、窄/宽容器往返。不新增持久化测试页面或 E2E 框架。
6. [x] **文档与发布记录。** 更新 core 中英文 README、组件指南中英文版本、core/React/Vue CHANGELOG，新增 `.nx/version-plans/version-plan-460-text-autospace.md`。通过 docs 构建重新生成 TypeDoc Markdown 接口参考，确认新方法与属性；生成目录按既有规则忽略，不手改历史 `reference/core.json`。

永久测试覆盖 Unicode 边界、无 `Intl.Segmenter` 的回退、补充平面时间分配、候选行宽及行首间距。DOM 尺寸、开关和动画采用真实浏览器临时 smoke 验证，不用 happy-dom 的零尺寸证明排版正确，不新增属性转发或 CSS 字符串断言。

## 5. 验收矩阵

| 场景 | 输入或操作 | 通过条件 |
| --- | --- | --- |
| Issue 日文样例 | `してtake2だよ`，分别作为一词及多个时间词输入 | `て/t`、`2/だ` 两个边界有窄间距，`take2` 内部无额外间距；同字号下两种输入呈现一致 |
| Issue 数字样例 | `鳴らせ君の3〜6マス`，另测 `~`、`～` | CJK/数字及数字/波浪号边界按规则呈现，无原文改写 |
| 跨语言 | `中文AMLL2026年`、`かなAMLL`、`カナAMLL`、`한글AMLL` | 只在指定的异类边界补间距 |
| 既有空白 | 普通空格、NBSP、窄空格、全角空格位于边界 | 不重复增加间距，不额外规范化作者空白 |
| 不应变化的内容 | 纯 CJK、纯英文、`take2`、全角 `ＡＢＣ１２３`、Emoji | 无新增间距，不破坏原有分词、换行能力 |
| Unicode | 扩展区汉字、`e` 加组合重音、Emoji ZWJ、变体选择符 | 不切断 grapheme，不在附加符或 emoji 内加间距 |
| 词的结构 | 同一混排文本使用单词、多词、拆音节、强调、ruby、romanWord | 间距不因 DOM 分组改变；正文与注音仍正确对齐，时间戳与高亮语义不变 |
| 非逐字及副行 | 非逐字主行、背景/对唱、翻译、整行音译 | 开关行为一致；纯拉丁音译不被拉散；右对齐保持 |
| 换行边缘 | 窄/宽容器往返，边界恰落在断点 | 行首/行尾不残留自动间距，不增加原本可避免的溢出；重复平衡不累积 DOM 或宽度 |
| 状态切换 | 同宽同高下开→关→开；再滚出/滚入可视区 | 立即恢复对应几何，懒构建行遵循最新值；进度不重置，副本不重影 |
| 动画及重建 | 播放、暂停、seek、字号变化、字体加载完成、背景缩放 | 遮罩与字形对齐，无辉光裁切、双层错位或旧断行缓存 |
| 框架 | core、React、Vue 默认开启并主动关闭；React 属性移除 | 对应行为一致，属性移除后恢复约定默认值；React Full 默认可正常渲染 |
| 浏览器 | Chromium、Firefox、Safari/WKWebView，另覆盖不支持原生属性的环境 | 自定义间距不依赖原生属性支持；未实际运行的平台必须标注未验证 |

## 6. 实际验证结果

已执行：

```bash
pnpm --filter @applemusic-like-lyrics/core exec vitest run test
pnpm exec nx run-many --target=test --projects=ttml,lyric,react-full
node node_modules/@typescript/native-preview/bin/tsgo -b packages/core/tsconfig.json packages/react/tsconfig.json packages/vue/tsconfig.json packages/lyric/tsconfig.json packages/ttml/tsconfig.json packages/react-full/tsconfig.json
pnpm --filter @applemusic-like-lyrics/core build-only
pnpm exec nx run-many --target=build-only --projects=react,vue,lyric,ttml,react-full
pnpm run ci:lint
pnpm --filter @applemusic-like-lyrics/docs build
```

| 检查 | 实际结果 |
| --- | --- |
| core | 15 个测试文件、391 项测试通过 |
| lyric / ttml / react-full | 分别 106 / 76 / 16 项测试通过；合计所有库 589 项 |
| 类型检查及产物 | 根目录编译器完成六个库的项目构建；六个库的 `build-only` 通过 |
| lint | `ci:lint` 检查 328 个文件，无错误或警告 |
| 文档 | TypeDoc 生成成功，Astro 构建 563 页；保留既有注释标签、sourcemap 和体积提示 |
| Chromium | core、React、Vue 的真实模块及界面验证通过，并观察截图 |

环境限制：包目录遗留的 `tsgo` 启动器引用已不存在的 `7.0.0-dev.20260516.1/.../tsgo.js`，因此普通 `typecheck` / `build:libs` 脚本失败。`pnpm install --frozen-lockfile` 及离线重链接未修复启动器；未为此修改依赖配置。上表类型检查使用可运行的根目录编译器，打包单独调用 `build-only`，不将原脚本记作通过。

浏览器证据：

- `してtake2だよ` 的单词与多时间词版本均只增加两个边界的宽度；48px 字号共增加 12px。数字/波浪号、韩文、强调、ruby、romanWord、补充平面、组合字符和 Emoji 已覆盖；已有空白、全角字符不补间距。
- core/React/Vue 开→关→恢复后文本及进度不变。React/Vue 移除属性后均恢复默认，宽度 `317.625 → 305.625 → 317.625px`，进度保持 `1000ms`。
- 未构建行首次显示时遵循关闭值，脱离文档后开启再挂载恢复 12px 间距；背景、对唱及暗层副本同步，副本几何误差不超过 `1/64px`。
- 实际加载本地 FontFace 并观察到一次 `loadingdone`；字号由 48px 改为 64px 后，两处边界间距由 12px 变为 16px，遮罩及副本更新。
- 动态行窄→宽恢复时断点由 1 个变为 0 个，无遗留行首标记。非动态行宽度 `400.171875 → 376.171875 → 400.171875px`；窄容器产生一个断点，放宽后清除，文本与 `1200ms` 进度不变。
- 验收发现并修复三个尺寸问题：片段错误继承 `pre-wrap` 导致 nowrap 测量仍换行；副行自然换行残留 4px 行首间距；首次 ResizeObserver 回调被无条件跳过导致宽容器保留窄容器断点。最终副行两个换行起点偏移均为 0，首次尺寸回调改由既有几何签名判断是否需要重建。

未验证：Firefox、Safari/WKWebView、iOS 实机及不支持原生 `text-autospace` 的旧浏览器。自定义实现不依赖原生属性生成间距，但不能将实现推断当作跨浏览器实测。Apple Music 精确像素参数仍未证实。

## 7. 风险与收口条件

- **样式叠加风险最高。** 现有强调 wrapper 的 padding/margin 影响 DOM Range 宽度，不能直接以 Range 外框宽度作为净字形宽度；本次实验记录的是同结构的增量。
- **仅添加 CSS 属性不能关闭 Issue。** 它没有解决跨原子盒、数字/波浪号、词内强调片段和断行恢复问题。
- **只处理跨词边界也不能关闭 Issue。** 单个时间词可以同时包含 CJK 与西文，注音词也不能靠重分配时间解决。
- **原文保持与布局一致性同时验收。** 在本功能前后比较相同输入的正文、时间数据及渲染结果；不把现有优化器的空白规范化混算成本功能改写。
- **Apple Music 像素级一致性尚未证实。** 当前依据是 Issue 截图，不推断其闭源排版算法；确认混排观感、窄间距及无回归，而不是宣称复刻全部标点规则。

完成条件已满足：规则、呈现、断行/测量、配置、框架绑定及文档已完成，Chromium 实际界面验证覆盖上述行为。跨引擎与 iOS 验证限制如第 6 节所列；本次交付以当前分支的本地提交为准，不自动推送。
