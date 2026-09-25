# AMLL for React (Full ver.)

> 警告：此为个人项目，且尚未完成开发，可能仍有大量问题，所以请勿直接用于生产环境！

AMLL 组件库的 React 更加模块化的组件绑定，你可以通过此库来更加方便地使用 AMLL 歌词组件和其他主题化模块化组件，并快速搭建出所需要的布局框架，并且提供了相应的槽位以添加自定义内容。

详细的 API 文档请参考 [AMLL Docs](https://amll.dev/reference/react-full.html)。

## `PrebuiltLyricPlayer` 的宿主接入

`coverProps` 将 DOM 属性、样式及 ref 传给真实 `Cover` 根节点；封面地址、媒体类型和播放状态仍由现有 atom 管理。
`coverFrameRef` 指向布局中的封面容器，不包含 `Cover` 自身的暂停缩放，但包含沉浸布局遮罩。
响应式布局切换时，两种 ref 都可能先解除绑定再指向新节点。调用方应跟随 ref 更新，不应缓存旧节点或移除 React 管理的节点。
`coverProps.videoRef` 提供真实视频元素以协调画面交接，切换为图片时清空；`coverVideoPaused` 会禁止视频自动播放。

`controlThumbProps.ref` 指向收起控制的容器，`controlThumbProps.buttonRef` 指向真实按钮。
`buttonLabel` 提供无障碍名称；显式 `onClick` 优先于原有 `onClickControlThumbAtom` 回调。
这些 ref 支持对象形式、回调形式和 React 19 清理函数。

播放列表入口由宿主受控管理：

```tsx
<PrebuiltLyricPlayer
  playlistOpened={queueOpen}
  onPlaylistOpenedChange={setQueueOpen}
  playlistControls="play-queue"
  playlistButtonLabel="播放队列"
  controlThumbProps={{ buttonLabel: "收起播放页", onClick: closePlayer }}
/>
```

横屏和竖屏入口都会请求下一个布尔状态，并通过 `aria-expanded` 反映当前值。
`playlistControls` 提供 `aria-controls`。库不会创建队列面板或修改宿主队列。
省略新增属性时，保留现有基于 atom 的播放行为。

启动 React Full playground 后访问 `/public-api.html` 可运行真实组件检查，覆盖 Strict Mode、ref 替换、响应式重新挂载、回调优先级和受控列表状态。
