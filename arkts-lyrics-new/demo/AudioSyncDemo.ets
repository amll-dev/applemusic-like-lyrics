/**
 * 音频同步播放 Demo
 * 使用 AVPlayer 播放 rawfile 中的音频，并同步歌词显示
 *
 * 使用前准备：
 * 1. 将 music.flac 放入 entry/src/main/resources/rawfile/
 * 2. 将歌词文件（music.yrc 或 music.json）放入同目录
 * 3. 在 module.json5 中添加权限（如需要）
 */

import { media } from '@kit.MediaKit';
import { common } from '@kit.AbilityKit';
import { CanvasLyricPlayerComponent } from '../src/components/CanvasLyricPlayerComponent';
import { LyricLine, LyricPlayerConfig } from '../src/models/LyricModels';
import { parseLyricResponse } from '../src/utils/LyricParser';

/**
 * 音频同步播放器状态
 */
enum PlayerState {
  IDLE = 'idle',
  INITIALIZED = 'initialized',
  PREPARED = 'prepared',
  PLAYING = 'playing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  STOPPED = 'stopped',
  ERROR = 'error'
}

@Entry
@Component
struct AudioSyncDemoPage {
  // ============================================================
  // @State 属性
  // ============================================================

  /** 歌词数据 */
  @State lyrics: LyricLine[] = [];
  /** 当前播放时间（毫秒） */
  @State currentTimeMs: number = 0;
  /** 是否正在播放 */
  @State isPlaying: boolean = false;
  /** 进度条值 */
  @State sliderValue: number = 0;
  /** 总时长（毫秒） */
  @State durationMs: number = 0;
  /** 播放器状态 */
  @State playerState: PlayerState = PlayerState.IDLE;
  /** 是否正在拖动进度条 */
  @State isSeeking: boolean = false;
  /** 加载状态 */
  @State isLoading: boolean = true;
  /** 错误信息 */
  @State errorMsg: string = '';

  // ============================================================
  // 私有属性
  // ============================================================

  /** AVPlayer 实例 */
  private avPlayer: media.AVPlayer | null = null;
  /** 时间更新定时器 */
  private timeUpdateTimer: number = -1;
  /** Context */
  private context: common.UIAbilityContext | null = null;

  /** 音频文件名（不含扩展名） */
  private readonly audioFileName: string = 'music';
  /** 音频文件扩展名 */
  private readonly audioFileExt: string = '.flac';

  // ============================================================
  // 生命周期
  // ============================================================

  aboutToAppear(): void {
    console.info('[AudioSync] aboutToAppear');
    this.context = getContext(this) as common.UIAbilityContext;
    this.initPlayer();
    this.loadLyrics();
  }

  aboutToDisappear(): void {
    console.info('[AudioSync] aboutToDisappear');
    this.releasePlayer();
  }

  // ============================================================
  // 播放器初始化
  // ============================================================

  /**
   * 初始化 AVPlayer
   */
  private async initPlayer(): Promise<void> {
    try {
      console.info('[AudioSync] Creating AVPlayer...');
      this.avPlayer = await media.createAVPlayer();

      // 设置回调
      this.setAVPlayerCallback();

      // 设置音频源
      await this.setAudioSource();

    } catch (error) {
      console.error('[AudioSync] initPlayer error:', error);
      this.errorMsg = '播放器初始化失败';
      this.playerState = PlayerState.ERROR;
      this.isLoading = false;
    }
  }

  /**
   * 设置音频源（从 rawfile 加载）
   */
  private async setAudioSource(): Promise<void> {
    if (!this.avPlayer || !this.context) {
      return;
    }

    try {
      // 从 rawfile 获取文件描述符
      const resourceManager = this.context.resourceManager;
      const fileName = this.audioFileName + this.audioFileExt;

      console.info('[AudioSync] Loading audio file:', fileName);

      // 获取 rawfile 文件描述符
      const rawFd = await resourceManager.getRawFd(fileName);

      // 设置 AVPlayer 的 fdSrc
      this.avPlayer.fdSrc = {
        fd: rawFd.fd,
        offset: rawFd.offset,
        length: rawFd.length
      };

      console.info('[AudioSync] Audio source set successfully');

    } catch (error) {
      console.error('[AudioSync] setAudioSource error:', error);
      this.errorMsg = '音频文件加载失败，请确保 rawfile/' + this.audioFileName + this.audioFileExt + ' 存在';
      this.playerState = PlayerState.ERROR;
      this.isLoading = false;
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
      console.info('[AudioSync] State changed:', state);

      switch (state) {
        case 'idle':
          this.playerState = PlayerState.IDLE;
          break;
        case 'initialized':
          this.playerState = PlayerState.INITIALIZED;
          // 准备播放
          this.avPlayer?.prepare();
          break;
        case 'prepared':
          this.playerState = PlayerState.PREPARED;
          this.durationMs = this.avPlayer?.duration || 0;
          this.isLoading = false;
          console.info('[AudioSync] Duration:', this.durationMs, 'ms');
          break;
        case 'playing':
          this.playerState = PlayerState.PLAYING;
          this.isPlaying = true;
          this.startTimeUpdate();
          break;
        case 'paused':
          this.playerState = PlayerState.PAUSED;
          this.isPlaying = false;
          this.stopTimeUpdate();
          break;
        case 'completed':
          this.playerState = PlayerState.COMPLETED;
          this.isPlaying = false;
          this.stopTimeUpdate();
          // 重置到开头
          this.currentTimeMs = 0;
          this.sliderValue = 0;
          break;
        case 'stopped':
          this.playerState = PlayerState.STOPPED;
          this.isPlaying = false;
          this.stopTimeUpdate();
          break;
        case 'error':
          this.playerState = PlayerState.ERROR;
          this.isPlaying = false;
          this.stopTimeUpdate();
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
      console.error('[AudioSync] Player error:', error);
      this.errorMsg = '播放错误: ' + error.message;
      this.playerState = PlayerState.ERROR;
    });
  }

