## 1.1.0 (2026-09-19)

### Minor Changes

- **refactor(lyric):** 统一各个 LRC 格式的处理 ([#613](https://github.com/amll-dev/applemusic-like-lyrics/pull/613))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)

## 1.0.2 (2026-07-09)

### Patch Changes

- **chore:** 修复 linter 警告 ([#539](https://github.com/amll-dev/applemusic-like-lyrics/pull/539))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)

## 1.0.1 (2026-05-17)

### Patch Changes

- **fix:** 更正 stringifyLrcA2 函数大小写错误 ([#535](https://github.com/amll-dev/applemusic-like-lyrics/pull/535))

  将 `stringifylrcA2` 更正为 `stringifyLrcA2`。我们保留了兼容旧版本拼写的接口，但其将在未来版本中移除。

- **chore:** 更正 package.json 协议声明 ([#534](https://github.com/amll-dev/applemusic-like-lyrics/pull/534))

  仓库根目录的 LICENSE 文件为 AGPL v3.0 协议，但是 package.json 中的 `license` 字段为 `GPL-3.0`。经与原开发者确认，package.json 中的 `license` 字段有误。仓库与其所有产出的 npm 包均应为 AGPL v3 only 协议，SPDX: `AGPL-3.0-only`。因此，更正各包 `package.json` 的 `license` 字段为 `AGPL-3.0-only`。

### Updated Dependencies

- Updated `@applemusic-like-lyrics/ttml` to `1.0.1`

### Contributors

- Linho [@Linho1219](https://github.com/Linho1219)

# 1.0.0 (2026-04-23)

### Updated Dependencies

- Updated `@applemusic-like-lyrics/ttml` to `1.0.0`

## 1.0.0-alpha.0 (2026-04-14)

### Major Changes

- **refactor:** 使用 TS 重写歌词正反解逻辑 ([56fd547c](https://github.com/amll-dev/applemusic-like-lyrics/commit/56fd547c))

### Minor Changes

- **refactor:** 重构 TTML 解析和生成器 ([#471](https://github.com/amll-dev/applemusic-like-lyrics/pull/471))

### Patch Changes

- **fix:** 修复接驳错误导致的 ttml 输出对象结构问题 ([3418d391](https://github.com/amll-dev/applemusic-like-lyrics/commit/3418d391))
- **fix:** 修复 lyric 包函数导出名误修改 ([1a81fcd1](https://github.com/amll-dev/applemusic-like-lyrics/commit/1a81fcd1))
- **fix:** 修复 lyric 包在 isolatedDeclarations 下的类型问题 ([d2060cd9](https://github.com/amll-dev/applemusic-like-lyrics/commit/d2060cd9))
- **chore:** 更换工具链 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))

### Updated Dependencies

- Updated `@applemusic-like-lyrics/ttml` to `1.0.0-alpha.0`

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)
