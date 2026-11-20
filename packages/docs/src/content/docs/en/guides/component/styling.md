---
title: Styling
---

The AMLL lyric component uses CSS Modules to scope class names, generating names such as `_lyricLine_1266s_1` to avoid style conflicts. However, this also makes it difficult for downstream developers to select elements by class name and override their styles.

To address this, we use the `data-amll-role` attribute to identify some of the main elements. This allows you to select the corresponding elements using the `[data-amll-role="<attribute-value>"]` selector.

The following attributes are currently available:

| Attribute value           | Description                 |
| ------------------------- | --------------------------- |
| `line-wrapper`            | Lyrics line group container |
| `line`                    | Lyrics line                 |
| `main`                    | Main lyrics line            |
| `translation`             | Translated lyrics line      |
| `romanization`            | Romanized lyrics line       |
| `interlude-dot-container` | Interlude dots container    |
| `interlude-dot`           | Interlude dot               |
| `bottom-line-wrapper`     | Bottom line container       |
| `bottom-line`             | Bottom line                 |

You can inspect these attributes using your browser's DevTools. We intend to keep the `data-amll-role` attributes stable over the long term to minimize adaptation costs for downstream developers.

If you have additional requirements, feel free to open an issue or submit a PR.