  /**
   * 释放播放器资源
   */
  private async releasePlayer(): Promise<void> {
    this.stopTimeUpdate();

    if (this.avPlayer) {
      try {
        await this.avPlayer.release();
        this.avPlayer = null;
        console.info('[AudioSync] Player released');
      } catch (error) {
        console.error('[AudioSync] releasePlayer error:', error);
      }
    }
  }

  // ============================================================
  // 歌词加载
  // ============================================================

  /**
   * 加载歌词文件
   * 尝试加载 music.yrc 或 music.json
   */
  private async loadLyrics(): Promise<void> {
    if (!this.context) {
      return;
    }

    const resourceManager = this.context.resourceManager;

    // 尝试加载 YRC/JSON 歌词文件
    const lyricFiles: string[] = [
      this.audioFileName + '.yrc',
      this.audioFileName + '.json',
      this.audioFileName + '_lyric.json',
      'lyric.yrc',
      'lyric.json'
    ];

    for (const fileName of lyricFiles) {
      try {
        console.info('[AudioSync] Trying to load lyric file:', fileName);
        const rawContent = await resourceManager.getRawFileContent(fileName);
        const textDecoder = new TextDecoder('utf-8');
        const lyricContent = textDecoder.decode(rawContent);

        console.info('[AudioSync] Lyric file loaded, length:', lyricContent.length);

        // 判断是 JSON 还是纯 YRC
        if (lyricContent.startsWith('{')) {
          // JSON 格式（网易云 API 响应格式）
          this.lyrics = parseLyricResponse(lyricContent);
        } else {
          // 纯 YRC 格式
          this.lyrics = parseLyricResponse({
            yrc: { version: 1, lyric: lyricContent },
            code: 200
          });
        }

        console.info('[AudioSync] Lyrics parsed:', this.lyrics.length, 'lines');
        return;

      } catch (error) {
        console.warn('[AudioSync] Failed to load', fileName, ':', error);
      }
    }

    console.warn('[AudioSync] No lyric file found, using sample lyrics');
    // 使用示例歌词
    this.lyrics = this.createSampleLyrics();
  }

  /**
   * 创建示例歌词（备用）
   */
  private createSampleLyrics(): LyricLine[] {
    // 简化的示例歌词
    return [];
  }

  // ============================================================
  // 时间同步
  // ============================================================

  /**
   * 开始时间更新定时器
   * 用于更平滑的时间同步
   */
  private startTimeUpdate(): void {
    this.stopTimeUpdate();

    this.timeUpdateTimer = setInterval(() => {
      if (this.avPlayer && this.isPlaying && !this.isSeeking) {
        // AVPlayer 的 currentTime 是只读属性，会自动更新
        // 这里通过定时器确保 UI 平滑更新
        const currentTime = this.avPlayer.currentTime;
        if (currentTime >= 0) {
          this.currentTimeMs = currentTime;
          this.sliderValue = currentTime;
        }
      }
    }, 16); // ~60fps
  }

  /**
   * 停止时间更新定时器
   */
  private stopTimeUpdate(): void {
    if (this.timeUpdateTimer !== -1) {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = -1;
    }
  }

  // ============================================================
  // 播放控制
  // ============================================================

  /**
   * 播放/暂停切换
   */
  private async togglePlayback(): Promise<void> {
    if (!this.avPlayer) {
      return;
    }

    try {
      if (this.isPlaying) {
        await this.avPlayer.pause();
      } else {
        if (this.playerState === PlayerState.COMPLETED) {
          // 播放完成后重新开始
          await this.avPlayer.seek(0);
        }
        await this.avPlayer.play();
      }
    } catch (error) {
      console.error('[AudioSync] togglePlayback error:', error);
    }
  }

