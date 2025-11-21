/**
 * Canvas歌词播放器完整Demo
 * 展示所有特效功能
 */

import { CanvasLyricPlayerComponent } from '../src/components/CanvasLyricPlayerComponent';
import { LyricLine, LyricWord, LyricPlayerConfig } from '../src/models/LyricModels';

@Entry
@Component
struct CanvasLyricPlayerDemoPage {
  @State private currentTimeMs: number = 0;
  @State private isPlayingState: boolean = false;
  @State private sliderValue: number = 0;

  private lyricPlayerComponent: CanvasLyricPlayerComponent | null = null;
  private timerHandle: number = -1;
  private readonly maxTimeMs: number = 30000;

  // 示例歌词数据
  private sampleLyricsData: Array<Record<string, Object>> = [
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
    {
      words: [
        { word: '我', startTime: 2500, endTime: 2800 },
        { word: '们', startTime: 2800, endTime: 3100 },
        { word: '相', startTime: 3100, endTime: 3600 },
        { word: '遇', startTime: 3600, endTime: 4500 }
      ],
      translatedLyric: 'We met',
      startTime: 2500,
      endTime: 4500,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: 'Like', startTime: 5000, endTime: 5500 },
        { word: ' ', startTime: 5500, endTime: 5500 },
        { word: 'stars', startTime: 5500, endTime: 6200 },
        { word: ' ', startTime: 6200, endTime: 6200 },
        { word: 'in', startTime: 6200, endTime: 6400 },
        { word: ' ', startTime: 6400, endTime: 6400 },
        { word: 'the', startTime: 6400, endTime: 6600 },
        { word: ' ', startTime: 6600, endTime: 6600 },
        { word: 'night', startTime: 6600, endTime: 7500 }
      ],
      translatedLyric: '像夜空中的星星',
      startTime: 5000,
      endTime: 7500,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: '照', startTime: 8000, endTime: 8400 },
        { word: '亮', startTime: 8400, endTime: 9000 },
        { word: '彼', startTime: 9000, endTime: 9400 },
        { word: '此', startTime: 9400, endTime: 9800 },
        { word: '的', startTime: 9800, endTime: 10000 },
        { word: '心', startTime: 10000, endTime: 11000 }
      ],
      translatedLyric: 'Lighting up each other\'s hearts',
      startTime: 8000,
      endTime: 11000,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: '时', startTime: 11500, endTime: 11900 },
        { word: '光', startTime: 11900, endTime: 12500 },
        { word: '荏', startTime: 12500, endTime: 13000 },
        { word: '苒', startTime: 13000, endTime: 13500 }
      ],
      translatedLyric: 'Time flies',
      startTime: 11500,
      endTime: 13500,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: '但', startTime: 18000, endTime: 18400 },
        { word: '爱', startTime: 18400, endTime: 19000 },
        { word: '永', startTime: 19000, endTime: 19600 },
        { word: '恒', startTime: 19600, endTime: 20500 }
      ],
      translatedLyric: 'But love is eternal',
      startTime: 18000,
      endTime: 20500,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: '这', startTime: 21000, endTime: 21300 },
        { word: '份', startTime: 21300, endTime: 21600 },
        { word: '感', startTime: 21600, endTime: 22000 },
        { word: '动', startTime: 22000, endTime: 22800 }
      ],
      translatedLyric: 'This feeling',
      romanLyric: 'zhè fèn gǎn dòng',
      startTime: 21000,
      endTime: 22800,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: 'Forever', startTime: 23500, endTime: 24500 },
        { word: ' ', startTime: 24500, endTime: 24500 },
        { word: 'and', startTime: 24500, endTime: 24700 },
        { word: ' ', startTime: 24700, endTime: 24700 },
        { word: 'ever', startTime: 24700, endTime: 25500 }
      ],
      translatedLyric: '永远永远',
      startTime: 23500,
      endTime: 25500,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: '不', startTime: 26000, endTime: 26400 },
        { word: '会', startTime: 26400, endTime: 26800 },
        { word: '忘', startTime: 26800, endTime: 27500 },
        { word: '记', startTime: 27500, endTime: 28500 }
      ],
      translatedLyric: 'Never forget',
      startTime: 26000,
      endTime: 28500,
      isBG: false,
      isDuet: true
    }
  ];

  aboutToDisappear(): void {
    this.stopPlayback();
  }

  /**
   * 转换数据为类型化对象
   */
  private parseLyricData(): LyricLine[] {
    const lines: LyricLine[] = [];

    this.sampleLyricsData.forEach((lineData: Record<string, Object>) => {
      const wordsData = lineData['words'] as Array<Record<string, Object>>;
      const words: LyricWord[] = wordsData.map((wordData: Record<string, Object>) => {
        return new LyricWord(
          wordData['startTime'] as number,
          wordData['endTime'] as number,
          wordData['word'] as string,
          (wordData['romanWord'] as string) ?? '',
          (wordData['obscene'] as boolean) ?? false
        );
      });

      const line: LyricLine = new LyricLine(
        words,
        lineData['startTime'] as number,
        lineData['endTime'] as number,
        (lineData['translatedLyric'] as string) ?? '',
        (lineData['romanLyric'] as string) ?? '',
        (lineData['isBG'] as boolean) ?? false,
        (lineData['isDuet'] as boolean) ?? false
      );

      lines.push(line);
    });

    return lines;
  }

  /**
   * 开始播放
   */
  private startPlayback(): void {
    this.isPlayingState = true;
    let lastTime: number = Date.now();

    this.timerHandle = setInterval(() => {
      const now: number = Date.now();
      const delta: number = now - lastTime;
      lastTime = now;

      this.currentTimeMs += delta;
      this.sliderValue = this.currentTimeMs;

      if (this.lyricPlayerComponent) {
        this.lyricPlayerComponent.setCurrentTime(this.currentTimeMs);
      }

      if (this.currentTimeMs > this.maxTimeMs) {
        this.currentTimeMs = 0;
      }
    }, 16);
  }

  /**
   * 停止播放
   */
  private stopPlayback(): void {
    this.isPlayingState = false;
    if (this.timerHandle !== -1) {
      clearInterval(this.timerHandle);
      this.timerHandle = -1;
    }
  }

  /**
   * 切换播放状态
   */
  private togglePlayback(): void {
    if (this.isPlayingState) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  /**
   * 重置播放
   */
  private resetPlayback(): void {
    this.stopPlayback();
    this.currentTimeMs = 0;
    this.sliderValue = 0;
    if (this.lyricPlayerComponent) {
      this.lyricPlayerComponent.setCurrentTime(0);
    }
  }

  /**
   * 跳转
   */
  private seekTo(timeMs: number): void {
    this.currentTimeMs = timeMs;
    this.sliderValue = timeMs;
    if (this.lyricPlayerComponent) {
      this.lyricPlayerComponent.setCurrentTime(timeMs);
    }
  }

  /**
   * 格式化时间
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
        Text('Apple Music 风格歌词 (Canvas版本)')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(Color.White)
      }
      .width('100%')
      .height(56)
      .padding({ left: 16, right: 16 })
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#1a1a1a')

      // 歌词播放器
      Stack() {
        CanvasLyricPlayerComponent({
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
          .onAppear(() => {
            const config: LyricPlayerConfig = LyricPlayerConfig.create();
            this.lyricPlayerComponent = new CanvasLyricPlayerComponent();
            this.lyricPlayerComponent.playerConfig = config;

            const lines: LyricLine[] = this.parseLyricData();
            this.lyricPlayerComponent.setLyricLines(lines);
          })
      }
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

          Button({ type: ButtonType.Circle }) {
            Text(this.isPlayingState ? '❚❚' : '▶')
              .fontSize(this.isPlayingState ? 20 : 24)
              .fontColor(Color.White)
          }
          .width(60)
          .height(60)
          .backgroundColor('#1DB954')
          .onClick(() => {
            this.togglePlayback();
          })

          Blank().width(20)

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
