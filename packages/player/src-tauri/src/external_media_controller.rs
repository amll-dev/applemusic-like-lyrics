use anyhow::{Context, Result};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use smtc_suite::{
    MediaCommand as SmtcControlCommandInternal, MediaUpdate, NowPlayingInfo as SmtcNowPlayingInfo,
    SmtcSessionInfo as SuiteSmtcSessionInfo,
};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::mpsc::{Receiver, Sender};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TextConversionMode {
    Off,
    TraditionalToSimplified,
    SimplifiedToTraditional,
    SimplifiedToTaiwan,
    TaiwanToSimplified,
    SimplifiedToHongKong,
    HongKongToSimplified,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum SmtcEvent {
    TrackChanged(FrontendNowPlayingInfo),
    SessionsChanged(Vec<SmtcSessionInfo>),
    SelectedSessionVanished(String),
    AudioData(Vec<u8>),
    Error(String),
    VolumeChanged { volume: f32, is_muted: bool },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct SmtcSessionInfo {
    pub session_id: String,
    pub display_name: String,
}

impl From<SuiteSmtcSessionInfo> for SmtcSessionInfo {
    fn from(info: SuiteSmtcSessionInfo) -> Self {
        Self {
            session_id: info.session_id,
            display_name: info.display_name,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MediaCommand {
    SelectSession { session_id: String },
    SetTextConversion { mode: TextConversionMode },
    SetShuffle { is_active: bool },
    SetRepeatMode { mode: RepeatMode },
    Play,
    Pause,
    SkipNext,
    SkipPrevious,
    SeekTo { time_ms: u64 },
    SetVolume { volume: f32 },
    StartAudioVisualization,
    StopAudioVisualization,
    SetHighFrequencyProgressUpdates { enabled: bool },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    One,
    All,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendNowPlayingInfo {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_title: Option<String>,
    pub duration_ms: Option<u64>,
    pub position_ms: Option<u64>,
    pub is_playing: Option<bool>,
    pub is_shuffle_active: Option<bool>,
    pub repeat_mode: Option<RepeatMode>,
    pub can_play: Option<bool>,
    pub can_pause: Option<bool>,
    pub can_skip_next: Option<bool>,
    pub can_skip_previous: Option<bool>,
    pub cover_data: Option<String>,
    pub cover_data_hash: Option<u64>,
}

impl From<SmtcNowPlayingInfo> for FrontendNowPlayingInfo {
    fn from(info: SmtcNowPlayingInfo) -> Self {
        Self {
            title: info.title,
            artist: info.artist,
            album_title: info.album_title,
            duration_ms: info.duration_ms,
            position_ms: info.position_ms,
            is_playing: info.is_playing,
            is_shuffle_active: info.is_shuffle_active,
            repeat_mode: info.repeat_mode.map(|m| match m {
                smtc_suite::RepeatMode::Off => RepeatMode::Off,
                smtc_suite::RepeatMode::One => RepeatMode::One,
                smtc_suite::RepeatMode::All => RepeatMode::All,
            }),
            can_play: info.can_play,
            can_pause: info.can_pause,
            can_skip_next: info.can_skip_next,
            can_skip_previous: info.can_skip_previous,
            cover_data: info.cover_data.map(|bytes| STANDARD.encode(bytes)),
            cover_data_hash: info.cover_data_hash,
        }
    }
}

pub struct ExternalMediaControllerState {
    pub smtc_command_tx: Sender<SmtcControlCommandInternal>,
}

impl ExternalMediaControllerState {
    pub async fn send_smtc_command(
        &self,
        command: SmtcControlCommandInternal,
    ) -> anyhow::Result<()> {
        self.smtc_command_tx
            .send(command)
            .await
            .context("发送命令到 SMTC 监听线程失败")
    }
}

#[tauri::command]
pub async fn control_external_media(
    payload: MediaCommand,
    state: tauri::State<'_, ExternalMediaControllerState>,
) -> Result<(), String> {
    let command = match payload {
        MediaCommand::SelectSession { session_id } => {
            let target_id = if session_id == "null" {
                "".to_string()
            } else {
                session_id
            };
            SmtcControlCommandInternal::SelectSession(target_id)
        }
        MediaCommand::SetTextConversion { mode } => {
            let suite_mode = match mode {
                TextConversionMode::Off => smtc_suite::TextConversionMode::Off,
                TextConversionMode::TraditionalToSimplified => {
                    smtc_suite::TextConversionMode::TraditionalToSimplified
                }
                TextConversionMode::SimplifiedToTraditional => {
                    smtc_suite::TextConversionMode::SimplifiedToTraditional
                }
                TextConversionMode::SimplifiedToTaiwan => {
                    smtc_suite::TextConversionMode::SimplifiedToTaiwan
                }
                TextConversionMode::TaiwanToSimplified => {
                    smtc_suite::TextConversionMode::TaiwanToSimplified
                }
                TextConversionMode::SimplifiedToHongKong => {
                    smtc_suite::TextConversionMode::SimplifiedToHongKong
                }
                TextConversionMode::HongKongToSimplified => {
                    smtc_suite::TextConversionMode::HongKongToSimplified
                }
            };
            SmtcControlCommandInternal::SetTextConversion(suite_mode)
        }
        MediaCommand::SetShuffle { is_active } => SmtcControlCommandInternal::Control(
            smtc_suite::SmtcControlCommand::SetShuffle(is_active),
        ),
        MediaCommand::SetRepeatMode { mode } => {
            let suite_mode = match mode {
                RepeatMode::Off => smtc_suite::RepeatMode::Off,
                RepeatMode::One => smtc_suite::RepeatMode::One,
                RepeatMode::All => smtc_suite::RepeatMode::All,
            };
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::SetRepeatMode(
                suite_mode,
            ))
        }
        MediaCommand::Play => {
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::Play)
        }
        MediaCommand::Pause => {
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::Pause)
        }
        MediaCommand::SkipNext => {
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::SkipNext)
        }
        MediaCommand::SkipPrevious => {
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::SkipPrevious)
        }
        MediaCommand::SeekTo { time_ms } => {
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::SeekTo(time_ms))
        }
        MediaCommand::SetVolume { volume } => {
            let clamped_volume = volume.clamp(0.0, 1.0);
            SmtcControlCommandInternal::Control(smtc_suite::SmtcControlCommand::SetVolume(
                clamped_volume,
            ))
        }
        MediaCommand::StartAudioVisualization => SmtcControlCommandInternal::StartAudioCapture,
        MediaCommand::StopAudioVisualization => SmtcControlCommandInternal::StopAudioCapture,
        MediaCommand::SetHighFrequencyProgressUpdates { enabled } => {
            SmtcControlCommandInternal::SetHighFrequencyProgressUpdates(enabled)
        }
    };

    state
        .send_smtc_command(command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_smtc_update(
    state: tauri::State<'_, ExternalMediaControllerState>,
) -> Result<(), String> {
    state
        .send_smtc_command(SmtcControlCommandInternal::RequestUpdate)
        .await
        .map_err(|e| e.to_string())
}

pub fn start_listener<R: Runtime>(app_handle: AppHandle<R>) -> ExternalMediaControllerState {
    let (controller, update_rx) = match smtc_suite::MediaManager::start() {
        Ok(c) => c,
        Err(_e) => {
            let (smtc_tx, _) = tokio::sync::mpsc::channel(1);
            return ExternalMediaControllerState {
                smtc_command_tx: smtc_tx,
            };
        }
    };

    let smtc_command_tx = controller.command_tx;

    let app_handle_receiver = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        event_receiver_loop(app_handle_receiver, update_rx).await;
    });

    let initial_command_tx = smtc_command_tx.clone();
    tauri::async_runtime::spawn(async move {
        let _ = initial_command_tx
            .send(SmtcControlCommandInternal::SetHighFrequencyProgressUpdates(
                true,
            ))
            .await;
    });

    ExternalMediaControllerState { smtc_command_tx }
}

