---
title: 概览
---

AMLL 生态以 TTML 为主要的歌词存储与交换格式。TTML [由 W3C 定义](https://www.w3.org/TR/2018/REC-ttml1-20181108/)，基于 XML，因此具有较强的可扩展性。

AMLL 提供两个包，用于歌词格式正反序列化：

- [@applemusic-like-lyrics/ttml](https://www.npmjs.com/package/@applemusic-like-lyrics/ttml)  
  TTML 逐字歌词格式正反序列化库。提供最详细的信息，包括逐字音译等特色功能。

- [@applemusic-like-lyrics/lyric](https://www.npmjs.com/package/@applemusic-like-lyrics/lyric)  
  主流各歌词格式的解析与生成库，例如 LRC、YRC、LQE 等，其中 TTML 正反解实际上依赖 @applemusic-like-lyrics/ttml。
