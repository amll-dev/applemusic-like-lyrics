/**
 * 歌词解析器 Demo
 * 从 JSON 资源加载网易云音乐格式歌词
 */

import { CanvasLyricPlayerComponent } from '../src/components/CanvasLyricPlayerComponent';
import { LyricLine, LyricPlayerConfig } from '../src/models/LyricModels';
import { parseLyricResponse } from '../src/utils/LyricParser';

@Entry
@Component
struct LyricParserDemo {
  @State lyrics: LyricLine[] = [];
  @State currentTimeMs: number = 0;
  @State isPlaying: boolean = false;
  @State isLoading: boolean = true;
  @State sliderValue: number = 0;

  private timerHandle: number = -1;
  private maxTimeMs: number = 240000; // 4分钟

  aboutToAppear(): void {
    this.loadLyrics();
  }

  aboutToDisappear(): void {
    this.stopPlayback();
  }

  /**
   * 从 string.json 资源同步获取字符串
   * @param resource 资源引用，如 $r('app.string.testLrc')
   */
  private resourceToString(resource: Resource): string {
    return getContext(this).resourceManager.getStringSync(resource);
  }

  /**
   * 加载歌词
   */
  private loadLyrics(): void {
    try {
      // 从 string.json 资源加载歌词 JSON
      // 使用方式: const jsonStr: string = this.resourceToString($r('app.string.testLrc'));
      // this.lyrics = parseLyricResponse(jsonStr);

      // Demo: 使用内嵌数据
      const lyricData: object = this.getSampleLyricData();
      this.lyrics = parseLyricResponse(lyricData);

      // 更新最大时间
      if (this.lyrics.length > 0) {
        const lastLine: LyricLine = this.lyrics[this.lyrics.length - 1];
        this.maxTimeMs = lastLine.endTime + 5000;
      }

      console.info(`[Demo] 加载完成: ${this.lyrics.length} 行歌词`);
      this.isLoading = false;
    } catch (e) {
      console.error('[Demo] 加载歌词失败:', e);
      this.isLoading = false;
    }
  }

  /**
   * 获取示例歌词数据（网易云音乐 API 格式）
   */
  private getSampleLyricData(): object {
    return {
      "code": 200,
      "lrc": {
        "version": 1,
        "lyric": "[00:00.00]Sample Song\n[00:05.00]This is a test"
      },
      "tlyric": {
        "version": 1,
        "lyric": "[00:00.88]我为你痴狂\n[00:10.45]我为你痴狂\n[00:21.49]我能感受浑身血液为你沸腾"
      },
      "yrc": {
        "version": 4,
        "lyric": "[540,1320](540,390,0)Mad (930,540,0)about (1470,390,0)you\n" +
          "[10050,1350](10050,390,0)Mad (10440,660,0)about (11100,300,0)you\n" +
          "[15720,3000](15720,330,0)I'm (16050,540,0)mad(16590,0,0), (16590,600,0)mad(17190,0,0), (17190,570,0)mad(17760,0,0), (17760,960,0)mad\n" +
          "[19620,1320](19620,330,0)Mad (19950,540,0)about (20490,450,0)you\n" +
          "[21060,2310](21060,300,0)I (21360,360,0)feel (21720,180,0)the (21900,630,0)magic (22530,150,0)in (22680,180,0)my (22860,510,0)veins\n" +
          "[25800,2760](25800,360,0)It's (26160,330,0)like (26490,180,0)I'm (26670,750,0)sipping (27420,90,0)a (27510,1050,0)potion\n" +
          "[28560,1770](28560,480,0)Only (29040,330,0)you (29370,180,0)can (29550,270,0)give (29820,150,0)to (29970,360,0)me\n" +
          "[30570,3930](30570,330,0)It (30900,330,0)burns (31230,240,0)me (31470,480,0)higher (31950,300,0)than (32250,60,0)a (32310,2190,0)flame\n" +
          "[35310,1260](35310,420,0)And (35730,150,0)I (35880,390,0)can't (36270,300,0)help\n" +
          "[36570,3180](36570,360,0)But (36930,870,0)ignite (37800,120,0)it (37920,300,0)so (38220,780,0)light (39000,150,0)it (39150,600,0)comes\n" +
          "[39780,1860](39780,180,0)When (39960,150,0)you (40110,240,0)get (40350,330,0)close (40680,180,0)to (40860,780,0)me\n" +
          "[42120,1920](42120,210,0)I (42330,210,0)don't (42540,210,0)know (42750,300,0)what (43050,240,0)to (43290,750,0)think\n" +
          "[44040,2310](44040,450,0)It's (44490,450,0)making (44940,180,0)it (45120,300,0)hard (45420,180,0)to (45600,750,0)speak\n" +
          "[46350,2550](46350,570,0)Right (46920,270,0)now (47190,180,0)to (47370,480,0)you(47850,210,0), (48060,300,0)now (48360,150,0)to (48510,390,0)you\n" +
          "[48900,1950](48900,330,0)My (49230,420,0)body's (49650,240,0)feeling (49890,960,0)counterfeit\n" +
          "[51600,2220](51600,420,0)Maybe (52020,240,0)I'm (52260,540,0)going (52800,1020,0)crazy\n" +
          "[54000,2400](54000,210,0)No(54210,0,0), (54210,180,0)let's (54390,240,0)not (54630,300,0)make (54930,870,0)believe (55800,600,0)this\n" +
          "[56430,2130](56430,270,0)All (56700,750,0)because(57450,150,0), (57600,300,0)all (57900,660,0)because\n" +
          "[58560,2670](58560,210,0)I'm (58770,510,0)mad(59280,0,0), (59280,690,0)mad(59970,0,0), (59970,360,0)mad (60330,540,0)about (60870,360,0)you"
      }
    };
  }