async fn event_receiver_loop<R: Runtime>(
    app_handle: AppHandle<R>,
    mut update_rx: Receiver<MediaUpdate>,
) {
    while let Some(update) = update_rx.recv().await {
        let event_to_emit = match update {
            MediaUpdate::TrackChanged(info) | MediaUpdate::TrackChangedForced(info) => {
                let dto = parse_apple_music_field(info.into());
                Some(SmtcEvent::TrackChanged(dto))
            }
            MediaUpdate::SessionsChanged(sessions) => Some(SmtcEvent::SessionsChanged(
                sessions.into_iter().map(SmtcSessionInfo::from).collect(),
            )),
            MediaUpdate::AudioData(bytes) => Some(SmtcEvent::AudioData(bytes)),
            MediaUpdate::Error(e) => Some(SmtcEvent::Error(e)),
            MediaUpdate::VolumeChanged {
                volume, is_muted, ..
            } => Some(SmtcEvent::VolumeChanged { volume, is_muted }),
            MediaUpdate::SelectedSessionVanished(id) => {
                Some(SmtcEvent::SelectedSessionVanished(id))
            }
            MediaUpdate::Diagnostic(_) => None,
        };

        if let Some(event) = event_to_emit
            && let Err(_e) = app_handle.emit("smtc_update", event)
        {
            break;
        }
    }
}

fn parse_apple_music_field(mut info: FrontendNowPlayingInfo) -> FrontendNowPlayingInfo {
    if let Some(original_artist_field) = info.artist.take() {
        if let Some((artist, album)) = original_artist_field.split_once(" — ") {
            info.artist = Some(artist.trim().to_string());
            if info.album_title.as_deref().unwrap_or("").is_empty() {
                info.album_title = Some(album.trim().to_string());
            }
        } else {
            info.artist = Some(original_artist_field);
        }
    }
    info
}
