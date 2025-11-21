/**
 * ✅ Canvas 歌词播放器完整 Demo
 * 使用声明式 UI 模式，通过 @Prop 传递数据
 * 完全符合 ArkTS 规范
 */

import { CanvasLyricPlayerComponent } from '../src/components/CanvasLyricPlayerComponent';
import { LyricLine, LyricWord, LyricPlayerConfig } from '../src/models/LyricModels';

/**
 * Demo 页面组件
 */
@Entry
@Component
struct CanvasLyricPlayerDemoPage {
  // ============================================================
  // @State 属性：在父组件中维护状态
  // ============================================================

  /** 歌词数据 - 🔥 关键：在声明时就初始化，而不是在 aboutToAppear() 中 */
  @State lyrics: LyricLine[] = CanvasLyricPlayerDemoPage.createSampleLyrics();
  /** 当前播放时间（毫秒） */
  @State currentTimeMs: number = 0;
  /** 是否正在播放 */
  @State isPlaying: boolean = false;
  /** 进度条值 */
  @State sliderValue: number = 0;

  /** 定时器句柄 */
  private timerHandle: number = -1;
  /** 最大播放时间 */
  private readonly maxTimeMs: number = 30000;

  /**
   * 创建示例歌词数据
   * 🔥 必须是静态方法，以便在 @State 声明时调用
   */
  private static createSampleLyrics(): LyricLine[] {
    const lines: LyricLine[] = [];

    // 第1行：在这个世界
    const line1Words: LyricWord[] = [
      new LyricWord(0, 300, '在'),
      new LyricWord(300, 600, '这'),
      new LyricWord(600, 900, '个'),
      new LyricWord(900, 1500, '世'),
      new LyricWord(1500, 2000, '界')
    ];
    lines.push(new LyricLine(line1Words, 0, 2000, 'In this world'));

    // 第2行：我们相遇
    const line2Words: LyricWord[] = [
      new LyricWord(2500, 2800, '我'),
      new LyricWord(2800, 3100, '们'),
      new LyricWord(3100, 3600, '相'),
      new LyricWord(3600, 4500, '遇')
    ];
    lines.push(new LyricLine(line2Words, 2500, 4500, 'We met'));

    // 第3行：Like stars in the night
    const line3Words: LyricWord[] = [
      new LyricWord(5000, 5500, 'Like'),
      new LyricWord(5500, 6200, 'stars'),
      new LyricWord(6200, 6400, 'in'),
      new LyricWord(6400, 6600, 'the'),
      new LyricWord(6600, 7500, 'night')
    ];
    lines.push(new LyricLine(line3Words, 5000, 7500, '像夜空中的星星'));

    // 第4行：照亮彼此的心
    const line4Words: LyricWord[] = [
      new LyricWord(8000, 8400, '照'),
      new LyricWord(8400, 9000, '亮'),
      new LyricWord(9000, 9400, '彼'),
      new LyricWord(9400, 9800, '此'),
      new LyricWord(9800, 10000, '的'),
      new LyricWord(10000, 11000, '心')
    ];
    lines.push(new LyricLine(line4Words, 8000, 11000, 'Lighting up each other\'s hearts'));

    // 第5行：时光荏苒
    const line5Words: LyricWord[] = [
      new LyricWord(11500, 11900, '时'),
      new LyricWord(11900, 12500, '光'),
      new LyricWord(12500, 13000, '荏'),
      new LyricWord(13000, 13500, '苒')
    ];
    lines.push(new LyricLine(line5Words, 11500, 13500, 'Time flies'));

    // 第6行：间奏（无歌词）
    const line6Words: LyricWord[] = [];
    lines.push(new LyricLine(line6Words, 14000, 17500, '', '', true));  // isBG = true

    // 第7行：但爱永恒
    const line7Words: LyricWord[] = [
      new LyricWord(18000, 18400, '但'),
      new LyricWord(18400, 19000, '爱'),
      new LyricWord(19000, 19600, '永'),
      new LyricWord(19600, 20500, '恒')
    ];
    lines.push(new LyricLine(line7Words, 18000, 20500, 'But love is eternal'));

    // 第8行：这份感动（带音译）
    const line8Words: LyricWord[] = [
      new LyricWord(21000, 21300, '这'),
      new LyricWord(21300, 21600, '份'),
      new LyricWord(21600, 22000, '感'),
      new LyricWord(22000, 22800, '动')
    ];
    lines.push(new LyricLine(line8Words, 21000, 22800, 'This feeling', 'zhè fèn gǎn dòng'));

    // 第9行：Forever and ever
    const line9Words: LyricWord[] = [
      new LyricWord(23500, 24500, 'Forever'),
      new LyricWord(24500, 24700, 'and'),
      new LyricWord(24700, 25500, 'ever')
    ];
    lines.push(new LyricLine(line9Words, 23500, 25500, '永远永远'));

    // 第10行：不会忘记（对唱模式）
    const line10Words: LyricWord[] = [
      new LyricWord(26000, 26400, '不'),
      new LyricWord(26400, 26800, '会'),
      new LyricWord(26800, 27500, '忘'),
      new LyricWord(27500, 28500, '记')
    ];
    lines.push(new LyricLine(line10Words, 26000, 28500, 'Never forget', '', false, true)); // isDuet = true

    return lines;
  }

