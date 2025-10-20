use std::{
    cell::Cell,
    ptr::NonNull,
    sync::{Mutex, RwLock},
};

use super::*;
use anyhow::Context;
use objc2::{AnyThread, rc::*, runtime::AnyObject};
use objc2_app_kit::*;
use objc2_foundation::*;
use objc2_media_player::*;
use tokio::sync::mpsc::UnboundedSender;

// static NP_INFO_CTR_LOCK: Mutex<()> = Mutex::new(());

pub struct MediaStateManagerMacOSBackend {
    np_info_ctr: Retained<MPNowPlayingInfoCenter>,
    cmd_ctr: Retained<MPRemoteCommandCenter>,
    info: Mutex<Retained<NSMutableDictionary<NSString, AnyObject>>>,
    playing: Cell<bool>,
    sender: UnboundedSender<MediaStateMessage>,
}

impl Debug for MediaStateManagerMacOSBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MediaStateManagerMacOSBackend")
            .field("np_info_ctr", &self.np_info_ctr)
            .field("info", &self.info)
            .field("playing", &self.playing)
            .finish()
    }
}

unsafe impl Send for MediaStateManagerMacOSBackend {}
unsafe impl Sync for MediaStateManagerMacOSBackend {}

impl MediaStateManagerBackend for MediaStateManagerMacOSBackend {
    fn set_enabled(&self, enabled: bool) -> anyhow::Result<()> {
        unsafe {
            self.cmd_ctr.playCommand().setEnabled(enabled);
            self.cmd_ctr.pauseCommand().setEnabled(enabled);
            self.cmd_ctr.togglePlayPauseCommand().setEnabled(enabled);
            self.cmd_ctr.nextTrackCommand().setEnabled(enabled);
            self.cmd_ctr.previousTrackCommand().setEnabled(enabled);
            self.cmd_ctr
                .changePlaybackPositionCommand()
                .setEnabled(enabled);
        }
        Ok(())
    }

    fn new() -> anyhow::Result<(Self, UnboundedReceiver<MediaStateMessage>)> {
        let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
        let np_info_ctr = unsafe { MPNowPlayingInfoCenter::defaultCenter() };
        let cmd_ctr = unsafe { MPRemoteCommandCenter::sharedCommandCenter() };
        let dict: Retained<NSMutableDictionary<NSString, AnyObject>> = NSMutableDictionary::new();
        unsafe {
            dict.setValue_forKey(
                Some(&NSNumber::new_usize(MPMediaType::Music.0)),
                MPMediaItemPropertyMediaType,
            );
        }
        // TODO: 实现 Drop 以回收这些资源
        {
            let sender_clone = sender.clone();
            let req_handler = block2::RcBlock::new(
                move |_: NonNull<MPRemoteCommandEvent>| -> MPRemoteCommandHandlerStatus {
                    let _ = sender_clone.send(MediaStateMessage::Play);
                    MPRemoteCommandHandlerStatus::Success
                },
            );
            unsafe {
                cmd_ctr.playCommand().addTargetWithHandler(&req_handler);
            }
        }
        {
            let sender_clone = sender.clone();
            let req_handler = block2::RcBlock::new(
                move |_: NonNull<MPRemoteCommandEvent>| -> MPRemoteCommandHandlerStatus {
                    let _ = sender_clone.send(MediaStateMessage::Pause);
                    MPRemoteCommandHandlerStatus::Success
                },
            );
            unsafe {
                cmd_ctr.pauseCommand().addTargetWithHandler(&req_handler);
            }
        }
        {
            let sender_clone = sender.clone();
            let req_handler = block2::RcBlock::new(
                move |mut evt: NonNull<MPRemoteCommandEvent>| -> MPRemoteCommandHandlerStatus {
                    if let Some(evt) = unsafe { Retained::retain(evt.as_mut()) } {
                        let evt: Retained<MPChangePlaybackPositionCommandEvent> =
                            unsafe { Retained::cast_unchecked(evt) };
                        let pos = unsafe { evt.positionTime() };
                        let _ = sender_clone.send(MediaStateMessage::Seek(pos));
                    }
                    MPRemoteCommandHandlerStatus::Success
                },
            );
            unsafe {
                cmd_ctr
                    .changePlaybackPositionCommand()
                    .addTargetWithHandler(&req_handler);
            }
        }
        {
            let sender_clone = sender.clone();
            let req_handler = block2::RcBlock::new(
                move |_: NonNull<MPRemoteCommandEvent>| -> MPRemoteCommandHandlerStatus {
                    let _ = sender_clone.send(MediaStateMessage::PlayOrPause);
                    MPRemoteCommandHandlerStatus::Success
                },
            );
            unsafe {
                cmd_ctr
                    .togglePlayPauseCommand()
                    .addTargetWithHandler(&req_handler);
            }
        }
        {
            let sender_clone = sender.clone();
            let req_handler = block2::RcBlock::new(
                move |_: NonNull<MPRemoteCommandEvent>| -> MPRemoteCommandHandlerStatus {
                    let _ = sender_clone.send(MediaStateMessage::Previous);
                    MPRemoteCommandHandlerStatus::Success
                },
            );
            unsafe {
                cmd_ctr
                    .previousTrackCommand()
                    .addTargetWithHandler(&req_handler);
            }
        }
        {
            let sender_clone = sender.clone();
            let req_handler = block2::RcBlock::new(
                move |_: NonNull<MPRemoteCommandEvent>| -> MPRemoteCommandHandlerStatus {
                    let _ = sender_clone.send(MediaStateMessage::Next);
                    MPRemoteCommandHandlerStatus::Success
                },
            );
            unsafe {
                cmd_ctr
                    .nextTrackCommand()
                    .addTargetWithHandler(&req_handler);
            }
        }
        Ok((
            Self {
                np_info_ctr,
                cmd_ctr,
                info: Mutex::new(dict),
                playing: Cell::new(false),
                sender,
            },
            receiver,
        ))
    }

