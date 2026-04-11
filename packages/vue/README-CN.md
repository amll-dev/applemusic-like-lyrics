# AMLL for Vue

[English](./README.md) / 简体中文

> 警告：此为个人项目，且尚未完成开发，可能仍有大量问题，所以请勿直接用于生产环境！

![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)
[![npm](https://img.shields.io/npm/dt/%40applemusic-like-lyrics/vue)](https://www.npmjs.com/package/@applemusic-like-lyrics/vue)
[![npm](https://img.shields.io/npm/v/%40applemusic-like-lyrics%2Fvue)](https://www.npmjs.com/package/@applemusic-like-lyrics/vue)

AMLL 组件库的 Vue 绑定，你可以通过此库来更加方便地使用 AMLL 歌词组件。

详情可以访问 [Core 核心组件的 README.md](../core/README-CN.md)。

## 安装

安装使用的依赖（如果以下列出的依赖包没有安装的话需要自行安装）：
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # 使用 npm
yarn add @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default # 使用 yarn
```

安装 Vue 绑定需要使用的依赖（如果以下列出的依赖包没有安装的话需要自行安装）：
```bash
npm install vue # 使用 npm
yarn add vue # 使用 yarn
```

安装本体框架：
```bash
npm install @applemusic-like-lyrics/vue # 使用 npm
yarn add @applemusic-like-lyrics/vue # 使用 yarn
```

## 使用方式摘要

由于 Vue 组件不方便生成 API 文档，所以还请自行查阅类型定义文件确定用法。

（或者参考 React 绑定，二者属性和引用方式完全一致）

一个测试用途的程序可以在 [../playground/vue/src/test.ts](../playground/vue/src/test.ts) 里找到。

```vue
<tamplate>
    <LyricPlayer :lyric-lines="[]" :current-time="0" />
</tamplate>

<script setup lang="ts">
import { LyricPlayer } from "@applemusic-like-lyrics/vue";

</script>
```
