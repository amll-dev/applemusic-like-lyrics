use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
};

use anyhow::{Result, anyhow};
use tauri::{AppHandle, Emitter};
use tracing::error;
use windows::{
    Win32::{
        Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0},
        System::{
            Registry::{
                HKEY, HKEY_CURRENT_USER, KEY_NOTIFY, KEY_READ, REG_DWORD,
                REG_NOTIFY_CHANGE_LAST_SET, REG_SAM_FLAGS, RegCloseKey, RegNotifyChangeKeyValue,
                RegOpenKeyExW, RegQueryValueExW,
            },
            Threading::{CreateEventW, INFINITE, SetEvent, WaitForMultipleObjects},
        },
    },
    core::w,
};

const PERSONALIZE_SUB_KEY: windows::core::PCWSTR =
    w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");

const VALUE_NAME: windows::core::PCWSTR = w!("SystemUsesLightTheme");

pub const EVENT_NAME: &str = "system-theme-changed";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemePayload {
    pub is_light_theme: bool,
}

struct EventHandle(HANDLE);
impl Drop for EventHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

unsafe impl Send for EventHandle {}
unsafe impl Sync for EventHandle {}

pub struct ThemeWatcher {
    stop_event: Arc<EventHandle>,
    is_running: Arc<AtomicBool>,
}

impl ThemeWatcher {
    pub fn new(app: AppHandle) -> Result<Self> {
        let raw_event = unsafe { CreateEventW(None, true, false, None) }
            .map_err(|e| anyhow!("创建停止事件失败: {e}"))?;

        let stop_event = Arc::new(EventHandle(raw_event));
        let is_running = Arc::new(AtomicBool::new(true));
        let thread_event = stop_event.clone();

        thread::spawn(move || unsafe {
            Self::watch_loop(&thread_event, &app);
        });

        Ok(Self {
            stop_event,
            is_running,
        })
    }

    pub fn stop(&self) {
        if !self.is_running.load(Ordering::SeqCst) {
            return;
        }
        unsafe {
            let _ = SetEvent(self.stop_event.0);
        }
        self.is_running.store(false, Ordering::SeqCst);
    }

    fn read_light_theme_value(h_key: HKEY) -> Option<bool> {
        let mut data: u32 = 0;
        let mut data_size: u32 = std::mem::size_of::<u32>() as u32;
        let mut reg_type = REG_DWORD;

        let result = unsafe {
            RegQueryValueExW(
                h_key,
                VALUE_NAME,
                None,
                Some(&raw mut reg_type),
                Some((&raw mut data).cast::<u8>()),
                Some(&raw mut data_size),
            )
        };

        if result.is_ok() {
            Some(data != 0)
        } else {
            error!("读取 SystemUsesLightTheme 失败: {result:?}");
            None
        }
    }

    unsafe fn watch_loop(stop_event_wrapper: &Arc<EventHandle>, app: &AppHandle) {
        let stop_event = stop_event_wrapper.0;

        let h_key = match Self::open_personalize_key(KEY_READ | KEY_NOTIFY) {
            Some(k) => k,
            None => {
                error!("打开注册表键失败");
                return;
            }
        };

        if let Some(is_light) = Self::read_light_theme_value(h_key) {
            let _ = app.emit(
                EVENT_NAME,
                ThemePayload {
                    is_light_theme: is_light,
                },
            );
        }

        unsafe {
            let reg_event = match CreateEventW(None, false, false, None) {
                Ok(evt) => evt,
                Err(e) => {
                    error!("创建注册表事件失败: {e}");
                    let _ = RegCloseKey(h_key);
                    return;
                }
            };

            loop {
                let notify_res = RegNotifyChangeKeyValue(
                    h_key,
                    true,
                    REG_NOTIFY_CHANGE_LAST_SET,
                    Some(reg_event),
                    true,
                );

                if notify_res.is_err() {
                    error!("注册通知失败");
                    break;
                }

                let handles = [stop_event, reg_event];
                let wait_result = WaitForMultipleObjects(&handles, false, INFINITE);
                let index = wait_result.0.wrapping_sub(WAIT_OBJECT_0.0);

                match index {
                    0 => {
                        break;
                    }
                    1 => {
                        if let Some(is_light) = Self::read_light_theme_value(h_key) {
                            let _ = app.emit(
                                EVENT_NAME,
                                ThemePayload {
                                    is_light_theme: is_light,
                                },
                            );
                        }
                    }
                    _ => {
                        error!("WaitForMultipleObjects 返回异常或超时: {wait_result:?}");
                        break;
                    }
                }
            }

            let _ = CloseHandle(reg_event);
            let _ = RegCloseKey(h_key);
        }
    }

    fn open_personalize_key(access_mask: REG_SAM_FLAGS) -> Option<HKEY> {
        let mut h_key = HKEY::default();
        let result = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PERSONALIZE_SUB_KEY,
                Some(0),
                access_mask,
                &raw mut h_key,
            )
        };

        if result.is_ok() { Some(h_key) } else { None }
    }
}

impl Drop for ThemeWatcher {
    fn drop(&mut self) {
        self.stop();
    }
}

#[tauri::command]
pub fn get_system_theme() -> Result<ThemePayload, String> {
    let mut is_light = true;

    if let Some(h_key) = ThemeWatcher::open_personalize_key(KEY_READ) {
        if let Some(light) = ThemeWatcher::read_light_theme_value(h_key) {
            is_light = light;
        }
        unsafe {
            let _ = RegCloseKey(h_key);
        }
    }

    Ok(ThemePayload {
        is_light_theme: is_light,
    })
}
