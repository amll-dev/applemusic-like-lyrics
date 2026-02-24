# AMLL Core

English / [简体中文](./README-CN.md)

> Warning: This is a personal project and is still under development. There may still be many issues, so please do not use it directly in production environments!

![AMLL-Core](https://img.shields.io/badge/Core-%233178c6?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/core)](https://www.npmjs.com/package/@applemusic-like-lyrics/core)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Fcore)](https://www.npmjs.com/package/@applemusic-like-lyrics/core)

AMLL's pure JS core component framework, including lyric display components and background components and other reusable components.

Everything here is UI framework-independent, so it can be indirectly referenced under various dynamic page frameworks.

Or if you need to use component bindings, there's a [React binding version](../react/README.md) and a [Vue binding version](../vue/README.md)

## Features

- Pure frontend rendering for lyrics and background
- Word-level timed lyrics with translation and romanization
- Multi-line, duet, and background line support
- Style customization via CSS variables

## Installation

Install the required dependencies (if the dependencies listed below are not installed, you need to install them yourself):
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite # using npm
yarn add @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite # using yarn
```

Install the framework:
```bash
npm install @applemusic-like-lyrics/core # using npm
yarn add @applemusic-like-lyrics/core # using yarn
```

## Usage Summary

For detailed API documentation, please refer to [./docs/modules.md](./docs/modules.md)

A test program can be found in [./src/test.ts](./src/test.ts).

```typescript
import { LyricPlayer } from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css"; // Import required styles

const player = new LyricPlayer(); // Create a lyric player component
document.body.appendChild(player.getElement()); // Add the component's element to the page
player.setLyricLines([]) // Set lyrics
player.setCurrentTime(0) // Set current playback time (needs to be called every frame)
player.update(0) // Update lyric component animation (needs to be called every frame)
```

The lyrics set through `LyricPlayer.setLyricLines` is a `LyricLine[]` parameter. For details, please refer to the code in [./src/interfaces.ts](./src/interfaces.ts).

## Data Model

Lyrics input is `LyricLine[]`, with each line containing:

- `words`: timed word array, each word includes `startTime` / `endTime` / `word`, with optional `romanWord`, `ruby`, and `obscene`
- `translatedLyric`: translation text
- `romanLyric`: romanization text
- `startTime` / `endTime`: line timestamps
- `isBG` / `isDuet`: background and duet flags

## Styling

The main styles are provided by `@applemusic-like-lyrics/core/style.css`. Common overrides are via CSS variables:

```css
.amll-lyric-player {
  --amll-lp-color: #ffffff;
  --amll-lp-bg-color: rgba(0, 0, 0, 0.35);
}
```

## Development

```bash
pnpm -C packages/core dev
pnpm -C packages/core build
```
