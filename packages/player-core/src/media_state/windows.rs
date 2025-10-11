use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::Duration,
};

use anyhow::Context;
use tokio::sync::mpsc::UnboundedReceiver;
use windows::{
    Foundation::*,
    Media::*,
    Storage::Streams::{DataWriter, InMemoryRandomAccessStream, RandomAccessStreamReference},
    core::*,
};

use super::MediaStateMessage;

#[derive(Debug)]
pub struct MediaStateManagerWindowsBackend {
    #[allow(dead_code)]
    mp: windows::Media::Playback::MediaPlayer,
    smtc: SystemMediaTransportControls,
    smtc_updater: SystemMediaTransportControlsDisplayUpdater,
    should_update_smtc: AtomicBool,
    cur_duration: Arc<AtomicU64>,
    cur_position: Arc<AtomicU64>,
    cur_playing: Arc<AtomicBool>,
}

impl MediaStateManagerWindowsBackend {
    fn update_timeline(&self) -> anyhow::Result<()> {
        let prop = SystemMediaTransportControlsTimelineProperties::new()?;
        let duration_ms = self.cur_duration.load(Ordering::Relaxed);
        let position_ms = self.cur_position.load(Ordering::Relaxed);

        prop.SetStartTime(TimeSpan::from(Duration::ZERO))?;
        prop.SetEndTime(TimeSpan::from(Duration::from_millis(duration_ms)))?;
        prop.SetPosition(TimeSpan::from(Duration::from_millis(position_ms)))?;
        prop.SetMinSeekTime(TimeSpan::from(Duration::ZERO))?;
        prop.SetMaxSeekTime(TimeSpan::from(Duration::from_millis(duration_ms)))?;

        self.smtc.UpdateTimelineProperties(&prop)?;
        Ok(())
    }
}

impl super::MediaStateManagerBackend for MediaStateManagerWindowsBackend {
    fn set_enabled(&self, enabled: bool) -> anyhow::Result<()> {
        self.smtc.SetIsEnabled(enabled)?;
        Ok(())
    }

    fn new() -> anyhow::Result<(Self, UnboundedReceiver<MediaStateMessage>)> {
        let (sx, rx) = tokio::sync::mpsc::unbounded_channel();
        let mp = windows::Media::Playback::MediaPlayer::new()?;
        mp.CommandManager()?.SetIsEnabled(false)?;

        let smtc = mp.SystemMediaTransportControls()?;
        smtc.SetIsEnabled(false)?;
        smtc.SetIsPlayEnabled(true)?;
        smtc.SetIsPauseEnabled(true)?;
        smtc.SetIsNextEnabled(true)?;
        smtc.SetIsPreviousEnabled(true)?;

        {
            let sx_clone = sx.clone();
            smtc.ButtonPressed(&TypedEventHandler::new(
                move |_, args: &Option<SystemMediaTransportControlsButtonPressedEventArgs>| {
                    if let Some(args) = args {
                        let button = args.Button()?;
                        let msg = match button {
                            SystemMediaTransportControlsButton::Play => {
                                Some(MediaStateMessage::Play)
                            }
                            SystemMediaTransportControlsButton::Pause => {
                                Some(MediaStateMessage::Pause)
                            }
                            SystemMediaTransportControlsButton::Next => {
                                Some(MediaStateMessage::Next)
                            }
                            SystemMediaTransportControlsButton::Previous => {
                                Some(MediaStateMessage::Previous)
                            }
                            _ => None,
                        };
                        if let Some(msg) = msg {
                            let _ = sx_clone.send(msg);
                        }
                    }
                    Ok(())
                },
            ))?;
        }

        let cur_duration = Arc::new(AtomicU64::new(0));
        let cur_position = Arc::new(AtomicU64::new(0));
        let cur_playing = Arc::new(AtomicBool::new(false));

        {
            let sx_clone = sx.clone();
            let cur_position_clone = Arc::clone(&cur_position);
            smtc.PlaybackPositionChangeRequested(&TypedEventHandler::new(
                move |_, args: &Option<PlaybackPositionChangeRequestedEventArgs>| {
                    if let Some(args) = args {
                        let pos: Duration = args.RequestedPlaybackPosition()?.into();
                        cur_position_clone.store(pos.as_millis() as u64, Ordering::Relaxed);
                        let _ = sx_clone.send(MediaStateMessage::Seek(pos.as_secs_f64()));
                    }
                    Ok(())
                },
            ))?;
        }

        let smtc_updater = smtc.DisplayUpdater()?;
        smtc_updater.SetAppMediaId(h!("AMLLPlayerCore"))?;
        smtc_updater.SetType(MediaPlaybackType::Music)?;
        mp.SetAudioDeviceType(windows::Media::Playback::MediaPlayerAudioDeviceType::Multimedia)?;

        let result = Self {
            mp,
            smtc,
            smtc_updater,
            should_update_smtc: AtomicBool::new(false),
            cur_duration,
            cur_position,
            cur_playing,
        };

        result.set_playing(false)?;
        result.set_title("未知歌曲")?;
        result.set_artist("未知歌手")?;
        result.update()?;
        result.update_timeline()?;

        Ok((result, rx))
    }

    fn set_playing(&self, playing: bool) -> anyhow::Result<()> {
        self.cur_playing.store(playing, Ordering::Relaxed);
        self.smtc.SetPlaybackStatus(if playing {
            MediaPlaybackStatus::Playing
        } else {
            MediaPlaybackStatus::Paused
        })?;
        Ok(())
    }

    fn set_title(&self, title: &str) -> anyhow::Result<()> {
        self.smtc_updater
            .MusicProperties()?
            .SetTitle(&HSTRING::from(title))?;
        self.should_update_smtc.store(true, Ordering::Relaxed);
        Ok(())
    }

    fn set_artist(&self, artist: &str) -> anyhow::Result<()> {
        self.smtc_updater
            .MusicProperties()?
            .SetArtist(&HSTRING::from(artist))?;
        self.should_update_smtc.store(true, Ordering::Relaxed);
        Ok(())
    }

    fn set_duration(&self, duration: f64) -> anyhow::Result<()> {
        self.cur_duration
            .store((duration * 1000.0) as u64, Ordering::Relaxed);
        self.update_timeline()?;
        Ok(())
    }

    fn set_position(&self, position: f64) -> anyhow::Result<()> {
        self.cur_position
            .store((position * 1000.0) as u64, Ordering::Relaxed);
        self.update_timeline()?;
        Ok(())
    }

    fn set_cover_image(&self, cover_data: impl AsRef<[u8]>) -> anyhow::Result<()> {
        let cover_data = cover_data.as_ref();
        if cover_data.is_empty() {
            self.smtc_updater.SetThumbnail(None)?;
        } else {
            let stream = InMemoryRandomAccessStream::new()?;
            let writer = DataWriter::CreateDataWriter(&stream)?;
            writer.WriteBytes(cover_data)?;
            writer
                .StoreAsync()?
                .get()
                .context("未能将图片数据存储到内存中")?;
            writer.DetachStream()?;

            let stream_ref = RandomAccessStreamReference::CreateFromStream(&stream)?;
            self.smtc_updater.SetThumbnail(&stream_ref)?;
        }

        self.should_update_smtc.store(true, Ordering::Relaxed);
        Ok(())
    }

    fn update(&self) -> anyhow::Result<()> {
        if self.should_update_smtc.swap(false, Ordering::Relaxed) {
            self.smtc_updater.Update()?;
        }
        Ok(())
    }
}
