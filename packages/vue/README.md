# AMLL for Vue

English / [简体中文](./README-CN.md)

> Warning: This is a personal project and is still under development. There may still be many issues, so please do not use it directly in production environments!

![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/vue)](https://www.npmjs.com/package/@applemusic-like-lyrics/vue)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Fvue)](https://www.npmjs.com/package/@applemusic-like-lyrics/vue)

Vue binding for the AMLL component library, which allows you to use AMLL lyric components more conveniently.

For more details, please visit [Core component README.md](../core/README.md).

## Installation

Install the required dependencies (if the dependencies listed below are not installed, you need to install them yourself):
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # using npm
yarn add @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # using yarn
```

Install the dependencies required for Vue binding (if the dependencies listed below are not installed, you need to install them yourself):
```bash
npm install vue # using npm
yarn add vue # using yarn
```

Install the framework:
```bash
npm install @applemusic-like-lyrics/vue # using npm
yarn add @applemusic-like-lyrics/vue # using yarn
```

## Usage Summary

Since Vue components are not convenient for generating API documentation, please refer to the type definition files to determine usage.

(Or refer to the React binding, as both have identical properties and reference methods)

A test program can be found in [../playground/vue/src/test.ts](../playground/vue/src/test.ts).

```vue
<tamplate>
    <LyricPlayer :lyric-lines="[]" :current-time="0" />
</tamplate>

<script setup lang="ts">
import { LyricPlayer } from "@applemusic-like-lyrics/vue";

</script>
```
