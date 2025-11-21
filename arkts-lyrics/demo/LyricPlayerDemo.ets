/**
 * 鸿蒙ArkTS版本 - Apple Music风格歌词播放器
 * Demo示例
 */

import { LyricPlayer } from '../src/components/LyricPlayer';
import { LyricLine, LyricPlayerConfig } from '../src/interfaces/LyricInterfaces';

@Entry
@Component
struct LyricPlayerDemoPage {
  @State currentTime: number = 0;
  @State isPlaying: boolean = false;
  private lyricPlayerRef: LyricPlayer | null = null;
  private timer: number = -1;

  // 示例歌词数据
  private sampleLyrics: LyricLine[] = [
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
    // 长间奏
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
      isDuet: true // 对唱效果
    }
  ];

  // 播放器配置
  private playerConfig: LyricPlayerConfig = {
    alignAnchor: 'center',
    alignPosition: 0.4,
    enableScale: true,
    enableBlur: true,
    enableSpring: true,
    wordFadeWidth: 0.5,
    hidePassed: false,
    showTranslation: true,
    showRoman: false
  };

  aboutToAppear() {
    // 初始化时设置歌词
    if (this.lyricPlayerRef) {
      this.lyricPlayerRef.setLyricLines(this.sampleLyrics);
    }
  }

  aboutToDisappear() {
    this.stopPlayback();
  }

  /**
   * 开始播放
   */
  startPlayback() {
    this.isPlaying = true;
    let lastTime = Date.now();

    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      // 更新播放时间
      this.currentTime += delta;

      // 更新歌词播放器
      if (this.lyricPlayerRef) {
        this.lyricPlayerRef.setCurrentTime(this.currentTime);
        this.lyricPlayerRef.onFrameUpdate(delta);
      }

      // 循环播放
      if (this.currentTime > 30000) {
        this.currentTime = 0;
      }
    }, 16); // ~60fps
  }

  /**
   * 停止播放
   */
  stopPlayback() {
    this.isPlaying = false;
    if (this.timer !== -1) {
      clearInterval(this.timer);
      this.timer = -1;
    }
  }

  /**
   * 切换播放状态
   */
  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  /**
   * 重置播放
   */
  resetPlayback() {
    this.stopPlayback();
    this.currentTime = 0;
    if (this.lyricPlayerRef) {
      this.lyricPlayerRef.setCurrentTime(0);
    }
  }

  /**
   * 跳转到指定时间
   */
  seekTo(time: number) {
    this.currentTime = time;
    if (this.lyricPlayerRef) {
      this.lyricPlayerRef.setCurrentTime(time);
    }
  }

  build() {
    Column() {
      // 标题栏
      Row() {
        Text('Apple Music 风格歌词')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor(Color.White)
      }
      .width('100%')
      .height(60)
      .padding({ left: 20, right: 20 })
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#1a1a1a')

      // 歌词播放器
      Stack() {
        LyricPlayer({
          config: this.playerConfig
        })
          .onReady((player: LyricPlayer) => {
            this.lyricPlayerRef = player;
            player.setLyricLines(this.sampleLyrics);
          })
      }
      .layoutWeight(1)

      // 控制栏
      Column() {
        // 进度条
        Row() {
          Text(this.formatTime(this.currentTime))
            .fontSize(12)
            .fontColor('#999999')
            .width(50)

          Slider({
            value: this.currentTime,
            min: 0,
            max: 30000,
            step: 100
          })
            .layoutWeight(1)
            .blockColor(Color.White)
            .trackColor('#333333')
            .selectedColor('#1DB954')
            .onChange((value: number) => {
              this.seekTo(value);
            })

          Text(this.formatTime(30000))
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
            Image($r('sys.symbol.arrow_counterclockwise'))
              .width(24)
              .height(24)
              .fillColor(Color.White)
          }
          .width(50)
          .height(50)
          .backgroundColor('#333333')
          .onClick(() => {
            this.resetPlayback();
          })

          Blank()
            .width(20)

          // 播放/暂停按钮
          Button({ type: ButtonType.Circle }) {
            if (this.isPlaying) {
              Image($r('sys.symbol.pause_fill'))
                .width(30)
                .height(30)
                .fillColor(Color.White)
            } else {
              Image($r('sys.symbol.play_fill'))
                .width(30)
                .height(30)
                .fillColor(Color.White)
            }
          }
          .width(60)
          .height(60)
          .backgroundColor('#1DB954')
          .onClick(() => {
            this.togglePlayback();
          })

          Blank()
            .width(20)

          // 快进按钮
          Button({ type: ButtonType.Circle }) {
            Image($r('sys.symbol.forward_15'))
              .width(24)
              .height(24)
              .fillColor(Color.White)
          }
          .width(50)
          .height(50)
          .backgroundColor('#333333')
          .onClick(() => {
            this.seekTo(Math.min(this.currentTime + 5000, 30000));
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

  /**
   * 格式化时间
   */
  formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
