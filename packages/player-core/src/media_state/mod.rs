use std::fmt::Debug;

use tokio::sync::mpsc::UnboundedReceiver;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

pub enum MediaStateMessage {
    Play,
    Pause,
    PlayOrPause,
    Seek(f64),
    Next,
    Previous,
}

pub(super) trait MediaStateManagerBackend: Sized + Send + Sync + Debug {
    fn new() -> anyhow::Result<(Self, UnboundedReceiver<MediaStateMessage>)>;
    fn set_enabled(&self, enabled: bool) -> anyhow::Result<()>;
    fn set_playing(&self, playing: bool) -> anyhow::Result<()>;
    fn set_title(&self, title: &str) -> anyhow::Result<()>;
    fn set_artist(&self, artist: &str) -> anyhow::Result<()>;
    fn set_cover_image(&self, cover_data: impl AsRef<[u8]>) -> anyhow::Result<()>;
    fn set_duration(&self, duration: f64) -> anyhow::Result<()>;
    fn set_position(&self, position: f64) -> anyhow::Result<()>;
    fn update(&self) -> anyhow::Result<()>;
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
#[derive(Debug)]
pub struct EmptyMediaStateManager;

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
impl MediaStateManagerBackend for EmptyMediaStateManager {
    fn new() -> anyhow::Result<(Self, UnboundedReceiver<MediaStateMessage>)> {
        Ok((Self, tokio::sync::mpsc::unbounded_channel().1))
    }

    fn set_enabled(&self, _enabled: bool) -> anyhow::Result<()> {
        Ok(())
    }

    fn set_playing(&self, _playing: bool) -> anyhow::Result<()> {
        Ok(())
    }

    fn set_title(&self, _title: &str) -> anyhow::Result<()> {
        Ok(())
    }

    fn set_artist(&self, _artist: &str) -> anyhow::Result<()> {
        Ok(())
    }

    fn set_cover_image(&self, _cover_data: impl AsRef<[u8]>) -> anyhow::Result<()> {
        Ok(())
    }

    fn set_duration(&self, _duration: f64) -> anyhow::Result<()> {
        Ok(())
    }

    fn set_position(&self, _position: f64) -> anyhow::Result<()> {
        Ok(())
    }

    fn update(&self) -> anyhow::Result<()> {
        Ok(())
    }
}

#[cfg(target_os = "windows")]
pub type MediaStateManager = windows::MediaStateManagerWindowsBackend;
#[cfg(target_os = "macos")]
pub type MediaStateManager = macos::MediaStateManagerMacOSBackend;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub type MediaStateManager = EmptyMediaStateManager;
