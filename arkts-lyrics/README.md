# 鸿蒙ArkTS版本 - Apple Music风格歌词组件

这是 Apple Music 风格歌词播放器的鸿蒙 ArkTS 实现版本，提供了流畅的逐词高亮、弹簧动画、间奏效果等特性。

## 特性

✨ **核心功能**
- 逐词高亮显示
- 流畅的弹簧动画滚动
- 自动居中对齐
- 间奏点动画（间隔≥4秒时显示）
- 支持翻译和音译显示
- 对唱模式（右对齐）

🎨 **视觉效果**
- 渐变文字颜色
- 缩放效果
- 模糊效果
- 强调效果（长音节）
- 透明度渐变

⚙️ **可配置选项**
- 对齐方式和位置
- 启用/禁用各种效果
- 显示/隐藏翻译/音译
- 弹簧动画参数调节

## 目录结构

```
arkts-lyrics/
├── src/
│   ├── components/              # 组件
│   │   ├── LyricPlayer.ets      # 主播放器组件
│   │   ├── LyricLine.ets        # 歌词行组件
│   │   └── InterludeDots.ets    # 间奏动画组件
│   │
│   ├── interfaces/              # 接口定义
│   │   └── LyricInterfaces.ets  # 核心接口
│   │
│   └── utils/                   # 工具函数
│       ├── SpringAnimation.ets  # 弹簧动画系统
│       └── LyricUtils.ets       # 歌词工具函数
│
└── demo/
    └── LyricPlayerDemo.ets      # 完整Demo示例
```

## 快速开始

### 1. 引入组件

```typescript
import { LyricPlayer } from './src/components/LyricPlayer';
import { LyricLine, LyricPlayerConfig } from './src/interfaces/LyricInterfaces';
```

### 2. 准备歌词数据

```typescript
const lyrics: LyricLine[] = [
  {
    words: [
      { word: '在', startTime: 0, endTime: 300 },
      { word: '这', startTime: 300, endTime: 600 },
      { word: '个', startTime: 600, endTime: 900 },
      { word: '世', startTime: 900, endTime: 1500 },
      { word: '界', startTime: 1500, endTime: 2000 }
    ],
    translatedLyric: 'In this world',
    startTime: 0,
    endTime: 2000,
    isBG: false,
    isDuet: false
  },
  // 更多歌词...
];
```

### 3. 配置播放器

```typescript
const config: LyricPlayerConfig = {
  alignAnchor: 'center',      // 对齐锚点: 'top' | 'center' | 'bottom'
  alignPosition: 0.4,         // 对齐位置 (0-1)
  enableScale: true,          // 启用缩放效果
  enableBlur: true,           // 启用模糊效果
  enableSpring: true,         // 启用弹簧动画
  wordFadeWidth: 0.5,         // 单词渐变宽度
  hidePassed: false,          // 隐藏已播放歌词
  showTranslation: true,      // 显示翻译
  showRoman: false            // 显示音译
};
```

### 4. 使用组件

```typescript
@Component
struct MyPage {
  @State currentTime: number = 0;
  private lyricPlayerRef: LyricPlayer | null = null;

  build() {
    Column() {
      LyricPlayer({
        config: config
      })
        .onReady((player: LyricPlayer) => {
          this.lyricPlayerRef = player;
          player.setLyricLines(lyrics);
        })
    }
  }
}
```

### 5. 更新播放时间

```typescript
// 在音频播放的回调中更新
onAudioTimeUpdate(time: number) {
  if (this.lyricPlayerRef) {
    this.lyricPlayerRef.setCurrentTime(time);
    this.lyricPlayerRef.onFrameUpdate(16.67); // 约60fps
  }
}
```

## 完整示例

参见 `demo/LyricPlayerDemo.ets` 获取完整的可运行示例，包括：

- 完整的歌词数据示例
- 播放控制（播放/暂停/重置/跳转）
- 进度条集成
- 播放时间显示
- 自动循环播放

## API 文档

### LyricPlayer 组件

主要的歌词播放器组件。

#### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| config | LyricPlayerConfig | 播放器配置 |

#### 方法

| 方法 | 参数 | 说明 |
|------|------|------|
| setLyricLines | lines: LyricLine[] | 设置歌词数据 |
| setCurrentTime | time: number | 设置当前播放时间（毫秒） |
| onFrameUpdate | deltaTime: number | 帧更新（毫秒） |

### LyricPlayerConfig 接口

播放器配置选项。

```typescript
interface LyricPlayerConfig {
  alignAnchor?: string;      // 对齐锚点
  alignPosition?: number;    // 对齐位置 (0-1)
  enableScale?: boolean;     // 启用缩放
  enableBlur?: boolean;      // 启用模糊
  enableSpring?: boolean;    // 启用弹簧动画
  wordFadeWidth?: number;    // 单词渐变宽度
  hidePassed?: boolean;      // 隐藏已播放
  showTranslation?: boolean; // 显示翻译
  showRoman?: boolean;       // 显示音译
}
```

### LyricLine 接口

歌词行数据结构。

```typescript
interface LyricLine {
  words: LyricWord[];         // 单词数组
  translatedLyric?: string;   // 翻译歌词
  romanLyric?: string;        // 音译歌词
  startTime: number;          // 起始时间（毫秒）
  endTime: number;            // 结束时间（毫秒）
  isBG?: boolean;             // 是否为背景歌词
  isDuet?: boolean;           // 是否为对唱行
}
```

