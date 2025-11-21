/**
 * 歌词行组件
 * 负责单行歌词的渲染，包括逐词高亮、强调效果等
 */

import { LyricLine, LyricWord } from '../interfaces/LyricInterfaces';
import { getWordProgress, shouldEmphasize, isCJK } from '../utils/LyricUtils';

@Component
export struct LyricLineComponent {
  @Prop line: LyricLine;
  @Prop currentTime: number;
  @Prop isActive: boolean;
  @Prop scale: number; // 0-100
  @Prop opacity: number; // 0-1
  @Prop blur: number;
  @Prop showTranslation: boolean;
  @Prop showRoman: boolean;

  /**
   * 渲染单个单词
   */
  @Builder
  renderWord(word: LyricWord, index: number) {
    Text(word.word)
      .fontSize(this.isActive ? 20 : 18)
      .fontWeight(this.isActive ? FontWeight.Bold : FontWeight.Normal)
      .fontColor(this.getWordColor(word))
      .margin({ right: 4 })
      .transition(TransitionEffect.OPACITY.animation({ duration: 300 }))
      .scale(this.getWordScale(word))
      .animation({
        duration: 300,
        curve: Curve.EaseOut
      })
  }

  /**
   * 获取单词颜色（渐变效果）
   */
  getWordColor(word: LyricWord): ResourceColor {
    if (!this.isActive) {
      return Color.Gray;
    }

    const progress = getWordProgress(word, this.currentTime);

    if (progress >= 1) {
      return Color.White; // 已播放完成
    } else if (progress > 0) {
      // 播放中：从灰色渐变到白色
      const gray = Math.floor(128 + 127 * progress);
      return `rgb(${gray}, ${gray}, ${gray})`;
    } else {
      return '#888888'; // 未播放
    }
  }

  /**
   * 获取单词缩放（强调效果）
   */
  getWordScale(word: LyricWord): ScaleOptions {
    if (!this.isActive || !shouldEmphasize(word)) {
      return { x: 1, y: 1 };
    }

    const progress = getWordProgress(word, this.currentTime);

    if (progress > 0 && progress < 1) {
      // 播放中：轻微放大
      const scale = 1 + 0.1 * Math.sin(progress * Math.PI);
      return { x: scale, y: scale };
    }

    return { x: 1, y: 1 };
  }

  /**
   * 渲染主歌词
   */
  @Builder
  renderMainLyric() {
    Row() {
      ForEach(this.line.words, (word: LyricWord, index: number) => {
        this.renderWord(word, index);
      }, (word: LyricWord, index: number) => `${index}-${word.word}`)
    }
    .width('100%')
    .justifyContent(this.line.isDuet ? FlexAlign.End : FlexAlign.Start)
  }

  /**
   * 渲染翻译
   */
  @Builder
  renderTranslation() {
    if (this.showTranslation && this.line.translatedLyric) {
      Text(this.line.translatedLyric)
        .fontSize(14)
        .fontColor('#999999')
        .margin({ top: 4 })
        .opacity(this.isActive ? 0.8 : 0.4)
        .textAlign(this.line.isDuet ? TextAlign.End : TextAlign.Start)
        .width('100%')
    }
  }

  /**
   * 渲染音译
   */
  @Builder
  renderRoman() {
    if (this.showRoman && this.line.romanLyric) {
      Text(this.line.romanLyric)
        .fontSize(12)
        .fontColor('#777777')
        .margin({ top: 2 })
        .opacity(this.isActive ? 0.6 : 0.3)
        .textAlign(this.line.isDuet ? TextAlign.End : TextAlign.Start)
        .width('100%')
    }
  }

  build() {
    Column() {
      this.renderMainLyric()
      this.renderTranslation()
      this.renderRoman()
    }
    .width('90%')
    .padding({ left: 20, right: 20, top: 12, bottom: 12 })
    .scale({
      x: this.scale / 100,
      y: this.scale / 100
    })
    .opacity(this.opacity)
    .blur(this.blur)
    .animation({
      duration: 300,
      curve: Curve.EaseInOut
    })
  }
}
