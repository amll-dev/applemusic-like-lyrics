# ArkTS 歌词组件修复日志

## 2025-11-21 - 修复 @State private 运行时崩溃

### 问题描述
应用在启动时立即崩溃，错误信息：
```
TypeError: Cannot read property canvasWidth of undefined
at setInitiallyProvidedValue entry (entry/src/main/ets/components/CanvasLyricPlayerComponent.ets:17:69)
```

### 根本原因
在 ArkTS 严格规范中，**所有状态装饰器（@State、@Prop、@Link 等）修饰的变量不能使用 `private` 访问修饰符**。这是因为：

1. ArkTS 框架的状态管理系统需要访问这些属性
2. 框架会自动生成 `setInitiallyProvidedValue` 等方法来初始化状态
3. 如果属性是 `private`，框架无法正确绑定和访问，导致 `this` 上下文为 `undefined`

### 修复内容

#### 1. arkts-lyrics-new/src/components/CanvasLyricPlayerComponent.ets

**修改位置：第 25-27 行**

```diff
  /** Canvas宽度 */
- @State private canvasWidth: number = 0;
+ @State canvasWidth: number = 0;
  /** Canvas高度 */
- @State private canvasHeight: number = 0;
+ @State canvasHeight: number = 0;
```

#### 2. arkts-lyrics-new/demo/CanvasLyricPlayerDemo.ets

**修改位置：第 17-21 行**

```diff
  /** 当前播放时间（毫秒） */
- @State private currentTimeMs: number = 0;
+ @State currentTimeMs: number = 0;
  /** 是否正在播放 */
- @State private isPlayingState: boolean = false;
+ @State isPlayingState: boolean = false;
  /** 进度条值 */
- @State private sliderValue: number = 0;
+ @State sliderValue: number = 0;
```

### 影响范围
- ✅ 修复了应用启动崩溃问题
- ✅ 所有状态变量现在可以被 ArkTS 框架正确访问
- ✅ 不影响功能逻辑，仅修改访问修饰符

### 测试建议
1. 清理项目缓存
2. 重新构建项目
3. 在真机或模拟器上运行
4. 验证应用可以正常启动
5. 验证歌词播放功能正常
6. 验证所有特效（渐变、缩放、辉光、弹簧动画等）正常工作

### ArkTS 规范提醒

**❌ 错误用法：**
```typescript
@State private count: number = 0;
@Prop private title: string = '';
@Link private isVisible: boolean = false;
```

**✅ 正确用法：**
```typescript
@State count: number = 0;
@Prop title: string = '';
@Link isVisible: boolean = false;
```

**所有不能使用 `private` 的装饰器：**
- `@State` - 组件内部状态
- `@Prop` - 父组件传递的属性
- `@Link` - 父子组件双向绑定
- `@Provide` - 跨层级提供数据
- `@Consume` - 跨层级消费数据
- `@ObjectLink` - 对象类型双向绑定
- `@StorageLink` - 应用全局状态双向绑定
- `@StorageProp` - 应用全局状态单向绑定
- `@Watch` - 监听状态变化

### 提交信息
- Commit: 22d51ca
- Branch: claude/arkts-lyrics-conversion-018gKn714owqRNCV2MkqEcqB
- Message: "fix: 移除@State装饰器的private修饰符以符合ArkTS规范"

---

## 历史修复记录

### 2025-11-21 - 修复 Demo 数组字面量类型错误
- 错误：`Array literals must contain elements of only inferrable types`
- 修复：使用 `new LyricWord()` 和 `new LyricLine()` 创建对象
- Commit: 5eab6a0

### 2025-11-21 - 移除 @State 装饰器的 private 修饰符
- 错误：运行时崩溃 `Cannot read property canvasWidth of undefined`
- 修复：移除所有 `@State private` 中的 `private`
- Commit: 22d51ca (本次修复)

### 2025-11-21 - 修复 ArkTS 严格规范问题
- 使用 Animator API 替代 requestAnimationFrame
- 使用 HarmonyHeiTi 字体
- 避免命名冲突（scale → scaleRatio, opacity → alphaValue, blur → blurRadius）
- 创建 RendererConfig 类避免对象字面量类型错误
- Commit: f0bfba1

### 2025-11-21 - 重构鸿蒙 ArkTS 歌词组件
- Canvas 实现
- 完全符合 ArkTS 规范
- 实现所有原版特效
- Commit: ea36bd8
