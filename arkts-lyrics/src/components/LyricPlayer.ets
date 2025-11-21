/**
 * 鸿蒙ArkTS版本 - Apple Music风格歌词播放器
 * 主组件
 */

import { LyricLine, LyricPlayerConfig, LyricLineState, InterludeInfo } from '../interfaces/LyricInterfaces';
import { LyricLineComponent } from './LyricLine';
import { InterludeDots } from './InterludeDots';
import { Spring } from '../utils/SpringAnimation';
import { processLyricLines, calculateBlur } from '../utils/LyricUtils';

@Component
export struct LyricPlayer {
  // 歌词数据
  @State lines: LyricLine[] = [];
  @State currentTime: number = 0;

  // 配置
  @Prop config: LyricPlayerConfig = {
    alignAnchor: 'center',
    alignPosition: 0.5,
    enableScale: true,
    enableBlur: true,
    enableSpring: true,
    wordFadeWidth: 0.5,
    hidePassed: false,
    showTranslation: true,
    showRoman: false
  };

  // 状态管理
  @State lineStates: LyricLineState[] = [];
  @State currentLineIndex: number = -1;
  @State scrollOffset: number = 0;
  @State interludeInfo: InterludeInfo = {
    show: false,
    positionY: 0,
    prevIndex: -1,
    nextIndex: -1
  };

  // 弹簧动画
  private scrollSpring: Spring = new Spring({
    mass: 1,
    stiffness: 100,
    damping: 20
  });

  // 容器高度
  @State containerHeight: number = 0;
  private scroller: Scroller = new Scroller();

  /**
   * 设置歌词数据
   */
  setLyricLines(lines: LyricLine[]) {
    this.lines = processLyricLines(lines);
    this.initLineStates();
    this.updateLayout();
  }

  /**
   * 设置当前播放时间
   */
  setCurrentTime(time: number) {
    this.currentTime = time;
    this.updateCurrentLine();
    this.updateLineStates();
    this.updateInterlude();
  }

  /**
   * 初始化歌词行状态
   */
  initLineStates() {
    this.lineStates = this.lines.map((line, index) => ({
      line: line,
      index: index,
      positionY: 0,
      scale: 97,
      opacity: 0.2,
      blur: 0,
      isActive: false,
      isInView: true
    }));
  }

  /**
   * 更新当前播放行
   */
  updateCurrentLine() {
    let newIndex = -1;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (this.currentTime >= line.startTime && this.currentTime < line.endTime) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== this.currentLineIndex) {
      this.currentLineIndex = newIndex;
      this.updateScrollTarget();
    }
  }

  /**
   * 更新滚动目标
   */
  updateScrollTarget() {
    if (this.currentLineIndex < 0) {
      return;
    }

    // 计算目标滚动位置
    let targetOffset = 0;
    for (let i = 0; i < this.currentLineIndex; i++) {
      targetOffset += this.getLineHeight(i);
    }

    // 根据对齐方式调整
    const alignOffset = this.containerHeight * (this.config.alignPosition ?? 0.5);
    targetOffset -= alignOffset;

    if (this.config.enableSpring) {
      this.scrollSpring.setTargetPosition(targetOffset);
    } else {
      this.scrollOffset = targetOffset;
    }
  }

  /**
   * 更新歌词行状态
   */
  updateLineStates() {
    this.lineStates.forEach((state, index) => {
      const line = state.line;

      // 判断是否激活
      state.isActive = this.currentTime >= line.startTime && this.currentTime < line.endTime;

      // 计算距离当前行的距离
      const distance = Math.abs(index - this.currentLineIndex);

      // 更新缩放
      if (this.config.enableScale) {
        state.scale = state.isActive ? 100 : 97;
      } else {
        state.scale = 100;
      }

      // 更新透明度
      if (state.isActive) {
        state.opacity = 1;
      } else if (this.config.hidePassed && index < this.currentLineIndex) {
        state.opacity = 0;
      } else {
        state.opacity = Math.max(0.2, 1 - distance * 0.15);
      }

      // 更新模糊
      if (this.config.enableBlur) {
        state.blur = calculateBlur(distance, 5);
      } else {
        state.blur = 0;
      }
    });
  }

  /**
   * 更新间奏信息
   */
  updateInterlude() {
    // 检查是否在两行歌词之间
    if (this.currentLineIndex < 0) {
      this.interludeInfo.show = false;
      return;
    }

    const currentLine = this.lines[this.currentLineIndex];
    const nextLine = this.lines[this.currentLineIndex + 1];

    if (nextLine && this.currentTime >= currentLine.endTime) {
      const gap = nextLine.startTime - currentLine.endTime;

      // 间隔大于4秒才显示间奏
      if (gap >= 4000) {
        this.interludeInfo.show = true;
        this.interludeInfo.prevIndex = this.currentLineIndex;
        this.interludeInfo.nextIndex = this.currentLineIndex + 1;

        // 计算间奏位置
        let posY = 0;
        for (let i = 0; i <= this.currentLineIndex; i++) {
          posY += this.getLineHeight(i);
        }
        this.interludeInfo.positionY = posY;
      } else {
        this.interludeInfo.show = false;
      }
    } else {
      this.interludeInfo.show = false;
    }
  }

  /**
   * 更新布局
   */
  updateLayout() {
    let currentY = 0;

    this.lineStates.forEach((state, index) => {
      state.positionY = currentY;
      currentY += this.getLineHeight(index);
    });
  }

  /**
   * 获取歌词行高度
   */
  getLineHeight(index: number): number {
    const baseHeight = 60;
    const state = this.lineStates[index];

    if (!state) {
      return baseHeight;
    }

    let height = baseHeight;

    // 翻译增加高度
    if (this.config.showTranslation && state.line.translatedLyric) {
      height += 20;
    }

    // 音译增加高度
    if (this.config.showRoman && state.line.romanLyric) {
      height += 16;
    }

    return height;
  }

  /**
   * 帧更新
   */
  onFrameUpdate(deltaTime: number) {
    if (this.config.enableSpring) {
      this.scrollSpring.update(deltaTime / 1000); // 转换为秒
      this.scrollOffset = this.scrollSpring.getCurrentPosition();
    }
  }

  build() {
    Column() {
      Scroll(this.scroller) {
        Column() {
          ForEach(this.lineStates, (state: LyricLineState) => {
            LyricLineComponent({
              line: state.line,
              currentTime: this.currentTime,
              isActive: state.isActive,
              scale: state.scale,
              opacity: state.opacity,
              blur: state.blur,
              showTranslation: this.config.showTranslation ?? true,
              showRoman: this.config.showRoman ?? false
            })
              .id(`line-${state.index}`)
          }, (state: LyricLineState) => `${state.index}`)

          // 间奏动画
          if (this.interludeInfo.show) {
            InterludeDots()
              .position({
                y: this.interludeInfo.positionY
              })
          }
        }
        .width('100%')
      }
      .scrollable(ScrollDirection.Vertical)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
      .width('100%')
      .height('100%')
      .onAreaChange((oldArea: Area, newArea: Area) => {
        this.containerHeight = Number(newArea.height);
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
  }
}