  /**
   * 跳转到指定时间
   */
  private async seekTo(timeMs: number): Promise<void> {
    if (!this.avPlayer) {
      return;
    }

    try {
      console.info('[AudioSync] Seeking to:', timeMs);
      await this.avPlayer.seek(timeMs);
      this.currentTimeMs = timeMs;
    } catch (error) {
      console.error('[AudioSync] seekTo error:', error);
    }
  }

  /**
   * 重置播放
   */
  private async resetPlayback(): Promise<void> {
    if (!this.avPlayer) {
      return;
    }

    try {
      await this.avPlayer.seek(0);
      if (this.isPlaying) {
        await this.avPlayer.pause();
      }
      this.currentTimeMs = 0;
      this.sliderValue = 0;
    } catch (error) {
      console.error('[AudioSync] resetPlayback error:', error);
    }
  }

  /**
   * 快进
   */
  private async fastForward(seconds: number): Promise<void> {
    const newTime = Math.min(this.currentTimeMs + seconds * 1000, this.durationMs);
    await this.seekTo(newTime);
  }

  /**
   * 快退
   */
  private async fastRewind(seconds: number): Promise<void> {
    const newTime = Math.max(this.currentTimeMs - seconds * 1000, 0);
    await this.seekTo(newTime);
  }

  // ============================================================
  // 工具方法
  // ============================================================

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

  // ============================================================
  // UI 构建
  // ============================================================

  build() {
    Column() {
      // 标题栏
      Row() {
        Text('Apple Music 歌词播放器')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(Color.White)
      }
      .width('100%')
      .height(56)
      .padding({ left: 16, right: 16 })
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#1a1a1a')

      // 加载状态
      if (this.isLoading) {
        Column() {
          LoadingProgress()
            .width(50)
            .height(50)
            .color(Color.White)
          Text('加载中...')
            .fontSize(14)
            .fontColor('#999999')
            .margin({ top: 10 })
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.errorMsg.length > 0) {
        // 错误状态
        Column() {
          Text('Error')
            .fontSize(40)
            .fontColor('#FF4444')
          Text(this.errorMsg)
            .fontSize(14)
            .fontColor('#999999')
            .margin({ top: 10 })
            .textAlign(TextAlign.Center)
            .padding({ left: 20, right: 20 })
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        // 歌词显示区域
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
            showRoman: true,
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
            .fontColor('#999999')
            .width(50)

          Slider({
            value: this.sliderValue,
            min: 0,
            max: this.durationMs > 0 ? this.durationMs : 100,
            step: 100
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

          Text(this.formatTime(this.durationMs))
            .fontSize(12)
            .fontColor('#999999')
            .width(50)
            .textAlign(TextAlign.End)
        }
        .width('100%')
        .padding({ left: 20, right: 20 })

        // 控制按钮
        Row() {
          // 快退按钮
          Button({ type: ButtonType.Circle }) {
            Text('<<')
              .fontSize(16)
              .fontColor(Color.White)
          }
          .width(44)
          .height(44)
          .backgroundColor('#333333')
          .onClick(() => {
            this.fastRewind(10);
          })

          Blank().width(15)

          // 重置按钮
          Button({ type: ButtonType.Circle }) {
            Text('|<')
              .fontSize(16)
              .fontColor(Color.White)
          }
          .width(44)
          .height(44)
          .backgroundColor('#333333')
          .onClick(() => {
            this.resetPlayback();
          })

          Blank().width(15)

          // 播放/暂停按钮
          Button({ type: ButtonType.Circle }) {
            Text(this.isPlaying ? '||' : '>')
              .fontSize(this.isPlaying ? 18 : 22)
              .fontColor(Color.White)
          }
          .width(60)
          .height(60)
          .backgroundColor('#1DB954')
          .onClick(() => {
            this.togglePlayback();
          })

          Blank().width(15)

          // 快进按钮
          Button({ type: ButtonType.Circle }) {
            Text('>>')
              .fontSize(16)
              .fontColor(Color.White)
          }
          .width(44)
          .height(44)
          .backgroundColor('#333333')
          .onClick(() => {
            this.fastForward(10);
          })

          Blank().width(15)

          // +30s 按钮
          Button({ type: ButtonType.Circle }) {
            Text('+30')
              .fontSize(12)
              .fontColor(Color.White)
          }
          .width(44)
          .height(44)
          .backgroundColor('#333333')
          .onClick(() => {
            this.fastForward(30);
          })
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 10 })
        .justifyContent(FlexAlign.Center)

        // 状态显示
        Text('状态: ' + this.playerState)
          .fontSize(10)
          .fontColor('#666666')
          .margin({ top: 8 })
      }
      .width('100%')
      .padding({ top: 15, bottom: 20 })
      .backgroundColor('#1a1a1a')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
  }
}