    fn set_playing(&self, playing: bool) -> anyhow::Result<()> {
        unsafe {
            self.np_info_ctr.setPlaybackState(if playing {
                MPNowPlayingPlaybackState::Playing
            } else {
                MPNowPlayingPlaybackState::Paused
            });
        }
        Ok(())
    }

    fn set_title(&self, title: &str) -> anyhow::Result<()> {
        let info = self.info.lock().unwrap();
        unsafe {
            info.setValue_forKey(Some(&NSString::from_str(title)), MPMediaItemPropertyTitle);
        }
        Ok(())
    }

    fn set_artist(&self, artist: &str) -> anyhow::Result<()> {
        let info = self.info.lock().unwrap();
        unsafe {
            info.setValue_forKey(Some(&NSString::from_str(artist)), MPMediaItemPropertyArtist);
        }
        Ok(())
    }

    fn set_duration(&self, duration: f64) -> anyhow::Result<()> {
        let info = self.info.lock().unwrap();
        unsafe {
            info.setValue_forKey(
                Some(&NSNumber::new_f64(duration)),
                MPMediaItemPropertyPlaybackDuration,
            );
        }
        Ok(())
    }

    fn set_position(&self, position: f64) -> anyhow::Result<()> {
        let info = self.info.lock().unwrap();
        unsafe {
            info.setValue_forKey(
                Some(&NSNumber::new_f64(position)),
                MPNowPlayingInfoPropertyElapsedPlaybackTime,
            );
        }
        Ok(())
    }

    fn set_cover_image(&self, cover_data: impl AsRef<[u8]>) -> anyhow::Result<()> {
        let cover_data = cover_data.as_ref();
        if cover_data.is_empty() {
            let info = self.info.lock().unwrap();
            unsafe {
                info.setValue_forKey(None, MPMediaItemPropertyArtwork);
            }
            return Ok(());
        }
        let cover_data = cover_data.to_vec();
        let cover_data = NSData::from_vec(cover_data);
        let img = NSImage::alloc();
        let img = NSImage::initWithData(img, &cover_data).context("initWithData")?;
        let img_size = unsafe { img.size() };
        let img = NonNull::new(Retained::into_raw(img)).unwrap();
        let artwork = MPMediaItemArtwork::alloc();
        let req_handler = block2::RcBlock::new(move |_: NSSize| img);
        let artwork = unsafe {
            MPMediaItemArtwork::initWithBoundsSize_requestHandler(artwork, img_size, &req_handler)
        };
        let info = self.info.lock().unwrap();
        unsafe {
            info.setValue_forKey(Some(&artwork), MPMediaItemPropertyArtwork);
        }
        Ok(())
    }

    fn update(&self) -> anyhow::Result<()> {
        let np_info = self.info.lock().unwrap();
        let np_info = np_info.copy();
        unsafe {
            self.np_info_ctr.setNowPlayingInfo(Some(&np_info));
        }
        Ok(())
    }
}
