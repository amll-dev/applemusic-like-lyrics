use crate::{v1, v2};
use anyhow::anyhow;

impl From<v1::Body> for v2::Payload {
    fn from(body: v1::Body) -> Self {
        match body {
            v1::Body::Pause => Self::Command(v2::Command::Pause),
            v1::Body::Resume => Self::Command(v2::Command::Resume),
            v1::Body::ForwardSong => Self::Command(v2::Command::ForwardSong),
            v1::Body::BackwardSong => Self::Command(v2::Command::BackwardSong),
            v1::Body::SetVolume { volume } => Self::Command(v2::Command::SetVolume { volume }),
            v1::Body::SeekPlayProgress { progress } => {
                Self::Command(v2::Command::SeekPlayProgress { progress })
            }
            v1::Body::SetMusicInfo {
                music_id,
                music_name,
                album_id,
                album_name,
                artists,
                duration,
            } => Self::State(v2::StateUpdate::SetMusic(v2::MusicInfo {
                music_id: music_id.to_string(),
                music_name: music_name.to_string(),
                album_id: album_id.to_string(),
                album_name: album_name.to_string(),
                artists,
                duration,
            })),
            v1::Body::SetMusicAlbumCoverImageURI { img_url } => {
                Self::State(v2::StateUpdate::SetCover(v2::AlbumCover::Uri {
                    url: img_url.to_string(),
                }))
            }
            v1::Body::SetMusicAlbumCoverImageData { data } => {
                Self::State(v2::StateUpdate::SetCover(v2::AlbumCover::Data {
                    image: v2::ImageData {
                        mime_type: None,
                        data,
                    },
                }))
            }
            v1::Body::SetLyric { data } => {
                Self::State(v2::StateUpdate::SetLyric(v2::LyricContent::Structured {
                    lines: data,
                }))
            }
            v1::Body::SetLyricFromTTML { data } => {
                Self::State(v2::StateUpdate::SetLyric(v2::LyricContent::Ttml {
                    data: data.to_string(),
                }))
            }
            v1::Body::OnPlayProgress { progress } => {
                Self::State(v2::StateUpdate::Progress { progress })
            }
            v1::Body::OnVolumeChanged { volume } => Self::State(v2::StateUpdate::Volume { volume }),
            v1::Body::OnPaused => Self::State(v2::StateUpdate::Paused),
            v1::Body::OnResumed => Self::State(v2::StateUpdate::Resumed),
            v1::Body::OnAudioData { data } => Self::State(v2::StateUpdate::AudioData { data }),
            v1::Body::Ping => Self::Ping,
            v1::Body::Pong => Self::Pong,
        }
    }
}

/// v2 转 v1 协议是有损且可能失败的
impl TryFrom<v2::Payload> for v1::Body {
    type Error = anyhow::Error;

    fn try_from(payload: v2::Payload) -> Result<Self, Self::Error> {
        Ok(match payload {
            v2::Payload::Command(cmd) => match cmd {
                v2::Command::Pause => Self::Pause,
                v2::Command::Resume => Self::Resume,
                v2::Command::ForwardSong => Self::ForwardSong,
                v2::Command::BackwardSong => Self::BackwardSong,
                v2::Command::SetVolume { volume } => Self::SetVolume { volume },
                v2::Command::SeekPlayProgress { progress } => Self::SeekPlayProgress { progress },
                v2::Command::SetRepeatMode { .. } | v2::Command::SetShuffleMode { .. } => {
                    return Err(anyhow!("v1 协议不支持设置循环和随机播放模式"));
                }
            },
            v2::Payload::State(state) => match state {
                v2::StateUpdate::SetMusic(info) => Self::SetMusicInfo {
                    music_id: info.music_id.into(),
                    music_name: info.music_name.into(),
                    album_id: info.album_id.into(),
                    album_name: info.album_name.into(),
                    artists: info.artists,
                    duration: info.duration,
                },
                v2::StateUpdate::SetCover(cover) => match cover {
                    v2::AlbumCover::Uri { url } => Self::SetMusicAlbumCoverImageURI {
                        img_url: url.into(),
                    },
                    v2::AlbumCover::Data { image } => {
                        Self::SetMusicAlbumCoverImageData { data: image.data }
                    }
                },
                v2::StateUpdate::SetLyric(lyric) => match lyric {
                    v2::LyricContent::Structured { lines } => Self::SetLyric { data: lines },
                    v2::LyricContent::Ttml { data } => Self::SetLyricFromTTML { data: data.into() },
                },
                v2::StateUpdate::Progress { progress } => Self::OnPlayProgress { progress },
                v2::StateUpdate::Volume { volume } => Self::OnVolumeChanged { volume },
                v2::StateUpdate::Paused => Self::OnPaused,
                v2::StateUpdate::Resumed => Self::OnResumed,
                v2::StateUpdate::AudioData { data } => Self::OnAudioData { data },
                v2::StateUpdate::ModeChanged { .. } => {
                    return Err(anyhow!("v1 协议不支持设置循环和随机播放模式"));
                }
            },
            v2::Payload::Ping => Self::Ping,
            v2::Payload::Pong => Self::Pong,
            v2::Payload::Initialize => return Err(anyhow!("Initialize 消息无法转换为 v1 协议")),
        })
    }
}

impl From<v2::BinaryV2> for v2::Payload {
    fn from(binary: v2::BinaryV2) -> Self {
        match binary {
            v2::BinaryV2::OnAudioData { data } => Self::State(v2::StateUpdate::AudioData { data }),
            v2::BinaryV2::SetCoverData { data } => {
                Self::State(v2::StateUpdate::SetCover(v2::AlbumCover::Data {
                    image: v2::ImageData {
                        mime_type: None,
                        data,
                    },
                }))
            }
        }
    }
}
