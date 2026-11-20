---
title: 样式设置
---

AMLL 歌词组件使用了 CSS Module 并对类名进行包装，产生形似 `_lyricLine_1266s_1` 的类名，以避免样式冲突。不过这也使得下游开发者难以通过类名选中元素并覆盖样式。

为此，我们使用 `data-amll-role` 属性标记了一些主要元素，这样即可通过选择器 `[data-amll-role="<属性值>"]` 选中对应元素。

下面是目前已添加的属性标记：

| 属性值                    | 说明         |
| ------------------------- | ------------ |
| `line-wrapper`            | 歌词行组容器 |
| `line`                    | 歌词行       |
| `main`                    | 歌词行主行   |
| `translation`             | 歌词行翻译行 |
| `romanization`            | 歌词行音译行 |
| `interlude-dot-container` | 间奏点容器   |
| `interlude-dot`           | 间奏点       |
| `bottom-line-wrapper`     | 底部行容器   |
| `bottom-line`             | 底部行       |

可以通过浏览器的 DevTools 检查元素。我们计划让 `data-amll-role` 属性保持长期稳定，以减少下游适配成本。

如果还有更多需求，可以通过 issue 反馈或提出 PR。
