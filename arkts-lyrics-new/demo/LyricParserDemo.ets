/**
 * 歌词解析器 Demo
 * 从 JSON 资源加载网易云音乐格式歌词
 * 支持同步播放 rawfile 中的音频文件
 */

import { media } from '@kit.MediaKit';
import { common } from '@kit.AbilityKit';
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
  @State isSeeking: boolean = false;

  private timerHandle: number = -1;
  private maxTimeMs: number = 240000; // 4分钟

  // 🎵 音频播放器
  private avPlayer: media.AVPlayer | null = null;
  private context: common.UIAbilityContext | null = null;
  /** 音频文件名（rawfile 目录下） */
  private readonly audioFileName: string = 'music.flac';

  aboutToAppear(): void {
    this.context = getContext(this) as common.UIAbilityContext;
    this.loadLyrics();
    this.initAudioPlayer();
  }

  aboutToDisappear(): void {
    this.stopPlayback();
    this.releaseAudioPlayer();
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
      const jsonStr: string = this.resourceToString($r('app.string.testLrc'));
      this.lyrics = parseLyricResponse(jsonStr);

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

  // ============================================================
  // 🎵 音频播放器相关
  // ============================================================

  /**
   * 初始化音频播放器
   */
  private async initAudioPlayer(): Promise<void> {
    try {
      console.info('[Demo] 🎵 初始化音频播放器...');
      this.avPlayer = await media.createAVPlayer();
      this.setAVPlayerCallback();
      await this.loadAudioFile();
    } catch (error) {
      console.error('[Demo] 初始化音频播放器失败:', error);
    }
  }

  /**
   * 加载音频文件
   */
  private async loadAudioFile(): Promise<void> {
    if (!this.avPlayer || !this.context) {
      return;
    }

    try {
      const resourceManager = this.context.resourceManager;
      console.info('[Demo] 🎵 加载音频文件:', this.audioFileName);

      // 从 rawfile 获取文件描述符
      const rawFd = await resourceManager.getRawFd(this.audioFileName);

      // 设置音频源
      this.avPlayer.fdSrc = {
        fd: rawFd.fd,
        offset: rawFd.offset,
        length: rawFd.length
      };

      console.info('[Demo] 🎵 音频文件加载成功');
    } catch (error) {
      console.warn('[Demo] 🎵 音频文件加载失败（将使用模拟时间）:', error);
    }
  }

  /**
   * 设置 AVPlayer 回调
   */
  private setAVPlayerCallback(): void {
    if (!this.avPlayer) {
      return;
    }

    // 状态变化回调
    this.avPlayer.on('stateChange', (state: string) => {
      console.info('[Demo] 🎵 播放器状态:', state);

      switch (state) {
        case 'initialized':
          // 准备播放
          this.avPlayer?.prepare();
          break;
        case 'prepared':
          // 获取音频时长
          const duration = this.avPlayer?.duration || 0;
          if (duration > 0) {
            this.maxTimeMs = duration;
          }
          console.info('[Demo] 🎵 音频时长:', this.maxTimeMs, 'ms');
          break;
        case 'playing':
          this.isPlaying = true;
          this.startTimeSync();
          break;
        case 'paused':
          this.isPlaying = false;
          this.stopTimeSync();
          break;
        case 'completed':
          this.isPlaying = false;
          this.stopTimeSync();
          this.currentTimeMs = 0;
          this.sliderValue = 0;
          break;
      }
    });

    // 时间更新回调
    this.avPlayer.on('timeUpdate', (timeMs: number) => {
      if (!this.isSeeking) {
        this.currentTimeMs = timeMs;
        this.sliderValue = timeMs;
      }
    });

    // 错误回调
    this.avPlayer.on('error', (error: Error) => {
      console.error('[Demo] 🎵 播放器错误:', error);
    });
  }

  /**
   * 释放音频播放器
   */
  private async releaseAudioPlayer(): Promise<void> {
    if (this.avPlayer) {
      try {
        await this.avPlayer.release();
        this.avPlayer = null;
        console.info('[Demo] 🎵 播放器已释放');
      } catch (error) {
        console.error('[Demo] 释放播放器失败:', error);
      }
    }
  }

  /**
   * 开始时间同步（用于更平滑的歌词同步）
   */
  private startTimeSync(): void {
    this.stopTimeSync();
    this.timerHandle = setInterval(() => {
      if (this.avPlayer && this.isPlaying && !this.isSeeking) {
        const currentTime = this.avPlayer.currentTime;
        if (currentTime >= 0) {
          this.currentTimeMs = currentTime;
          this.sliderValue = currentTime;
        }
      }
    }, 8); // 120Hz
  }

  /**
   * 停止时间同步
   */
  private stopTimeSync(): void {
    if (this.timerHandle !== -1) {
      clearInterval(this.timerHandle);
      this.timerHandle = -1;
    }
  }

  // ============================================================
  // 播放控制
  // ============================================================

  private async startPlayback(): Promise<void> {
    console.info('[Demo] ▶️ Start playback');

    if (this.avPlayer) {
      try {
        await this.avPlayer.play();
        return;
      } catch (error) {
        console.warn('[Demo] 音频播放失败，使用模拟时间:', error);
      }
    }

    // 回退：使用模拟时间（无音频时）
    this.isPlaying = true;
    let lastTime: number = Date.now();

    this.timerHandle = setInterval(() => {
      const now: number = Date.now();
      const delta: number = now - lastTime;
      lastTime = now;

      this.currentTimeMs += delta;
      this.sliderValue = this.currentTimeMs;

      if (this.currentTimeMs > this.maxTimeMs) {
        this.currentTimeMs = 0;
      }
    }, 8); // 120Hz
  }

  private async stopPlayback(): Promise<void> {
    console.info('[Demo] ⏸️ Stop playback');

    if (this.avPlayer) {
      try {
        await this.avPlayer.pause();
        return;
      } catch (error) {
        console.warn('[Demo] 暂停失败:', error);
      }
    }

    // 回退：停止模拟时间
    this.isPlaying = false;
    this.stopTimeSync();
  }

  private async togglePlayback(): Promise<void> {
    if (this.isPlaying) {
      await this.stopPlayback();
    } else {
      await this.startPlayback();
    }
  }

  private async seekTo(timeMs: number): Promise<void> {
    console.info(`[Demo] ⏩ Seek to: ${Math.floor(timeMs)}`);
    this.currentTimeMs = timeMs;
    this.sliderValue = timeMs;

    if (this.avPlayer) {
      try {
        await this.avPlayer.seek(timeMs);
      } catch (error) {
        console.warn('[Demo] Seek 失败:', error);
      }
    }
  }

  private async resetPlayback(): Promise<void> {
    await this.stopPlayback();
    this.currentTimeMs = 0;
    this.sliderValue = 0;

    if (this.avPlayer) {
      try {
        await this.avPlayer.seek(0);
      } catch (error) {
        console.warn('[Demo] Reset 失败:', error);
      }
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
            .onChange((value: number, mode: SliderChangeMode) => {
              if (mode === SliderChangeMode.Begin) {
                this.isSeeking = true;
              } else if (mode === SliderChangeMode.End) {
                this.isSeeking = false;
                this.seekTo(value);
              } else {
                this.sliderValue = value;
                this.currentTimeMs = value;
              }
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
              this.resetPlayback();
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
