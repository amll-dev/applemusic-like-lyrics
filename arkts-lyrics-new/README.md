
# 鸿蒙ArkTS版本 - Apple Music风格歌词组件（Canvas实现）

这是 Apple Music 风格歌词播放器的鸿蒙 ArkTS Canvas 实现版本，**完全符合ArkTS严格类型规范**，并使用Canvas实现所有原版特效。

## ✨ 核心特性

### 🎯 完全实现的原版特效

✅ **逐词渐变高亮** - 使用Canvas线性渐变完美还原原版mask-image效果
✅ **强调效果** - 长音节自动缩放 + 辉光效果（shadowBlur）
✅ **弹簧动画** - 基于物理的流畅滚动
✅ **间奏动画** - 三点跳动动画
✅ **缩放/模糊/透明度** - 非激活行的视觉效果
✅ **翻译和音译** - 完整支持
✅ **对唱模式** - 右对齐显示

### 🛠️ 技术特点

- ✅ **严格符合ArkTS规范** - 所有类型显式声明，无类型推断
- ✅ **避免命名冲突** - 使用 `scaleRatio`、`alphaValue`、`blurRadius` 等名称
- ✅ **Canvas渲染** - 高性能，完全控制渲染过程
- ✅ **原版算法** - 移植原版的所有核心算法和特效

## 📂 项目结构

```
arkts-lyrics-new/
├── src/
│   ├── models/              # 数据模型（严格类型）
│   │   └── LyricModels.ets
│   │
│   ├── core/                # 核心业务逻辑
│   │   └── LyricPlayerController.ets
│   │
│   ├── canvas/              # Canvas渲染器
│   │   └── CanvasLyricRenderer.ets
│   │
│   ├── utils/               # 工具函数
│   │   ├── SpringAnimator.ets
│   │   ├── LyricUtils.ets
│   │   └── InterludeAnimator.ets
│   │
│   └── components/          # UI组件
│       └── CanvasLyricPlayerComponent.ets
│
├── demo/                    # 示例代码
│   └── CanvasLyricPlayerDemo.ets
│
└── docs/                    # 文档
```

## 🚀 快速开始

### 1. 引入组件

```typescript
import { CanvasLyricPlayerComponent } from './src/components/CanvasLyricPlayerComponent';
import { LyricLine, LyricWord, LyricPlayerConfig } from './src/models/LyricModels';
```

### 2. 创建歌词数据

```typescript
const word1: LyricWord = new LyricWord(0, 500, 'Hello', '', false);
const word2: LyricWord = new LyricWord(500, 1000, 'World', '', false);

const line1: LyricLine = new LyricLine(
  [word1, word2],
  0,
  1000,
  '你好世界',  // 翻译
  '',          // 音译
  false,       // isBG
  false        // isDuet
);

const lyrics: LyricLine[] = [line1];
```

### 3. 配置播放器

```typescript
const config: LyricPlayerConfig = LyricPlayerConfig.create({
  alignAnchor: 'center',
  alignPosition: 0.4,
  enableScale: true,
  enableBlur: true,
  enableSpring: true,
  enableEmphasize: true,
  enableGlow: true,
  showTranslation: true,
  showRoman: false,
  useCanvas: true
});
```

### 4. 使用组件

```typescript
@Entry
@Component
struct MyPage {
  private playerComponent: CanvasLyricPlayerComponent | null = null;

  build() {
    Column() {
      CanvasLyricPlayerComponent({ playerConfig: config })
        .onAppear(() => {
          this.playerComponent = new CanvasLyricPlayerComponent();
          this.playerComponent.playerConfig = config;
          this.playerComponent.setLyricLines(lyrics);
        })
    }
  }
}
```

### 5. 更新播放时间

```typescript
// 在音频播放回调中
if (this.playerComponent) {
  this.playerComponent.setCurrentTime(currentTimeMs);
}
```

## 📖 API 文档

### LyricWord 类

```typescript
class LyricWord {
  startTime: number;
  endTime: number;
  word: string;
  romanWord: string;
  obscene: boolean;

  constructor(
    startTime: number,
    endTime: number,
    word: string,
    romanWord: string = '',
    obscene: boolean = false
  );
}
```

