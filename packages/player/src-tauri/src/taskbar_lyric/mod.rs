use std::sync::Mutex;

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

pub struct TaskbarLyricState {
    pub service: std::sync::Mutex<Option<taskbar_lyric::TaskbarService>>,
    pub watchers: std::sync::Mutex<Option<TaskbarLyricWatchers>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarLayoutExtraPayload {
    pub is_centered: bool,
    pub system_type: String,
}

pub fn init_taskbar_lyric(app: &tauri::AppHandle) {
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
                mouse_forward::update_cached_bounds();
            }
        }
    });

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

                if let Some(webview_hwnd) = webview_finder::find_webview_hwnd(top_hwnd) {
                    mouse_forward::init_mouse_forwarding_state(top_hwnd, webview_hwnd);
                    mouse_forward::start_mouse_hook_thread();
                } else {
                    warn!("未能找到 WebView 句柄");
                }

                if let Some(state) = app_clone.try_state::<TaskbarLyricState>()
                    && let Some(srv) = state.service.lock().unwrap().as_ref()
                {
                    srv.embed_window_by_ptr(hwnd_ptr);
                    srv.update(300);
                }

                if let Some(state) = app_clone.try_state::<TaskbarLyricState>() {
                    let mut watchers = state.watchers.lock().unwrap();

                    let win_clone = app_clone.clone();
                    let uia_cb = Box::new(move || {
                        if let Some(s) = win_clone.try_state::<TaskbarLyricState>()
                            && let Some(srv) = s.service.lock().unwrap().as_ref()
                        {
                            srv.update(300);
                        }
                    });

                    let win_clone2 = app_clone.clone();
                    let tray_cb = Box::new(move || {
                        if let Some(s) = win_clone2.try_state::<TaskbarLyricState>()
                            && let Some(srv) = s.service.lock().unwrap().as_ref()
                        {
                            srv.update(300);
                        }
                    });

                    let win_clone3 = app_clone.clone();
                    let reg_cb = Box::new(move || {
                        if let Some(s) = win_clone3.try_state::<TaskbarLyricState>()
                            && let Some(srv) = s.service.lock().unwrap().as_ref()
                        {
                            srv.update(300);
                        }
                    });

                    *watchers = Some(TaskbarLyricWatchers {
                        uia: taskbar_lyric::UiaWatcher::new(uia_cb).ok(),
                        tray: taskbar_lyric::TrayWatcher::new(tray_cb).ok(),
                        reg: taskbar_lyric::RegistryWatcher::new(reg_cb).ok(),
                    });

                    let _ = win.show();

                    // #[cfg(debug_assertions)]
                    // win.open_devtools();
                }
            } else {
                tracing::warn!("Failed to get hwnd for taskbar-lyric window");
            }
        } else {
            tracing::warn!("Failed to build taskbar-lyric window");
        }
    });

    app.manage::<TaskbarLyricState>(TaskbarLyricState {
        service: Mutex::new(Some(service)),
        watchers: Mutex::new(None),
    });
}
