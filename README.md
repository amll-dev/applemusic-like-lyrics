<div align=center>

![Apple Music-like Lyrics - A lyric page component library for Web](https://github.com/user-attachments/assets/ca6a98d4-28ea-4fb6-beec-7948f2ac87ec)

English / [简体中文](./README-CN.md)

</div>

<div align=center>

A lyric player component library that aims to look similar to iPad version of Apple Music. With [DOM](./packages/core/README.md), [React](./packages/react/README.md) and [Vue](./packages/vue/README.md) bindings.

This is perhaps the most iPad Apple Music-like lyric page you've seen in frontend.

Although the goal of this project is not to imitate it completely, it will polish some details to be better than the current best lyric players.

**—— AMLL Series Projects ——**

[AMLL TTML DB - TTML Syllable Lyric Database](https://github.com/amll-dev/amll-ttml-db)
/
[AMLL TTML Tool - TTML Syllable Lyric Editor](https://github.com/amll-dev/amll-ttml-tool)

[Projects that references AMLL](https://github.com/amll-dev/applemusic-like-lyrics/discussions/397)

</div>

## AMLL Ecology and source code structure

### Main modules

-   [![AMLL-Core](https://img.shields.io/badge/Core-%233178c6?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/core/README.md): AMLL Core Component Library, written natively with DOM, provides lyric display component and dynamic fluid background component
-   [![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/react/README.md): AMLL React binding, provides React component forms of lyric display and dynamic fluid background components
-   [![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/vue/README.md): AMLL Vue binding, provides Vue component forms of lyric display and dynamic fluid background components
-   [![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/lyric/README.md): AMLL lyric parsing module, provides parsing and serialization support for various lyric formats including LyRiC, YRC, QRC, and Lyricify Syllable

## Browser compatibility alerts

This component framework requires the following browsers or newer versions at a minimum:

-   Chromium/Edge 91+
-   Firefox 100+
-   Safari 9.1+

To fully render all component effects, the following browser versions or newer are required:

-   Chromium 120+
-   Firefox 100+
-   Safari 15.4+

Reference Links:

-   [https://caniuse.com/mdn-css_properties_mask-image](https://caniuse.com/mdn-css_properties_mask-image)
-   [https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter](https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter)

## Performance configuration reference

Performance benchmarks have shown that mainstream CPU processors from the last five years can run the lyric component at 30FPS. However, if you need smooth 60FPS operation, ensure your CPU frequency is at least 3.0GHz or higher. For 144FPS or above, a CPU frequency of at least 4.2GHz is recommended.

GPU performance capable of running at full 60 fps at the expected sizes under the following conditions:

-   `1080p (1920x1080)`: NVIDIA GTX 10 series and above
-   `2160p (3840x2160)`: NVIDIA RTX 2070 and above

## Development/build/packaging process

### Prerequisites

-   [Node.js](https://nodejs.org/)
-   [Bun](https://bun.sh/)
-   [Rust toolchain](https://rustup.rs/)
-   [wasm-pack](https://rustwasm.github.io/wasm-pack/)

### Building the component libraries

Clone this repository, then run the following commands in the project root:

```bash
# Install dependencies
bun install

# Production build (all library packages)
bun run build:libs
```

### Building a single package

```bash
# Example: build only @applemusic-like-lyrics/core
bunx nx run @applemusic-like-lyrics/core:build

# Example: development build of @applemusic-like-lyrics/lyric
bunx nx run @applemusic-like-lyrics/lyric:build:dev
```

## Acknowledgements

-   [woshizja/sound-processor](https://github.com/woshizja/sound-processor)
-   [FFmpeg](http://ffmpeg.org/)
-   And many other frameworks and libraries used by AMLL, thank you very much!

### Special Thanks

<div align="center">
<image src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg"></image>
<div>
Thanks to <a href=https://jb.gg/OpenSourceSupport>JetBrains</a> for their development tools that provide great support to the AMLL project
</div>
</div>
