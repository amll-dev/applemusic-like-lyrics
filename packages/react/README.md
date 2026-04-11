# AMLL for React

English / [简体中文](./README-CN.md)

> Warning: This is a personal project and is still under development. There may still be many issues, so please do not use it directly in production environments!

![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/react)](https://www.npmjs.com/package/@applemusic-like-lyrics/react)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Freact)](https://www.npmjs.com/package/@applemusic-like-lyrics/react)

React binding for the AMLL component library, which allows you to use AMLL lyric components more conveniently.

For more details, please visit [Core component README.md](../core/README.md).

## Installation

Install the required dependencies (if the dependencies listed below are not installed, you need to install them yourself):
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # using npm
yarn add @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # using yarn
```

Install the dependencies required for React binding (if the dependencies listed below are not installed, you need to install them yourself):
```bash
npm install react react-dom # using npm
yarn add react react-dom # using yarn
```

Install the framework:
```bash
npm install @applemusic-like-lyrics/react # using npm
yarn add @applemusic-like-lyrics/react # using yarn
```

## Usage Summary

For detailed API documentation, please refer to [./docs/modules.md](./docs/modules.md)

A test program can be found in [../playground/react/src/test.tsx](../playground/react/src/test.tsx).

```tsx
import { LyricPlayer } from "@applemusic-like-lyrics/react";

const App = () => {
    const [currentTime, setCurrentTime] = useState(0);
	const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
    return <LyricPlayer lyricLines={lyricLines} currentTime={currentTime} />
};
```
