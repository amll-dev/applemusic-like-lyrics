/**
 * 简化版示例 - 最小可运行代码
 */

import { LyricPlayer } from '../src/components/LyricPlayer';
import { LyricLine, LyricPlayerConfig } from '../src/interfaces/LyricInterfaces';

@Entry
@Component
struct SimpleLyricExample {
  @State currentTime: number = 0;
  private lyricPlayerRef: LyricPlayer | null = null;
  private timer: number = -1;

  // 简单的歌词数据
  private lyrics: LyricLine[] = [
    {
      words: [
        { word: 'Hello', startTime: 0, endTime: 500 },
        { word: ' ', startTime: 500, endTime: 500 },
        { word: 'World', startTime: 500, endTime: 1000 }
      ],
      translatedLyric: '你好世界',
      startTime: 0,
      endTime: 1000,
      isBG: false,
      isDuet: false
    },
    {
      words: [
        { word: 'Welcome', startTime: 1500, endTime: 2000 },
        { word: ' ', startTime: 2000, endTime: 2000 },
        { word: 'to', startTime: 2000, endTime: 2200 },
        { word: ' ', startTime: 2200, endTime: 2200 },
        { word: 'HarmonyOS', startTime: 2200, endTime: 3000 }
      ],
      translatedLyric: '欢迎来到鸿蒙系统',
      startTime: 1500,
      endTime: 3000,
      isBG: false,
      isDuet: false
    }
  ];

  aboutToAppear() {
    // 自动开始播放
    this.startPlayback();
  }

  aboutToDisappear() {
    if (this.timer !== -1) {
      clearInterval(this.timer);
    }
  }

  startPlayback() {
    let lastTime = Date.now();

    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      this.currentTime += delta;

      if (this.lyricPlayerRef) {
        this.lyricPlayerRef.setCurrentTime(this.currentTime);
        this.lyricPlayerRef.onFrameUpdate(delta);
      }

      // 循环播放
      if (this.currentTime > 4000) {
        this.currentTime = 0;
      }
    }, 16);
  }

  build() {
    Column() {
      LyricPlayer({
        config: {
          alignAnchor: 'center',
          alignPosition: 0.5,
          enableScale: true,
          enableBlur: true,
          enableSpring: true,
          showTranslation: true,
          showRoman: false
        }
      })
        .onReady((player: LyricPlayer) => {
          this.lyricPlayerRef = player;
          player.setLyricLines(this.lyrics);
        })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
  }
}
