# AMLL for React (Full ver.)

English / [简体中文](./packages/react-full/README-CN.md)

> Warning: This is a personal project and has not yet been completed. There may still be a lot of problems, so please do not use it directly in the production environment!

AMLL component library's React is a more modular component binding. You can use this library to more conveniently use AMLL lyrics components and other themed modular components, and quickly build the required layout framework, and provide corresponding slots to add custom content.

For detailed API documentation, please refer to [AMLL Docs](https://amll.dev/en/reference/react-full.html).

## Host integration with `PrebuiltLyricPlayer`

`coverProps` forwards DOM attributes, styles and a ref to the live `Cover` root.
Its URL, media kind and playback state still come from the existing atoms.
`coverFrameRef` targets the layout anchor around that cover, before the cover's
own pause transform. The anchor owns the immersive-layout mask. Both refs may
detach and attach to new elements when the responsive layout changes; consumers
must not cache an element across those changes or remove React-owned nodes.
`coverProps.videoRef` exposes the live video element for media-frame handoffs;
it is cleared for image covers. `coverVideoPaused` disables video autoplay.

`controlThumbProps.ref` targets the collapse control's container;
`controlThumbProps.buttonRef` targets its actual button. Use `buttonLabel` for an
accessible name. An explicit `onClick` takes precedence over the existing
`onClickControlThumbAtom` callback. Object refs, callback refs and React 19 ref
cleanup functions are supported.

Playlist controls are optional and controlled by the host:

```tsx
<PrebuiltLyricPlayer
  playlistOpened={queueOpen}
  onPlaylistOpenedChange={setQueueOpen}
  playlistControls="play-queue"
  playlistButtonLabel="Play queue"
  controlThumbProps={{ buttonLabel: "Collapse player", onClick: closePlayer }}
/>
```

The horizontal and vertical buttons request the next boolean state and expose
it through `aria-expanded`. `playlistControls` supplies `aria-controls`. The
library does not create a queue panel or modify the host's playback queue.
Omitting the new props preserves the existing atom-based playback behavior.

Browser API checks: run the React Full playground and open `/public-api.html`.
The fixture uses real components under Strict Mode to exercise ref replacement,
responsive remounts, callback precedence and controlled playlist state.