### LyricWord 接口

歌词单词数据结构。

```typescript
interface LyricWord {
  startTime: number;    // 开始时间（毫秒）
  endTime: number;      // 结束时间（毫秒）
  word: string;         // 单词内容
  romanWord?: string;   // 音译内容
  obscene?: boolean;    // 是否含不雅内容
}
```

## 核心特性说明

### 1. 逐词高亮

歌词会根据当前播放时间，逐词改变颜色，从灰色渐变到白色，实现流畅的高亮效果。

### 2. 强调效果

对于长音节（时长≥1秒），会自动应用强调效果：
- 轻微放大（scale）
- 更明显的颜色变化

判断逻辑：
- CJK字符：时长 ≥ 1000ms
- 其他字符：时长 ≥ 1000ms 且长度 1-7

### 3. 弹簧动画

启用 `enableSpring` 后，歌词滚动会使用基于物理的弹簧动画，提供更自然的运动效果。

弹簧参数：
- mass（质量）：1.0
- stiffness（刚度）：100.0
- damping（阻尼）：20.0

### 4. 间奏动画

当两行歌词之间的间隔 ≥ 4秒时，会在中间显示三个跳动的圆点动画。

### 5. 缩放和模糊

- **缩放**：激活的歌词行缩放到100%，其他行缩放到97%
- **模糊**：根据距离当前行的距离，应用不同程度的模糊效果

### 6. 对唱模式

设置 `isDuet: true` 的歌词行会右对齐显示，适合对唱或多人演唱的场景。

## 性能优化建议

1. **帧率控制**：建议使用 16.67ms (60fps) 的更新间隔
2. **弹簧动画**：如果设备性能较低，可以禁用弹簧动画
3. **模糊效果**：模糊效果较消耗性能，低端设备可关闭
4. **虚拟滚动**：组件内部使用了 Scroll 组件，支持大量歌词行

## 与原版的差异

由于鸿蒙 ArkTS 和 Web 平台的差异，此版本做了以下调整：

### 已实现
- ✅ 逐词高亮（颜色渐变）
- ✅ 弹簧动画系统
- ✅ 间奏动画
- ✅ 缩放、模糊、透明度效果
- ✅ 翻译和音译显示
- ✅ 对唱模式

### 简化实现
- 🔄 **渐变遮罩**：使用颜色渐变代替 mask-image
- 🔄 **强调效果**：简化为缩放效果，未实现辉光（text-shadow）
- 🔄 **Canvas渲染**：当前仅实现了基础版本

### 未实现
- ❌ 背景渲染系统（MeshGradient/Pixi）
- ❌ Web Animations API 的精确控制
- ❌ 鼠标/触摸拖拽滚动（使用系统Scroll组件）

## 扩展开发

### 添加自定义效果

你可以扩展 `LyricLine.ets` 来添加自定义效果：

```typescript
@Component
export struct LyricLineComponent {
  // 添加自定义动画
  getCustomAnimation(word: LyricWord): AnimateParam {
    const progress = getWordProgress(word, this.currentTime);
    return {
      duration: 300,
      curve: Curve.Custom(your_custom_curve),
      // ... 自定义参数
    };
  }
}
```

### 自定义弹簧参数

修改 `LyricPlayer.ets` 中的弹簧初始化：

```typescript
private scrollSpring: Spring = new Spring({
  mass: 1,        // 调整质量
  stiffness: 150, // 调整刚度（更大 = 更快）
  damping: 25     // 调整阻尼（更大 = 更少弹跳）
});
```

## 常见问题

### Q: 如何调整歌词对齐位置？

A: 修改 `config.alignPosition`，范围 0-1：
- 0.0：顶部对齐
- 0.5：居中对齐
- 1.0：底部对齐
- 0.4：略微偏上（推荐）

### Q: 如何禁用某些效果？

A: 在配置中设置对应选项为 false：
```typescript
{
  enableScale: false,  // 禁用缩放
  enableBlur: false,   // 禁用模糊
  enableSpring: false  // 禁用弹簧动画
}
```

### Q: 歌词滚动不流畅怎么办？

A:
1. 确保 `onFrameUpdate` 被定期调用（60fps）
2. 尝试禁用弹簧动画
3. 减少或禁用模糊效果

### Q: 如何支持更多语言？

A: 组件已支持：
- 中文（简体/繁体）
- 日文（平假名/片假名）
- 韩文
- 英文及其他拉丁字符

自动识别 CJK 字符并应用对应的显示规则。

## 开发计划

- [ ] 支持背景渲染（渐变/专辑封面模糊）
- [ ] 优化触摸手势（拖拽滚动、惯性）
- [ ] 支持歌词行点击事件
- [ ] 添加更多预设动画效果
- [ ] 性能优化（虚拟列表）
- [ ] 支持更多歌词格式解析

## 许可证

本项目基于原 `@applemusic-like-lyrics/core` 改编，遵循相同的许可证。

## 相关链接

- 原始项目：[applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics)
- 鸿蒙文档：[HarmonyOS ArkTS](https://developer.harmonyos.com/cn/docs/documentation/doc-guides-V3/arkts-get-started-0000001504769321-V3)

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**：此为鸿蒙 ArkTS 转换版本，部分特性因平台限制有所调整。如有问题或建议，请提交 Issue。