### LyricLine 类

```typescript
class LyricLine {
  words: LyricWord[];
  translatedLyric: string;
  romanLyric: string;
  startTime: number;
  endTime: number;
  isBG: boolean;
  isDuet: boolean;

  constructor(
    words: LyricWord[],
    startTime: number,
    endTime: number,
    translatedLyric: string = '',
    romanLyric: string = '',
    isBG: boolean = false,
    isDuet: boolean = false
  );
}
```

### LyricPlayerConfig 类

```typescript
class LyricPlayerConfig {
  alignAnchor: string;           // 'top' | 'center' | 'bottom'
  alignPosition: number;         // 0-1
  enableScale: boolean;
  enableBlur: boolean;
  enableSpring: boolean;
  wordFadeWidth: number;
  hidePassed: boolean;
  showTranslation: boolean;
  showRoman: boolean;
  enableEmphasize: boolean;      // 启用强调效果
  enableGlow: boolean;           // 启用辉光效果
  useCanvas: boolean;

  static create(options?: Partial<LyricPlayerConfig>): LyricPlayerConfig;
}
```

### CanvasLyricPlayerComponent 组件

```typescript
@Component
export struct CanvasLyricPlayerComponent {
  public playerConfig: LyricPlayerConfig;

  // 方法
  public setLyricLines(lines: LyricLine[]): void;
  public setCurrentTime(timeMs: number): void;
}
```

## 🎨 核心特效实现

### 1. 逐词渐变高亮

使用Canvas的 `createLinearGradient` 实现：

```typescript
const gradient: CanvasGradient = ctx.createLinearGradient(
  x + gradientStart, y,
  x + gradientEnd, y
);

gradient.addColorStop(0, '#FFFFFF');      // 已播放：白色
gradient.addColorStop(fadeMid, '#AAAAAA'); // 渐变中点
gradient.addColorStop(1, '#888888');       // 未播放：灰色

ctx.fillStyle = gradient;
ctx.fillText(word, x, y);
```

### 2. 强调效果（缩放 + 辉光）

```typescript
// 缩放
const scale: number = 1.0 + 0.15 * Math.sin(progress * Math.PI);
ctx.scale(scale, scale);

// 辉光
const glowIntensity: number = Math.sin(progress * Math.PI) * 0.8;
ctx.shadowColor = 'rgba(255, 255, 255, ' + glowIntensity + ')';
ctx.shadowBlur = 20 * glowIntensity;
```

**触发条件**：
- CJK字符：时长 ≥ 1000ms
- 其他字符：时长 ≥ 1000ms 且长度 1-7

### 3. 弹簧动画

基于物理模拟的弹簧系统：

```typescript
// 弹簧力
const displacement: number = currentPos - targetPos;
const springForce: number = -stiffness * displacement;

// 阻尼力
const dampingForce: number = -damping * velocity;

// 加速度
const acceleration: number = (springForce + dampingForce) / mass;

// 更新速度和位置
velocity += acceleration * deltaTime;
currentPos += velocity * deltaTime;
```

参数：
- mass: 1.0
- stiffness: 100.0
- damping: 20.0

### 4. 间奏动画

三个圆点依次跳动（间隔≥4秒时显示）：

```typescript
for (let i = 0; i < 3; i++) {
  const scale: number = dotScales[i];
  const opacity: number = dotOpacities[i];

  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(x, y, dotRadius * scale, 0, Math.PI * 2);
  ctx.fill();
}
```

## ⚠️ ArkTS 规范注意事项

### 1. 类型必须显式声明

```typescript
// ✅ 正确
const value: number = 10;
const text: string = 'hello';

// ❌ 错误
const value = 10;  // 不能依赖类型推断
```

### 2. 避免系统属性名冲突

```typescript
// ❌ 错误 - 与系统属性冲突
@Prop scale: number;
@Prop opacity: number;
@Prop blur: number;

// ✅ 正确 - 重命名避免冲突
scaleRatio: number;
alphaValue: number;
blurRadius: number;
```

### 3. 对象字面量必须有明确类型

