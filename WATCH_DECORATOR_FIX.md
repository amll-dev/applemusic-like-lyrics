# @Watch 装饰器修复黑屏问题

## 🔍 问题分析

通过日志分析发现了黑屏的根本原因：

### 时间线（来自 HiLog）

```
22:48:18.515 - [LyricPlayer] aboutToAppear: Lyrics count: 0  ⚠️
22:48:18.523 - [Demo] Lyrics count: 6                        ✓
22:48:18.570 - [LyricPlayer] Line states count: 0             ⚠️
22:48:18.570 - [LyricPlayer] ✓ Rendered 0 lines              ⚠️
```

### 问题描述

1. **组件初始化早于数据准备**：
   - `CanvasLyricPlayerComponent.aboutToAppear()` 先执行
   - 此时 `lyricLines` 是空数组 `[]`
   - 控制器被创建但没有歌词数据

2. **Demo 后续加载数据**：
   - `Demo.aboutToAppear()` 后执行
   - 创建了 6 行歌词数据
   - 更新了 `@State lyrics` 变量

3. **组件未响应数据变化**：
   - Demo 的 `@State lyrics` 变化应该传递给组件的 `@Prop lyricLines`
   - 但是 `aboutToUpdate()` 生命周期方法**未被调用**
   - 组件的 `lyricLines` 保持为空数组
   - 即使 Canvas 尺寸正确（364x540），也渲染了 0 行

## ✅ 解决方案

### 使用 @Watch 装饰器

`@Watch` 是 ArkTS 提供的更可靠的属性变化监听机制：

```typescript
// 之前：只有 @Prop
@Prop lyricLines: LyricLine[] = [];

// 之后：添加 @Watch 监听
@Prop @Watch('onLyricLinesChanged') lyricLines: LyricLine[] = [];
```

### 添加回调方法

```typescript
/**
 * 歌词数据变化时调用
 * 🔥 通过 @Watch('onLyricLinesChanged') 自动触发
 */
onLyricLinesChanged(): void {
  console.info('[LyricPlayer] 🔄 onLyricLinesChanged() TRIGGERED');
  console.info('[LyricPlayer]   - New lyrics count:', this.lyricLines.length);

  if (!this.controller) {
    console.warn('[LyricPlayer] ⚠️ Controller not initialized yet');
    return;
  }

  if (this.lyricLines.length === 0) {
    console.warn('[LyricPlayer] ⚠️ Lyrics array is empty');
    return;
  }

  // 重新设置歌词数据到控制器
  console.info('[LyricPlayer] 📝 Setting new lyrics to controller...');
  this.controller.setLyricLines(this.lyricLines);
  console.info('[LyricPlayer] ✓ Lyrics set successfully');

  // 立即重绘
  console.info('[LyricPlayer] 🎨 Calling drawFrame after lyrics change...');
  this.drawFrame();
  console.info('[LyricPlayer] ========================================');
}
```

## 📊 预期行为

应用此修复后，日志应该显示：

```
22:48:18.515 - [LyricPlayer] aboutToAppear: Lyrics count: 0
22:48:18.523 - [Demo] Lyrics count: 6
22:48:18.524 - [LyricPlayer] 🔄 onLyricLinesChanged() TRIGGERED  ← 新增！
22:48:18.524 - [LyricPlayer]   - New lyrics count: 6            ← 新增！
22:48:18.524 - [LyricPlayer] 📝 Setting new lyrics...           ← 新增！
22:48:18.524 - [LyricPlayer] 🎨 Calling drawFrame...            ← 新增！
22:48:18.570 - [LyricPlayer] Line states count: 6               ← 修复！
22:48:18.570 - [LyricPlayer] ✓ Rendered 6 lines                 ← 修复！
```

## 🔑 关键点

### 1. @Watch vs aboutToUpdate

- **aboutToUpdate()**：
  - 生命周期方法，理论上在组件更新时调用
  - 实际测试中**不可靠**，经常不被触发
  - 不推荐用于 @Prop 变化监听

- **@Watch**：
  - 专门为属性变化设计的装饰器
  - 在 @Prop 值变化时**立即触发**
  - 更可靠、更精确

### 2. 组件生命周期顺序

在 ArkTS 中，生命周期顺序可能是：

```
1. build() 构建
2. aboutToAppear() 初始化
3. onReady() Canvas 准备
4. onAreaChange() 尺寸变化
5. @Watch 回调 (当 @Prop 变化时)
```

**父组件的 aboutToAppear() 可能在子组件之后执行！**

### 3. 数据传递时机

使用 @Watch 可以确保：
- 无论数据何时准备好
- 无论父组件何时更新数据
- 子组件都能立即响应

## 🧪 测试步骤

1. 拉取最新代码：
```bash
git pull origin claude/arkts-lyrics-conversion-018gKn714owqRNCV2MkqEcqB
```

2. 清理并重新构建项目

3. 运行应用，查看 HiLog 日志：
   - 应该看到 `onLyricLinesChanged()` 被触发
   - 应该看到歌词数量从 0 变为 6
   - 应该看到 "Rendered 6 lines"
   - **屏幕应该显示歌词！**

## 📚 参考

- HarmonyOS 官方文档：[@Watch 装饰器](https://developer.harmonyos.com/cn/docs/documentation/doc-guides-V3/arkts-watch-0000001580025781-V3)
- 本项目架构文档：`REFACTOR_COMPLETE.md`
- 黑屏问题分析：`BLACK_SCREEN_FIX.md`
