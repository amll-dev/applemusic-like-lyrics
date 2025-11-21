# 鸿蒙 ArkTS 歌词组件 - 项目信息

## 项目概述

这是一个将原 Web 版本的 Apple Music 风格歌词播放器转换为鸿蒙 ArkTS 版本的项目。

### 转换范围

**源代码位置**: `/packages/core/src` (Web版本)
**目标位置**: `/arkts-lyrics` (鸿蒙版本)

## 文件映射关系

### 核心接口
| 原文件 | ArkTS版本 | 说明 |
|--------|-----------|------|
| `interfaces.ts` | `src/interfaces/LyricInterfaces.ets` | 核心接口定义 |

### 组件系统
| 原文件 | ArkTS版本 | 说明 |
|--------|-----------|------|
| `lyric-player/base.ts` | `src/components/LyricPlayer.ets` | 播放器主组件（合并了base逻辑） |
| `lyric-player/dom/lyric-line.ts` | `src/components/LyricLine.ets` | 歌词行组件 |
| `lyric-player/dom/interlude-dots.ts` | `src/components/InterludeDots.ets` | 间奏动画组件 |

### 工具函数
| 原文件 | ArkTS版本 | 说明 |
|--------|-----------|------|
| `utils/spring.ts` | `src/utils/SpringAnimation.ets` | 弹簧动画系统 |
| `utils/lyric-split-words.ts` | `src/utils/LyricUtils.ets` | 歌词工具（合并多个工具） |
| `utils/is-cjk.ts` | `src/utils/LyricUtils.ets` | CJK判断（合并） |

### 示例
| 原文件 | ArkTS版本 | 说明 |
|--------|-----------|------|
| N/A | `demo/LyricPlayerDemo.ets` | 完整功能Demo |
| N/A | `demo/SimpleExample.ets` | 简化版示例 |

## 技术栈对比

### Web 版本
- TypeScript
- DOM API
- Web Animations API
- CSS (mask-image, transform, etc.)
- Canvas 2D / WebGL

### 鸿蒙 ArkTS 版本
- ArkTS (TypeScript增强)
- 声明式UI
- 鸿蒙动画系统
- 原生组件 (Text, Column, Row, etc.)
- Canvas (可选，暂未完整实现)

## 主要差异

### 1. 架构变化

**Web版本**：
```
LyricPlayerBase (抽象基类)
  ├─> DomLyricPlayer (DOM实现)
  ├─> DomSlimLyricPlayer (精简版)
  └─> CanvasLyricPlayer (Canvas实现)
```

**ArkTS版本**：
```
LyricPlayer (主组件，合并了base逻辑)
  ├─> LyricLineComponent (歌词行)
  └─> InterludeDots (间奏动画)
```

### 2. 状态管理

**Web版本**：
- 手动状态管理
- Set 集合管理激活行
- 虚拟滚动优化

**ArkTS版本**：
- @State 装饰器
- 数组存储行状态
- 使用系统 Scroll 组件

### 3. 动画系统

**Web版本**：
- Web Animations API
- CSS transitions
- RequestAnimationFrame

**ArkTS版本**：
- animateTo() API
- animation() 属性
- 自定义弹簧动画类

### 4. 渲染方式

**Web版本**：
- DOM 元素创建/销毁
- CSS mask-image 实现渐变
- 虚拟滚动（自实现）

**ArkTS版本**：
- 声明式组件渲染
- 颜色渐变代替遮罩
- 系统 Scroll 组件

## 功能对比表

| 功能 | Web版本 | ArkTS版本 | 说明 |
|------|---------|-----------|------|
| 逐词高亮 | ✅ mask-image | ✅ 颜色渐变 | 实现方式不同 |
| 强调效果 | ✅ 完整 | ⚠️ 简化 | 缺少辉光效果 |
| 弹簧动画 | ✅ | ✅ | 物理模拟一致 |
| 间奏动画 | ✅ | ✅ | 效果相同 |
| 缩放/模糊 | ✅ | ✅ | 效果相同 |
| 翻译/音译 | ✅ | ✅ | 完全支持 |
| 对唱模式 | ✅ | ✅ | 完全支持 |
| 背景渲染 | ✅ | ❌ | 未实现 |
| Canvas渲染 | ✅ | ⚠️ | 待完善 |
| 虚拟滚动 | ✅ 自实现 | ✅ 系统实现 | 方式不同 |
| 触摸拖拽 | ✅ | ✅ | 系统提供 |

图例：
- ✅ 完全支持
- ⚠️ 部分支持/简化实现
- ❌ 未支持

## 性能特征

### Web版本
- 虚拟滚动减少DOM节点
- 硬件加速动画（transform, opacity）
- 可配置降级方案
- 支持60fps+

### ArkTS版本
- 系统级渲染优化
- 原生动画性能
- 声明式UI自动优化
- 支持60fps+

## 使用场景

### Web版本
- 网页音乐播放器
- Electron桌面应用
- 跨平台Web应用

### ArkTS版本
- 鸿蒙手机应用
- 鸿蒙平板应用
- 鸿蒙可穿戴设备
- 鸿蒙车机系统

## 集成步骤

### 1. 复制文件到项目

```bash
# 复制到鸿蒙项目的entry模块
cp -r arkts-lyrics/src/* your-harmony-project/entry/src/main/ets/
```

### 2. 导入组件

```typescript
// 在你的页面中
import { LyricPlayer } from './components/LyricPlayer';
import { LyricLine, LyricPlayerConfig } from './interfaces/LyricInterfaces';
```

### 3. 使用组件

参见 `demo/LyricPlayerDemo.ets` 或 `demo/SimpleExample.ets`

## 开发建议

### 扩展功能
1. **添加背景渲染**：使用鸿蒙的 Canvas 组件
2. **优化触摸体验**：使用 PanGesture
3. **添加歌词编辑**：支持实时修改歌词数据
4. **持久化配置**：使用 Preferences 保存用户设置

### 性能优化
1. 对于超长歌词列表，考虑实现自定义虚拟滚动
2. 低端设备可以禁用模糊和弹簧动画
3. 使用 LazyForEach 替代 ForEach（大数据量）

### 代码质量
1. 添加单元测试
2. 添加 UI 自动化测试
3. 完善错误处理
4. 添加日志系统

## 已知问题

1. **渐变效果**：颜色渐变不如 mask-image 精细
2. **强调效果**：缺少辉光效果（text-shadow）
3. **背景渲染**：完全未实现
4. **Canvas渲染**：实验性，需要完善

## 未来计划

- [ ] 完善 Canvas 渲染模式
- [ ] 实现背景渲染系统
- [ ] 添加更多预设动画
- [ ] 支持手势控制
- [ ] 支持歌词解析（LRC格式）
- [ ] 性能监控和优化
- [ ] 添加单元测试

## 版本历史

### v1.0.0 (初始版本)
- ✅ 核心歌词播放功能
- ✅ 逐词高亮
- ✅ 弹簧动画
- ✅ 间奏动画
- ✅ 翻译/音译支持
- ✅ 完整Demo示例

## 贡献指南

欢迎贡献代码！请遵循以下规范：

1. 使用 ArkTS 标准语法
2. 遵循鸿蒙开发规范
3. 添加必要的注释
4. 提供测试用例
5. 更新文档

## 联系方式

如有问题或建议，请：
1. 提交 Issue
2. 发起 Pull Request
3. 查看原项目文档

## 许可证

与原项目保持一致。