  /**
   * 组件即将出现
   * 🔥 注意：歌词数据已在 @State 声明时初始化，不需要在这里再次设置
   */
  aboutToAppear(): void {
    console.info('[Demo] 🎬 Loaded', this.lyrics.length, 'lyrics');
  }

  /**
   * 组件即将消失
   */
  aboutToDisappear(): void {
    this.stopPlayback();
  }

  /**
   * 开始播放
   */
  private startPlayback(): void {
    console.info('[Demo] ▶️ Start playback');
    this.isPlaying = true;
    let lastTime: number = Date.now();

    this.timerHandle = setInterval(() => {
      const now: number = Date.now();
      const delta: number = now - lastTime;
      lastTime = now;

      // 🔥 关键：直接更新 @State 属性
      // 子组件通过 @Prop/@Watch 自动响应变化
      this.currentTimeMs += delta;
      this.sliderValue = this.currentTimeMs;

      // 循环播放
      if (this.currentTimeMs > this.maxTimeMs) {
        this.currentTimeMs = 0;
        console.info('[Demo] 🔄 Loop playback');
      }
    }, 16);  // ~60fps
  }

  /**
   * 停止播放
   */
  private stopPlayback(): void {
    console.info('[Demo] ⏸️ Stop playback');
    this.isPlaying = false;
    if (this.timerHandle !== -1) {
      clearInterval(this.timerHandle);
      this.timerHandle = -1;
    }
  }

  /**
   * 切换播放状态
   */
  private togglePlayback(): void {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  /**
   * 重置播放
   */
  private resetPlayback(): void {
    console.info('[Demo] 🔄 Reset playback');
    this.stopPlayback();
    this.currentTimeMs = 0;
    this.sliderValue = 0;
  }

  /**
   * 跳转到指定时间
   */
  private seekTo(timeMs: number): void {
    console.info('[Demo] ⏩ Seek to:', timeMs);
    this.currentTimeMs = timeMs;
    this.sliderValue = timeMs;
  }

  /**
   * 格式化时间显示
   */
  private formatTime(ms: number): string {
    const totalSeconds: number = Math.floor(ms / 1000);
    const minutes: number = Math.floor(totalSeconds / 60);
    const seconds: number = totalSeconds % 60;
    const secondsStr: string = seconds < 10 ? '0' + seconds : seconds.toString();
    return minutes + ':' + secondsStr;
  }

  build() {
    Column() {
      // 标题栏
      Row() {
        Text('Apple Music 风格歌词')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(Color.White)
      }
      .width('100%')
      .height(56)
      .padding({ left: 16, right: 16 })
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#1a1a1a')

      // 🔥 关键：通过 @Prop 传递数据，完全符合 ArkTS 声明式 UI 规范
      // ✅ 不需要保存组件引用
      // ✅ 不需要在 onAppear 中调用组件方法
      // ✅ 不需要使用 new CanvasLyricPlayerComponent()
      // ✅ 数据变化时子组件自动响应
      CanvasLyricPlayerComponent({
        lyricLines: this.lyrics,          // ← 传递歌词数据
        currentTime: this.currentTimeMs,  // ← 传递当前时间（自动触发 @Watch）
        playerConfig: LyricPlayerConfig.create({
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
        })
      })
        .layoutWeight(1)

      // 控制栏
      Column() {
        // 进度条
        Row() {
          Text(this.formatTime(this.currentTimeMs))
            .fontSize(12)
            .fontColor('#999999')
            .width(50)

          Slider({
            value: this.sliderValue,
            min: 0,
            max: this.maxTimeMs,
            step: 100
          })
            .layoutWeight(1)
            .blockColor(Color.White)
            .trackColor('#333333')
            .selectedColor('#1DB954')
            .onChange((value: number) => {
              this.seekTo(value);
            })

          Text(this.formatTime(this.maxTimeMs))
            .fontSize(12)
            .fontColor('#999999')
            .width(50)
            .textAlign(TextAlign.End)
        }
        .width('100%')
        .padding({ left: 20, right: 20 })

        // 控制按钮
        Row() {
          // 重置按钮
          Button({ type: ButtonType.Circle }) {
            Text('⟲')
              .fontSize(24)
              .fontColor(Color.White)
          }
          .width(50)
          .height(50)
          .backgroundColor('#333333')
          .onClick(() => {
            this.resetPlayback();
          })

          Blank().width(20)

          // 播放/暂停按钮
          Button({ type: ButtonType.Circle }) {
            Text(this.isPlaying ? '❚❚' : '▶')
              .fontSize(this.isPlaying ? 20 : 24)
              .fontColor(Color.White)
          }
          .width(60)
          .height(60)
          .backgroundColor('#1DB954')
          .onClick(() => {
            this.togglePlayback();
          })

          Blank().width(20)

          // 快进按钮
          Button({ type: ButtonType.Circle }) {
            Text('⏩')
              .fontSize(20)
              .fontColor(Color.White)
          }
          .width(50)
          .height(50)
          .backgroundColor('#333333')
          .onClick(() => {
            this.seekTo(Math.min(this.currentTimeMs + 5000, this.maxTimeMs));
          })
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 10 })
        .justifyContent(FlexAlign.Center)
      }
      .width('100%')
      .padding({ top: 20, bottom: 20 })
      .backgroundColor('#1a1a1a')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
  }
}
