use std::sync::LazyLock;

use amll_player_core::AudioThreadEventMessage;
use amll_player_core::AudioThreadMessage;
use amll_player_core::{AudioPlayer, AudioPlayerConfig, AudioPlayerHandle};
use rodio::OutputStream;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::RwLock;
use tracing::error;
use tracing::warn;

pub static PLAYER_HANDLER: LazyLock<RwLock<Option<AudioPlayerHandle>>> =
    LazyLock::new(|| RwLock::new(None));

#[tauri::command]
pub async fn local_player_send_msg(msg: AudioThreadEventMessage<AudioThreadMessage>) {
    if let Some(handler) = &*PLAYER_HANDLER.read().await
        && let Err(err) = handler.send(msg).await
    {
        warn!("failed to send msg to local player: {:?}", err);
    }
}

#[tauri::command]
pub async fn set_media_controls_enabled(enabled: bool) {
    if let Some(handler) = &*PLAYER_HANDLER.read().await {
        let msg = AudioThreadMessage::SetMediaControlsEnabled { enabled };
        if let Err(err) = handler.send_anonymous(msg).await {
            warn!(
                "failed to send SetMediaControlsEnabled msg to local player: {:?}",
                err
            );
        }
    }
}

pub fn init_local_player<R: Runtime>(app: AppHandle<R>, stream: OutputStream) {
    tauri::async_runtime::spawn(async move {
        local_player_main(app, stream).await;
    });
}

async fn local_player_main<R: Runtime>(app: AppHandle<R>, stream: OutputStream) {
    let player = AudioPlayer::new(AudioPlayerConfig {}, stream);
    let handler = player.handler();
    PLAYER_HANDLER.write().await.replace(handler);
    let app_clone = app.clone();
    player
        .run(move |evt| {
            if let Err(err) = app_clone.emit("plugin:player-core-event", &evt) {
                error!("发送事件时出错: {err:?}");
            }
        })
        .await;
}
