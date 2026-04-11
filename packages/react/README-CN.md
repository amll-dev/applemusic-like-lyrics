# AMLL for React

[English](./README.md) / 简体中文

> 警告：此为个人项目，且尚未完成开发，可能仍有大量问题，所以请勿直接用于生产环境！

![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/react)](https://www.npmjs.com/package/@applemusic-like-lyrics/react)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Freact)](https://www.npmjs.com/package/@applemusic-like-lyrics/react)

AMLL 组件库的 React 绑定，你可以通过此库来更加方便地使用 AMLL 歌词组件。

详情可以访问 [Core 核心组件的 README.md](../core/README-CN.md)。

## 安装

安装使用的依赖（如果以下列出的依赖包没有安装的话需要自行安装）：
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # 使用 npm
yarn add @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # 使用 yarn
```

安装 React 绑定需要使用的依赖（如果以下列出的依赖包没有安装的话需要自行安装）：
```bash
npm install react react-dom # 使用 npm
yarn add react react-dom # 使用 yarn
```

安装本体框架：
```bash
npm install @applemusic-like-lyrics/react # 使用 npm
yarn add @applemusic-like-lyrics/react # 使用 yarn
```

## 使用方式摘要

详细的 API 文档请参考 [./docs/modules.md](./docs/modules.md)

一个测试用途的程序可以在 [../playground/react/src/test.tsx](../playground/react/src/test.tsx) 里找到。

```tsx
import { LyricPlayer } from "@applemusic-like-lyrics/react";

const App = () => {
    const [currentTime, setCurrentTime] = useState(0);
	const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
    return <LyricPlayer lyricLines={lyricLines} currentTime={currentTime} />
};
```
