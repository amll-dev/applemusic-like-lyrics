<div align=center>

![Apple Music-like Lyrics - A lyric page component library for Web](https://github.com/user-attachments/assets/ca6a98d4-28ea-4fb6-beec-7948f2ac87ec)

English / [简体中文](./README-CN.md)

</div>

<div align=center>

A lyric player component library aims to look similar to iPad version of Apple Music. Also with[ DOM](./packages/core/README.md),[ React ](./packages/react/README.md)and[ Vue ](./packages/react/README.md)bindings. [Also there's a local player based on it!](./packages/player/README.md)

This's maybe the most like iPad Apple Music style lyric page you've seen in frontend.

Although the goal of this project is not to imitate it completely, it will polish some details better to be better than currently the best lyric players.

**—— AMLL Series Projects ——**

[AMLL TTML DB - TTML Syllable Lyric Database](https://github.com/Steve-xmh/amll-ttml-db)
/
[AMLL TTML Tool - TTML Syllable Lyric Editor](https://github.com/Steve-xmh/amll-ttml-tool)

</div>

## AMLL Ecology and source code structure

### Main modules

-   [![AMLL-Core](https://img.shields.io/badge/Core-%233178c6?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/core/README.md)：AMLL Core Component Library，以 DOM Written natively，Provides a lyric display component and a dynamic fluid background component

-   [![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/react/README.md)：AMLL React bind**，Provision React Lyrics in the form of components display components and dynamic fluid background components

-   [![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/vue/README.md)：AMLL Vue bind，Provision Vue Lyrics in the form of components display components and dynamic fluid background components
  
-   [![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/lyric/README.md)：AMLL The lyrics parsing module provides parsing and serialization support for various lyric formats of LyRiC, YRC, QRC, Lyricify Syllable
### External tools

-   [AMLL Player](./packages/player/README.md)：AMLL External Player provides an independent external lyrics player, and communicates with AMLL's programs that implement any protocol through the unique WebSocket protocol to display lyrics

-   [AMLL TTML Tool](https://github.com/Steve-xmh/amll-ttml-tool)： AMLL TTML Editor with editing support for lyrics in TTML format and real-time preview using AMLL Core
  
=======

### Main modules

-   [![AMLL-Core](https://img.shields.io/badge/Core-%233178c6?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/core/README.md)：AMLL Core Component Library，以 DOM Written natively，Provides a lyric display component and a dynamic fluid background component
-   [![AMLL-React](https://img.shields.io/badge/React-%23149eca?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/react/README.md)：AMLL React bind**，Provision React Lyrics in the form of components display components and dynamic fluid background components
-   [![AMLL-Vue](https://img.shields.io/badge/Vue-%2342d392?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/vue/README.md)：AMLL Vue bind，Provision Vue Lyrics in the form of components display components and dynamic fluid background components
-   [![AMLL-Lyric](https://img.shields.io/badge/Lyric-%23FB8C84?label=Apple%20Music-like%20Lyrics&labelColor=%23FB5C74)](./packages/lyric/README.md)：AMLL The lyrics parsing module provides parsing and serialization support for various lyric formats of LyRiC, YRC, QRC, Lyricify Syllable
### External tools

-   [AMLL Player](./packages/player/README.md)：AMLL External Player provides an independent external lyrics player, and communicates with AMLL's programs that implement any protocol through the unique WebSocket protocol to display lyrics
-   [AMLL TTML Tool](https://github.com/Steve-xmh/amll-ttml-tool)： AMLL TTML Editor with editing support for lyrics in TTML format and real-time preview using AMLL Core
-   [AMLL TTML Database](https://github.com/Steve-xmh/amll-ttml-db)： AMLL TTML database, which provides a TTML lyrics repository so that all kinds of lyric players can use community-made TTML word-for-word lyrics

## AMLL Player Preview Gallery

![AMLL Player Preview](https://github.com/user-attachments/assets/2b93b28f-7f79-4092-a0a5-bc7c66e731a9)

## Browser compatibility alerts

This component framework requires the following browsers or newer versions at a minimum：

-   Chromuim/Edge 91+
-   Firefox 100+
-   Safari 9.1+

The following browser or newer version is required to render all effects of the component：

-   Chromuim 120+
-   Firefox 100+
-   Safari 15.4+

Reference Links：

-   [https://caniuse.com/mdn-css_properties_mask-image](https://caniuse.com/mdn-css_properties_mask-image)
-   [https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter](https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter)

## Performance configuration reference

PERFORMANCE BENCHMARKS HAVE SHOWN THAT ALL MAJOR CPU PROCESSORS WITHIN FIVE YEARS CAN DRIVE THE LYRICS COMPONENT AT 30FPS, BUT IF YOU WANT TO RUN SMOOTHLY AT 60FPS, MAKE SURE THE CPU FREQUENCY IS AT LEAST 3.0Ghz OR ABOVE. If you need smooth operation above 144FPS, make sure the CPU frequency is at least 4.2Ghz or above.

GPU performance is capable of running at full 60 fps at the expected size under the following conditions:

-   `1080p (1920x1080)`: NVIDIA GTX 10 series and above
-   `2160p (3840x2160)`: NVIDIA RTX 2070 and above

## Code contributions

Due to the author's limited energy, he is no longer able to deal with the problems that arise during the use of the code, so the Issues section is closed, but any pull requests that contribute positively to the code are welcome!

## Development/build/packaging process

Install it `yarn`, `rustc`, `wasm-pack`，Clone the repository into any folder and enter the following command in the terminal to build it:：

```bash
yarn
yarn lerna run build:dev --scope "@applemusic-like-lyrics/*" # 开发构建
yarn lerna run build --scope "@applemusic-like-lyrics/*" # 发行构建
```

## Acknowledgement

-   [woshizja/sound-processor](https://github.com/woshizja/sound-processor)
-   There are also many frameworks and libraries that are used by AMLL, thank you very much!

### Special thanks to you

<div align="center">
<image src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg"></image>
<div>
thank <a href=https://jb.gg/OpenSourceSupport>JetBrains</a> A series of development tools to support the AMLL project
</div>
</div>