```typescript
// ❌ 错误
const config = {
  enableScale: true
};

// ✅ 正确
const config: LyricPlayerConfig = LyricPlayerConfig.create({
  enableScale: true
});
```

### 4. UI组件语法

```typescript
// ❌ 错误 - 不能在build外写非UI代码
build() {
  const data = this.processData();  // 错误
  Column() { }
}

// ✅ 正确
build() {
  Column() {
    // 仅UI组件
  }
}
```

## 🔧 调优建议

### 性能优化

1. **调整弹簧参数**（更快响应）：
```typescript
new SpringAnimatorConfig(1.0, 150.0, 25.0)
```

2. **禁用模糊效果**（低端设备）：
```typescript
config.enableBlur = false;
```

3. **禁用辉光效果**：
```typescript
config.enableGlow = false;
```

### 视觉调整

1. **调整对齐位置**：
```typescript
config.alignPosition = 0.3;  // 更靠上
config.alignPosition = 0.5;  // 居中
```

2. **调整渐变宽度**：
```typescript
config.wordFadeWidth = 0.3;  // 更窄的渐变
```

## 🆚 与原版Web版本对比

| 功能 | Web版 | ArkTS Canvas版 | 说明 |
|------|-------|----------------|------|
| 逐词渐变 | ✅ mask-image | ✅ linearGradient | 视觉效果一致 |
| 强调效果 | ✅ 完整 | ✅ 完整 | 缩放+辉光 |
| 弹簧动画 | ✅ | ✅ | 算法完全一致 |
| 间奏动画 | ✅ | ✅ | 完全一致 |
| Canvas渲染 | ✅ 实验性 | ✅ 主实现 | 更稳定 |
| 类型安全 | ⚠️ TypeScript | ✅ ArkTS | 更严格 |

## 📝 完整示例

参见 `demo/CanvasLyricPlayerDemo.ets` 获取完整的可运行示例，包括：

- ✅ 完整的歌词数据示例
- ✅ 播放控制（播放/暂停/重置/跳转）
- ✅ 进度条集成
- ✅ 符合ArkTS规范的类型声明
- ✅ 正确的生命周期管理

## ❓ 常见问题

### Q: 为什么使用Canvas而不是组件？

A: Canvas提供：
1. 更精确的渲染控制
2. 更好的性能（大量文字）
3. 完整实现原版特效
4. 避免ArkTS组件限制

### Q: 如何从JSON加载歌词？

A: 使用 `fromJson` 方法：
```typescript
const lineData: Record<string, Object> = JSON.parse(jsonString);
const line: LyricLine = LyricLine.fromJson(lineData);
```

### Q: 如何处理ArkTS类型错误？

A: 确保：
1. 所有变量显式声明类型
2. 使用类而非接口
3. 避免使用系统保留名称
4. build()中只写UI组件

### Q: 性能如何优化？

A:
1. 降低Canvas分辨率
2. 减少渲染频率（30fps）
3. 禁用模糊和辉光
4. 使用较小的弹簧刚度

## 📄 许可证

与原项目保持一致。

## 🔗 相关链接

- 原始项目：[applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics)
- 鸿蒙文档：[HarmonyOS ArkTS](https://developer.harmonyos.com/cn/docs/documentation/doc-guides-V3/arkts-get-started-0000001504769321-V3)
- Canvas API：[HarmonyOS Canvas](https://developer.harmonyos.com/cn/docs/documentation/doc-references-V3/ts-components-canvas-canvas-0000001427902480-V3)

## 🎯 开发计划

- [x] Canvas渲染器
- [x] 逐词渐变效果
- [x] 强调效果（缩放+辉光）
- [x] 弹簧动画系统
- [x] 间奏动画
- [ ] 背景渲染（专辑封面模糊）
- [ ] 手势控制
- [ ] 歌词编辑器
- [ ] LRC格式解析器

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

特别欢迎：
- 性能优化建议
- 更多视觉效果
- Bug修复
- 文档改进

---

**注意**：本版本完全符合ArkTS严格规范，使用Canvas实现所有原版特效。如有问题请提交Issue。
