use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};

use serde::Serialize;
use taskbar_lyric::TaskbarService;
use tauri::{Emitter, Manager};
use tracing::warn;
use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{HWND_TOP, SWP_NOZORDER, SetWindowPos},
};

pub mod mouse_forward;
pub mod webview_finder;

#[allow(dead_code)]
pub struct TaskbarLyricWatchers {
    pub uia: Option<taskbar_lyric::UiaWatcher>,
    pub tray: Option<taskbar_lyric::TrayWatcher>,
    pub reg: Option<taskbar_lyric::RegistryWatcher>,
}

#[derive(Default)]
pub struct TaskbarLyricState {
    pub service: Mutex<Option<taskbar_lyric::TaskbarService>>,
    pub watchers: Mutex<Option<TaskbarLyricWatchers>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarLayoutExtraPayload {
    pub is_centered: bool,
    pub system_type: String,
}

#[tauri::command]
pub fn close_taskbar_lyric(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("taskbar-lyric") {
        mouse_forward::stop_mouse_hook();
        if let Some(state) = app.try_state::<TaskbarLyricState>() {
            let _ = state.watchers.lock().unwrap().take();
            let _ = state.service.lock().unwrap().take();
        }
        let _ = win.destroy();
    }
}

#[tauri::command]
pub fn open_taskbar_lyric_devtools(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("taskbar-lyric") {
        win.open_devtools();
    }
}

#[tauri::command]
pub fn open_taskbar_lyric(app: tauri::AppHandle) {
    if app.get_webview_window("taskbar-lyric").is_some() {
        return;
    }

    let app_clone = app.clone();
    let service = TaskbarService::new(move |layout| {
        if let Some(win) = app_clone.get_webview_window("taskbar-lyric") {
            let left = layout.space.left;
            let current_rect = if left.width > 0 {
                left
            } else {
                layout.space.right
            };

            let _ = app_clone.emit(
                "taskbar-layout-extra",
                TaskbarLayoutExtraPayload {
                    is_centered: layout.extra.is_centered,
                    system_type: format!("{:?}", layout.extra.system_type),
                },
            );

            if let Ok(hwnd) = win.hwnd() {
                unsafe {
                    let _ = SetWindowPos(
                        HWND(hwnd.0),
                        Some(HWND_TOP),
                        current_rect.x,
                        current_rect.y,
                        current_rect.width,
                        current_rect.height,
                        SWP_NOZORDER,
                    );
                }
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                    mouse_forward::update_cached_bounds();
                });
            }
        }
    });

    if let Some(state) = app.try_state::<TaskbarLyricState>() {
        *state.service.lock().unwrap() = Some(service);
    }

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        #[cfg(debug_assertions)]
        let url = tauri::WebviewUrl::External(
            app_clone
                .config()
                .build
                .dev_url
                .clone()
                .unwrap()
                .join("taskbar-lyric.html")
                .unwrap(),
        );
        #[cfg(not(debug_assertions))]
        let url = tauri::WebviewUrl::App("taskbar-lyric.html".into());

        let win_builder = tauri::WebviewWindowBuilder::new(&app_clone, "taskbar-lyric", url)
            .decorations(true)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(false)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .visible(true);

        if let Ok(win) = win_builder.build() {
            if let Ok(hwnd) = win.hwnd() {
                let hwnd_ptr = hwnd.0 as usize;
                let top_hwnd = HWND(hwnd.0.cast());

                if let Some(state) = app_clone.try_state::<TaskbarLyricState>()
                    && let Some(srv) = state.service.lock().unwrap().as_ref()
                {
                    srv.embed_window_by_ptr(hwnd_ptr);
                    srv.update(300);
                }

                if let Some(webview_hwnd) = webview_finder::find_webview_hwnd(top_hwnd) {
                    mouse_forward::init_mouse_forwarding_state(top_hwnd, webview_hwnd);
                    mouse_forward::start_mouse_hook_thread();
                } else {
                    warn!("未能找到 WebView 句柄");
                }

                if let Some(state) = app_clone.try_state::<TaskbarLyricState>() {
                    let mut watchers = state.watchers.lock().unwrap();

                    let uia_counter = Arc::new(AtomicUsize::new(0));
                    let win_clone = app_clone.clone();
                    let uia_cb = Box::new(move || {
                        let current = uia_counter.fetch_add(1, Ordering::SeqCst) + 1;
                        let counter_clone = uia_counter.clone();
                        let win_clone_inner = win_clone.clone();

                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                            if counter_clone.load(Ordering::SeqCst) == current
                                && let Some(s) = win_clone_inner.try_state::<TaskbarLyricState>()
                                && let Some(srv) = s.service.lock().unwrap().as_ref()
                            {
                                srv.update(300);
                            }
                        });
                    });

                    let win_clone2 = app_clone.clone();
                    let tray_cb = Box::new(move || {
                        if let Some(s) = win_clone2.try_state::<TaskbarLyricState>()
                            && let Some(srv) = s.service.lock().unwrap().as_ref()
                        {
                            srv.update(300);
                        }
                    });

                    let reg_counter = Arc::new(AtomicUsize::new(0));
                    let win_clone3 = app_clone.clone();
                    let reg_cb = Box::new(move || {
                        let _ = win_clone3.emit("taskbar-lyric:fade-out", ());

                        let current = reg_counter.fetch_add(1, Ordering::SeqCst) + 1;
                        let counter_clone = reg_counter.clone();
                        let win_clone_inner = win_clone3.clone();

                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                            if counter_clone.load(Ordering::SeqCst) == current
                                && let Some(s) = win_clone_inner.try_state::<TaskbarLyricState>()
                                && let Some(srv) = s.service.lock().unwrap().as_ref()
                            {
                                srv.update(300);
                                let _ = win_clone_inner.emit("taskbar-lyric:fade-in", ());
                            }
                        });
                    });

                    *watchers = Some(TaskbarLyricWatchers {
                        uia: taskbar_lyric::UiaWatcher::new(uia_cb).ok(),
                        tray: taskbar_lyric::TrayWatcher::new(tray_cb).ok(),
                        reg: taskbar_lyric::RegistryWatcher::new(reg_cb).ok(),
                    });

                    let _ = win.show();
                }
            } else {
                tracing::warn!("Failed to get hwnd for taskbar-lyric window");
            }
        } else {
            tracing::warn!("Failed to build taskbar-lyric window");
        }
    });
}
