use crate::server::AMLLWebSocketServer;
use amll_player_core::AudioInfo;
use anyhow::Context;
use anyhow::anyhow;
use rodio::OutputStream;
use serde::*;
use serde_json::Value;
use std::fs::File;
use std::net::SocketAddr;
use symphonia::core::io::MediaSourceStream;
use tauri::ipc::Channel;
use tauri::{
    AppHandle, Manager, PhysicalSize, Runtime, Size, State, WebviewWindowBuilder,
    utils::config::WindowEffectsConfig, window::Effect,
};
use tokio::sync::RwLock;
use tracing::*;

mod player;
mod screen_capture;
mod server;

#[cfg(target_os = "windows")]
mod external_media_controller;

pub type AMLLWebSocketServerWrapper = RwLock<AMLLWebSocketServer>;
pub type AMLLWebSocketServerState<'r> = State<'r, AMLLWebSocketServerWrapper>;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
async fn ws_reopen_connection(
    addr: &str,
    ws: AMLLWebSocketServerState<'_>,
    channel: Channel<ws_protocol::v2::Payload>,
) -> Result<(), String> {
    ws.write().await.reopen(addr.to_string(), channel);
    Ok(())
}

#[tauri::command]
async fn ws_close_connection(ws: AMLLWebSocketServerState<'_>) -> Result<(), String> {
    ws.write().await.close().await;
    Ok(())
}

#[tauri::command]
async fn ws_get_connections(ws: AMLLWebSocketServerState<'_>) -> Result<Vec<SocketAddr>, String> {
    let server_guard = ws.read().await;
    let connections = server_guard.get_connections().await;
    Ok(connections)
}

#[tauri::command]
async fn ws_broadcast_payload(
    ws: AMLLWebSocketServerState<'_>,
    payload: ws_protocol::v2::Payload,
) -> Result<(), String> {
    ws.write().await.broadcast_payload(payload).await;
    Ok(())
}

#[tauri::command]
fn restart_app<R: Runtime>(app: AppHandle<R>) {
    tauri::process::restart(&app.env())
}

#[tauri::command]
async fn reset_window_theme<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(desktop)]
        if let Err(e) = window.set_theme(None) {
            return Err(e.to_string());
        }
        Ok(())
    } else {
        Err("Main window not found.".to_string())
    }
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicInfo {
    pub name: String,
    pub artist: String,
    pub album: String,
    pub lyric_format: String,
    pub lyric: String,
    pub comment: String,
    pub cover: Vec<u8>,
    pub duration: f64,
}

impl From<AudioInfo> for MusicInfo {
    fn from(v: AudioInfo) -> Self {
        Self {
            name: v.name,
            artist: v.artist,
            album: v.album,
            lyric_format: if v.lyric.is_empty() {
                "".into()
            } else {
                "lrc".into()
            },
            lyric: v.lyric,
            comment: v.comment,
            cover: v.cover.unwrap_or_default(),
            duration: v.duration,
        }
    }
}