  private startPlayback(): void {
    this.isPlaying = true;
    let lastTime: number = Date.now();
    console.info('[Demo] ▶️ Start playback');

    this.timerHandle = setInterval(() => {
      const now: number = Date.now();
      const delta: number = now - lastTime;
      lastTime = now;

      this.currentTimeMs += delta;
      this.sliderValue = this.currentTimeMs;

      if (this.currentTimeMs > this.maxTimeMs) {
        this.currentTimeMs = 0;
      }
    }, 8); // 120Hz = 8ms
  }

  private stopPlayback(): void {
    this.isPlaying = false;
    if (this.timerHandle !== -1) {
      clearInterval(this.timerHandle);
      this.timerHandle = -1;
    }
    console.info('[Demo] ⏸️ Stop playback');
  }

  private togglePlayback(): void {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

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
        Text('歌词解析器 Demo')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(Color.White)
      }
      .width('100%')
      .height(56)
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#1a1a1a')

      if (this.isLoading) {
        // 加载中
        Column() {
          LoadingProgress()
            .width(50)
            .height(50)
            .color(Color.White)
          Text('加载歌词中...')
            .fontSize(14)
            .fontColor('#888888')
            .margin({ top: 16 })
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        // 歌词播放器
        CanvasLyricPlayerComponent({
          lyricLines: this.lyrics,
          currentTime: this.currentTimeMs,
          playerConfig: LyricPlayerConfig.create({
            alignAnchor: 'center',
            alignPosition: 0.4,
            enableScale: true,
            enableBlur: false,
            enableSpring: true,
            enableEmphasize: true,
            enableGlow: true,
            showTranslation: true,
            showRoman: false,
            useCanvas: true
          })
        })
          .layoutWeight(1)
      }

      // 控制栏
      Column() {
        // 进度条
        Row() {
          Text(this.formatTime(this.currentTimeMs))
            .fontSize(12)
            .fontColor('#888888')
            .width(50)

          Slider({
            value: this.sliderValue,
            min: 0,
            max: this.maxTimeMs,
            style: SliderStyle.OutSet
          })
            .layoutWeight(1)
            .blockColor(Color.White)
            .trackColor('#333333')
            .selectedColor('#1DB954')
            .onChange((value: number) => {
              this.currentTimeMs = value;
              this.sliderValue = value;
              console.info(`[Demo] ⏩ Seek to: ${Math.floor(value)}`);
            })

          Text(this.formatTime(this.maxTimeMs))
            .fontSize(12)
            .fontColor('#888888')
            .width(50)
        }
        .width('100%')
        .padding({ left: 16, right: 16 })

        // 播放按钮
        Row() {
          Button(this.isPlaying ? '暂停' : '播放')
            .onClick(() => this.togglePlayback())
            .width(120)
            .height(44)
            .backgroundColor(this.isPlaying ? '#333333' : '#1DB954')

          Button('重置')
            .onClick(() => {
              this.stopPlayback();
              this.currentTimeMs = 0;
              this.sliderValue = 0;
            })
            .width(80)
            .height(44)
            .backgroundColor('#333333')
            .margin({ left: 16 })
        }
        .margin({ top: 16 })
      }
      .width('100%')
      .padding({ top: 16, bottom: 32 })
      .backgroundColor('#1a1a1a')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
  }
}
