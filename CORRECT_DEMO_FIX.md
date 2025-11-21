# CorrectDemo.ets 数据传递问题修复

## 🔍 问题发现

通过日志分析发现用户实际运行的是 `CorrectDemo.ets` 而不是 `CanvasLyricPlayerDemo.ets`。

**问题日志**：
```
[LyricPlayer] 🎬 Initialize - Lyrics: 0    ← 组件收到0行歌词
[Demo] Lyrics count: 6                    ← Demo有6行歌词
[LyricPlayer] ⚠️ Rendered 0 lines         ← 渲染0行
```

说明：Demo 有数据，但组件没有收到！

## 🐛 发现的两个严重问题

### 问题 1：@State 初始化时机错误

**错误代码**（`CorrectDemo.ets:16-103`）：
```typescript
// ❌ 错误：声明时为空数组
@State lyrics: LyricLine[] = [];

// ❌ 错误：在 aboutToAppear() 中初始化
aboutToAppear(): void {
  this.lyrics = this.createSampleLyrics();
}
```

**问题原因**：
- ArkTS 生命周期顺序：`build()` → `aboutToAppear()`
- `build()` 执行时 `lyrics` 还是空数组 `[]`
- 组件创建时接收到的是空数组
- `aboutToAppear()` 后才设置数据，但为时已晚

**修复代码**：
```typescript
// ✅ 正确：在 @State 声明时初始化
@State lyrics: LyricLine[] = (() => {
  const lines = CorrectCanvasLyricPlayerDemo.createSampleLyrics();
  console.info('[Demo] 📦 @State lyrics initialized:', lines.length, 'lines');
  return lines;
})();

// ✅ aboutToAppear 只用于日志
aboutToAppear(): void {
  console.info('[Demo] 🎬 aboutToAppear - Lyrics:', this.lyrics.length);
}

// ✅ createSampleLyrics 必须是静态方法
private static createSampleLyrics(): LyricLine[] {
  // ...
}
```

### 问题 2：组件创建时缺少必需参数

**错误代码**（`CorrectDemo.ets:210-223`）：
```typescript
// ❌ 错误：没有传递 lyricLines 和 currentTime
CanvasLyricPlayerComponent({
  playerConfig: LyricPlayerConfig.create({
    alignAnchor: 'center',
    alignPosition: 0.4,
    // ...
  })
})
```

**问题原因**：
- 组件需要 `@Prop lyricLines` 和 `@Prop currentTime`
- Demo 没有传递这两个参数
- 组件使用默认值（空数组和 0）
- 即使 Demo 有数据，组件也收不到

**修复代码**：
```typescript
// ✅ 正确：必须传递 lyricLines 和 currentTime
CanvasLyricPlayerComponent({
  lyricLines: this.lyrics,          // ← 🔥 传递歌词数据
  currentTime: this.currentTimeMs,  // ← 🔥 传递当前时间
  playerConfig: LyricPlayerConfig.create({
    alignAnchor: 'center',
    alignPosition: 0.4,
    // ...
  })
})
```

## 📊 数据流对比

### 修复前（错误）
```
1. @State lyrics = []                    ← 空数组
2. build() 执行
   ├─ 创建组件
   ├─ lyricLines: 未传递 → 使用默认值 []  ← 问题！
   └─ currentTime: 未传递 → 使用默认值 0
3. aboutToAppear() 执行
   └─ this.lyrics = [6行数据]           ← 太晚了
4. 组件的 @Prop lyricLines = []         ← 永远是空
5. 渲染 0 行                             ← 黑屏
```

### 修复后（正确）
```
1. @State lyrics = [6行数据]            ← 立即初始化
2. build() 执行
   ├─ 创建组件
   ├─ lyricLines: this.lyrics → [6行]   ← ✓ 正确传递
   └─ currentTime: this.currentTimeMs → 0
3. 组件的 @Prop lyricLines = [6行]      ← ✓ 正确接收
4. aboutToAppear() 执行
   └─ controller.setLyricLines([6行])   ← ✓ 设置到控制器
5. 渲染 6 行                             ← ✓ 显示歌词
```

## 🎯 关键知识点

### 1. ArkTS 组件生命周期顺序

```typescript
@Component
struct MyComponent {
  @State data: number[] = [];  // ← 1️⃣ 最先执行

  aboutToAppear() {             // ← 3️⃣ 第三执行
    // 这里设置数据太晚了！
  }

  build() {                     // ← 2️⃣ 第二执行
    // 这里使用的是 @State 声明时的初始值
  }
}
```

**执行顺序**：
1. **@State 变量初始化** - 类属性声明时
2. **build()** - 构建 UI 树
3. **aboutToAppear()** - 组件即将出现

### 2. @Prop 参数传递是强制的

```typescript
// 组件定义
@Component
export struct MyComponent {
  @Prop data: string[] = [];  // ← 有默认值
  @Prop time: number = 0;      // ← 有默认值
}

// ❌ 错误：不传参数，使用默认值
MyComponent({})

// ✅ 正确：必须显式传递参数
MyComponent({
  data: this.myData,
  time: this.myTime
})
```

### 3. @Watch 只监听"变化"

```typescript
@Prop @Watch('onChange') data: string[] = [];

onChange() {
  console.log('Data changed');
}

// Case 1: 初始化赋值 - ❌ @Watch 不触发
@State data: string[] = [];
// onChange() 不会被调用

// Case 2: 后续赋值 - ✅ @Watch 触发
@State data: string[] = [];
aboutToAppear() {
  this.data = ['a', 'b'];  // ← onChange() 被调用
}

// Case 3: @State 初始化 - ✅ 直接有数据
@State data: string[] = ['a', 'b'];
// 不需要 @Watch，因为 build() 时数据已经有了
```

## 🧪 测试验证

### 预期日志输出

修复后应该看到：

```
[Demo] 📦 @State lyrics initialized: 6 lines       ← 1. @State 初始化
[Demo] 🏗️ build() - Passing lyrics: 6 lines       ← 2. build() 传递数据
[LyricPlayer] 🎬 Initialize - Lyrics: 6            ← 3. 组件接收数据
[LyricPlayer] ✓ Initial lyrics loaded: 6           ← 4. 设置到控制器
[Demo] 🎬 aboutToAppear - Lyrics: 6                ← 5. aboutToAppear 确认
[LyricPlayer] 📏 Size: 365 x 541                   ← 6. 尺寸设置
✓ 屏幕显示歌词                                      ← 7. 成功渲染！
```

### 如果还是有问题

如果日志中看到：
- `@State lyrics initialized: 0` → createSampleLyrics() 返回了空数组
- `build() - Passing lyrics: 0` → @State 初始化失败
- `Initialize - Lyrics: 6` 但 `Rendered 0 lines` → 控制器或渲染器问题

## 📝 修复清单

- [x] 将 `createSampleLyrics()` 改为静态方法
- [x] 在 `@State` 声明时初始化歌词数据
- [x] 移除 `aboutToAppear()` 中的数据初始化
- [x] 组件创建时传递 `lyricLines` 参数
- [x] 组件创建时传递 `currentTime` 参数
- [x] 添加数据传递路径的日志

## 🎉 预期结果

修复后应该能看到：
- ✅ 歌词正常显示
- ✅ 滚动动画正常
- ✅ 渐变高亮效果
- ✅ 时间同步准确

如果还有问题，请提供完整的新日志输出！
