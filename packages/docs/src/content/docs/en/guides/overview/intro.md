---
title: Introduction
description: A quick introduction to AMLL
---

## What is AMLL

Apple Music Like Lyrics (AMLL) is an open-source frontend library for Apple Music style word-by-word lyric rendering.

Word-by-word lyrics (also called syllable-level lyrics) means lyric timing is aligned to syllables (Chinese characters, or syllables in alphabetic languages), similar to karaoke style rendering. During playback, text is highlighted progressively in sync with the music. You can see a simple demo on the [home page](/en/). Screenshots are shown below.

![Screenshot](./images/screenshot.png)

## Distribution and Usage

AMLL is distributed as npm packages and provides tools across rendering components, framework bindings, and lyric processing:

- **Rendering packages** (browser)
  - [@applemusic-like-lyrics/core](https://www.npmjs.com/package/@applemusic-like-lyrics/core)
    AMLL core library with framework-agnostic lyric and background rendering components
  - [@applemusic-like-lyrics/react](https://www.npmjs.com/package/@applemusic-like-lyrics/react)
    React bindings for the core library
  - [@applemusic-like-lyrics/vue](https://www.npmjs.com/package/@applemusic-like-lyrics/vue)
    Vue bindings for the core library
  - [@applemusic-like-lyrics/react-full](https://www.npmjs.com/package/@applemusic-like-lyrics/react-full)
    Ready-to-use full player package with progress bar, cover, lyrics, background, etc. (React only)

- **Peripheral tools** (browser and Node)
  - [@applemusic-like-lyrics/ttml](https://www.npmjs.com/package/@applemusic-like-lyrics/ttml)
    Parsing and generation library for TTML word-by-word lyrics
  - [@applemusic-like-lyrics/lyric](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)
    Parsing and generation library for popular lyric formats, such as LRC, YRC, and LQE
  - [@applemusic-like-lyrics/fft](https://www.npmjs.com/package/@applemusic-like-lyrics/fft)
    Audio visualization module that converts waveform data into spectrum data
  - [@applemusic-like-lyrics/ws-protocol](https://www.npmjs.com/package/@applemusic-like-lyrics/ws-protocol)
    Lyrics player protocol library for syncing playback progress and playback information

AMLL is **open-sourced under [GNU General Public License v3.0 only](https://spdx.org/licenses/GPL-3.0.html)**, with the repository hosted on [GitHub](https://github.com/amll-dev/applemusic-like-lyrics). You can integrate it into your projects under the license terms.

Thanks to the maturity of frontend technologies, web rendering now has strong consistency across browsers, desktop, and mobile platforms. If you are building a music player, karaoke app, or related product with frontend technologies, AMLL is a strong option.

## Next Step

Beyond AMLL itself, there is a growing ecosystem around it, including lyric databases, lyric editors, and first-party players. See [Ecosystem](./eco) for details.

If you want to start using AMLL in your project, continue with [Quick Start](./quickstart).
