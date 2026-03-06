use tracing::warn;
use windows::{
    Win32::{
        Foundation::{HWND, LPARAM},
        UI::WindowsAndMessaging::{EnumChildWindows, GetClassNameW},
    },
    core::BOOL,
};

pub fn find_webview_hwnd(parent_hwnd: HWND) -> Option<HWND> {
    if parent_hwnd.0.is_null() {
        warn!("传入的父窗口句柄为空");
        return None;
    }

    let mut target_hwnd = HWND::default();

    unsafe {
        let lparam = LPARAM(&mut target_hwnd as *mut _ as isize);
        let _ = EnumChildWindows(Some(parent_hwnd), Some(enum_child_proc), lparam);
    }

    if target_hwnd.0.is_null() {
        warn!("未找到 Chrome_RenderWidgetHostHWND");
        None
    } else {
        Some(target_hwnd)
    }
}

unsafe extern "system" fn enum_child_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let mut class_name_buffer = [0u16; 256];

    let len = unsafe { GetClassNameW(hwnd, &mut class_name_buffer) };
    if len > 0 {
        let class_name = String::from_utf16_lossy(&class_name_buffer[..len as usize]);

        if class_name == "Chrome_RenderWidgetHostHWND" {
            let target_ptr = lparam.0 as *mut HWND;
            unsafe { *target_ptr = hwnd };

            return BOOL(0);
        }
    }

    BOOL(1)
}