#[tauri::command]
async fn read_local_music_metadata(
    file_path: tauri_plugin_fs::FilePath,
    fs: State<'_, tauri_plugin_fs::Fs<tauri::Wry>>,
) -> Result<MusicInfo, String> {
    let path_clone = file_path
        .as_path()
        .context("Invalid file path")
        .map_err(|e| e.to_string())?
        .to_path_buf();

    let audio_info = tokio::task::spawn_blocking(move || -> anyhow::Result<AudioInfo> {
        let src = File::open(&path_clone)
            .with_context(|| format!("无法打开文件: {}", path_clone.display()))?;
        let mss = MediaSourceStream::new(Box::new(src), Default::default());

        match symphonia::default::get_probe().format(
            &Default::default(),
            mss,
            &Default::default(),
            &Default::default(),
        ) {
            Ok(mut probed) => Ok(amll_player_core::utils::read_audio_info(&mut probed)),
            Err(err) => {
                tracing::error!("读取文件 {} 失败: {}", path_clone.display(), err);
                Err(anyhow!("Probe failed: {}", err))
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let mut music_info: MusicInfo = audio_info.into();

    if let Some(file_path_ref) = file_path.as_path()
        && music_info.lyric.is_empty()
    {
        const LYRIC_FILE_EXTENSIONS: &[&str] = &["ttml", "lys", "yrc", "qrc", "eslrc", "lrc"];
        for ext in LYRIC_FILE_EXTENSIONS {
            let lyric_file_path = file_path_ref.with_extension(ext);
            if lyric_file_path.exists() {
                if let Ok(lyric) = fs.read_to_string(&lyric_file_path) {
                    music_info.lyric_format = ext.to_string();
                    music_info.lyric = lyric;
                    break;
                } else {
                    warn!("歌词文件存在但读取失败: {}", lyric_file_path.display());
                }
            }
        }
    }

    Ok(music_info)
}

async fn create_common_win<'a>(
    app: &'a AppHandle,
    url: tauri::WebviewUrl,
    label: &str,
) -> tauri::WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    let win = WebviewWindowBuilder::new(app, label, url);
    #[cfg(target_os = "windows")]
    let win = win.transparent(true);
    #[cfg(not(desktop))]
    let win = win;

    #[cfg(desktop)]
    let win = win
        .center()
        .inner_size(800.0, 600.0)
        .effects(WindowEffectsConfig {
            effects: vec![Effect::Tabbed, Effect::Mica],
            ..Default::default()
        })
        .theme(None)
        .title({
            #[cfg(target_os = "macos")]
            {
                ""
            }
            #[cfg(not(target_os = "macos"))]
            {
                "AMLL Player"
            }
        })
        .visible({
            #[cfg(target_os = "macos")]
            {
                true
            }
            #[cfg(not(target_os = "macos"))]
            {
                false
            }
        })
        .decorations({
            #[cfg(target_os = "macos")]
            {
                true
            }
            #[cfg(not(target_os = "macos"))]
            {
                false
            }
        });

    #[cfg(target_os = "macos")]
    let win = win.title_bar_style(tauri::TitleBarStyle::Overlay);

    win
}

async fn recreate_window(app: &AppHandle, label: &str, path: Option<&str>) {
    info!("Recreating window: {}", label);
    if let Some(win) = app.get_webview_window(label) {
        #[cfg(desktop)]
        {
            let _ = win.show();
            let _ = win.set_focus();
        }
        return;
    }
    #[cfg(debug_assertions)]
    let url = {
        tauri::WebviewUrl::External(
            app.config()
                .build
                .dev_url
                .clone()
                .unwrap()
                .join(path.unwrap_or(""))
                .expect("Failed to create external URL"),
        )
    };
    #[cfg(not(debug_assertions))]
    let url = tauri::WebviewUrl::App(path.unwrap_or("index.html").into());
    let win = create_common_win(app, url, label).await;

    let win = win.build().expect("can't show original window");

    #[cfg(desktop)]
    {
        let _ = win.set_focus();
        if let Ok(orig_size) = win.inner_size() {
            let _ = win.set_size(Size::Physical(PhysicalSize::new(0, 0)));
            let _ = win.set_size(orig_size);
        }
    }

    info!("Created window: {}", label);
}

#[tauri::command]
async fn open_screenshot_window(app: AppHandle) {
    recreate_window(&app, "screenshot", Some("screenshot.html")).await;
}

fn init_logging() {
    #[cfg(not(debug_assertions))]
    {
        let log_file = std::fs::File::create("amll-player.log");
        if let Ok(log_file) = log_file {
            tracing_subscriber::fmt()
                .map_writer(move |_| log_file)
                .with_thread_names(true)
                .with_ansi(false)
                .with_timer(tracing_subscriber::fmt::time::uptime())
                .init();
        } else {
            tracing_subscriber::fmt()
                .with_thread_names(true)
                .with_timer(tracing_subscriber::fmt::time::uptime())
                .init();
        }
    }
    #[cfg(debug_assertions)]
    {
        tracing_subscriber::fmt()
            .with_env_filter("amll_player=trace,smtc_suite=debug,wry=info")
            .with_thread_names(true)
            .with_timer(tracing_subscriber::fmt::time::uptime())
            .init();
    }
    std::panic::set_hook(Box::new(move |info| {
        error!("Fatal error occurred! AMLL Player will exit now.");
        error!("Error: {info}");
        error!("{info:#?}");
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!("AMLL Player is starting!");
    #[allow(unused_mut)]
    let mut context = tauri::generate_context!();

    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(not(mobile))]
    let pubkey = {
        if let Some(Value::Object(updater_config)) = context.config().plugins.0.get("updater") {
            if let Some(Value::String(pubkey)) = updater_config.get("pubkey") {
                pubkey.clone()
            } else {
                "".into()
            }
        } else {
            "".into()
        }
    };
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().pubkey(pubkey).build());

    #[cfg(mobile)]
    {
        context
            .config_mut()
            .app
            .windows
            .push(tauri::utils::config::WindowConfig {
                ..Default::default()
            })
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            ws_reopen_connection,
            ws_get_connections,
            ws_broadcast_payload,
            ws_close_connection,
            open_screenshot_window,
            screen_capture::take_screenshot,
            player::local_player_send_msg,
            read_local_music_metadata,
            restart_app,
            #[cfg(target_os = "windows")]
            external_media_controller::control_external_media,
            #[cfg(target_os = "windows")]
            external_media_controller::request_smtc_update,
            reset_window_theme,
        ])
        .setup(|app| {
            info!("正在初始化音频输出流...");
            let (_stream, stream_handle) =
                OutputStream::try_default().expect("无法创建默认的音频输出流");

            app.manage(stream_handle);

            std::mem::forget(_stream);
            info!("音频输出流初始化成功。");

            player::init_local_player(app.handle().clone());

            #[cfg(target_os = "windows")]
            {
                info!("正在初始化外部媒体控制器...");
                let controller_state =
                    external_media_controller::start_listener(app.handle().clone());
                app.manage(controller_state);
            }

            #[cfg(desktop)]
            let _ = app
                .handle()
                .plugin(tauri_plugin_global_shortcut::Builder::new().build());
            app.manage::<AMLLWebSocketServerWrapper>(RwLock::new(AMLLWebSocketServer::new(
                app.handle().clone(),
            )));
            #[cfg(not(mobile))]
            {
                tauri::async_runtime::block_on(recreate_window(app.handle(), "main", None));
            }
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
