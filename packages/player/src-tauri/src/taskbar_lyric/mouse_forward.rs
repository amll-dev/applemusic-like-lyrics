use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};

use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
    Graphics::Gdi::ClientToScreen,
    System::Threading::GetCurrentThreadId,
    UI::{
        Controls::WM_MOUSELEAVE,
        WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, GetClientRect, GetMessageW, HHOOK, MSLLHOOKSTRUCT,
            PostMessageW, PostThreadMessageW, SetWindowsHookExW, TranslateMessage,
            UnhookWindowsHookEx, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEMOVE, WM_QUIT,
            WM_RBUTTONDOWN, WM_RBUTTONUP,
        },
    },
};

static TOP_HWND: AtomicIsize = AtomicIsize::new(0);
static WEBVIEW_HWND: AtomicIsize = AtomicIsize::new(0);
static IS_FORWARDING: AtomicBool = AtomicBool::new(false);
static MOUSE_HOOK: AtomicIsize = AtomicIsize::new(0);
static INTERCEPT_CLICKS: AtomicBool = AtomicBool::new(false);
static WAS_INSIDE: AtomicBool = AtomicBool::new(false);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);

static WEBVIEW_LEFT: AtomicIsize = AtomicIsize::new(0);
static WEBVIEW_RIGHT: AtomicIsize = AtomicIsize::new(0);
static WEBVIEW_TOP: AtomicIsize = AtomicIsize::new(0);
static WEBVIEW_BOTTOM: AtomicIsize = AtomicIsize::new(0);

fn make_lparam(x: i32, y: i32) -> LPARAM {
    LPARAM(((y as u16 as u32) << 16 | (x as u16 as u32)) as isize)
}

#[tauri::command]
pub fn set_click_interception(intercept: bool) {
    INTERCEPT_CLICKS.store(intercept, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_forwarding_enabled(enabled: bool) {
    IS_FORWARDING.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn stop_mouse_hook() {
    IS_FORWARDING.store(false, Ordering::Relaxed);
    let thread_id = HOOK_THREAD_ID.swap(0, Ordering::Relaxed);

    if thread_id != 0 {
        unsafe {
            let _ = PostThreadMessageW(thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    } else {
        tracing::warn!("鼠标钩子线程未运行或已停止");
    }
}

pub fn update_cached_bounds() {
    let webview_ptr = WEBVIEW_HWND.load(Ordering::Relaxed);
    if webview_ptr == 0 {
        return;
    }

    let webview_hwnd = HWND(webview_ptr as _);
    let mut client_rect = RECT::default();

    unsafe {
        if GetClientRect(webview_hwnd, &mut client_rect).is_ok() {
            let mut top_left = POINT {
                x: client_rect.left,
                y: client_rect.top,
            };
            let mut bottom_right = POINT {
                x: client_rect.right,
                y: client_rect.bottom,
            };

            let _ = ClientToScreen(webview_hwnd, &mut top_left);
            let _ = ClientToScreen(webview_hwnd, &mut bottom_right);

            WEBVIEW_LEFT.store(top_left.x as isize, Ordering::Relaxed);
            WEBVIEW_RIGHT.store(bottom_right.x as isize, Ordering::Relaxed);
            WEBVIEW_TOP.store(top_left.y as isize, Ordering::Relaxed);
            WEBVIEW_BOTTOM.store(bottom_right.y as isize, Ordering::Relaxed);
        }
    }
}

pub fn init_mouse_forwarding_state(top_hwnd: HWND, webview_hwnd: HWND) {
    TOP_HWND.store(top_hwnd.0 as isize, Ordering::Relaxed);
    WEBVIEW_HWND.store(webview_hwnd.0 as isize, Ordering::Relaxed);
    IS_FORWARDING.store(true, Ordering::Relaxed);

    update_cached_bounds();
}

pub fn start_mouse_hook_thread() {
    std::thread::spawn(|| unsafe {
        let thread_id = GetCurrentThreadId();
        HOOK_THREAD_ID.store(thread_id, Ordering::Relaxed);

        let hook = match SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0) {
            Ok(h) => h,
            Err(e) => {
                tracing::error!("无法设置鼠标全局钩子: {e:?}");
                HOOK_THREAD_ID.store(0, Ordering::Relaxed);
                return;
            }
        };

        MOUSE_HOOK.store(hook.0 as isize, Ordering::SeqCst);

        let mut msg = windows::Win32::UI::WindowsAndMessaging::MSG::default();

        loop {
            let ret = GetMessageW(&mut msg, Some(HWND::default()), 0, 0);
            if ret.0 == 0 || ret.0 == -1 {
                break;
            }
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        let hook_ptr = MOUSE_HOOK.swap(0, Ordering::SeqCst);
        if hook_ptr != 0 {
            let _ = UnhookWindowsHookEx(HHOOK(hook_ptr as *mut _));
        }

        HOOK_THREAD_ID.store(0, Ordering::Relaxed);
    });
}

unsafe extern "system" fn mouse_hook_proc(n_code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if n_code >= 0 && IS_FORWARDING.load(Ordering::Relaxed) {
        let webview_ptr = WEBVIEW_HWND.load(Ordering::Relaxed);

        if webview_ptr != 0 {
            let webview_hwnd = HWND(webview_ptr as _);
            let hook_struct = unsafe { &*(lparam.0 as *const MSLLHOOKSTRUCT) };
            let pt = hook_struct.pt;

            let left = WEBVIEW_LEFT.load(Ordering::Relaxed) as i32;
            let right = WEBVIEW_RIGHT.load(Ordering::Relaxed) as i32;
            let top = WEBVIEW_TOP.load(Ordering::Relaxed) as i32;
            let bottom = WEBVIEW_BOTTOM.load(Ordering::Relaxed) as i32;

            let padding = 5;

            let is_inside_padded = pt.x >= (left - padding)
                && pt.x <= (right + padding)
                && pt.y >= (top - padding)
                && pt.y <= (bottom + padding);

            let is_inside_actual = pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom;

            let was_inside = WAS_INSIDE.load(Ordering::Relaxed);

            if is_inside_padded {
                let msg_id = wparam.0 as u32;

                if is_inside_actual {
                    let client_x = pt.x - left;
                    let client_y = pt.y - top;

                    let client_lparam = make_lparam(client_x, client_y);

                    let _ = unsafe {
                        PostMessageW(Some(webview_hwnd), msg_id, WPARAM(0), client_lparam)
                    };
                }

                let is_click_msg = msg_id == WM_LBUTTONDOWN
                    || msg_id == WM_LBUTTONUP
                    || msg_id == WM_RBUTTONDOWN
                    || msg_id == WM_RBUTTONUP;

                if is_click_msg && INTERCEPT_CLICKS.load(Ordering::Relaxed) {
                    return LRESULT(1);
                }

                if !was_inside {
                    WAS_INSIDE.store(true, Ordering::Relaxed);
                }
            } else {
                if was_inside {
                    let out_of_bounds_lparam = make_lparam(-1, -1);

                    let _ = unsafe {
                        PostMessageW(
                            Some(webview_hwnd),
                            WM_MOUSEMOVE,
                            WPARAM(0),
                            out_of_bounds_lparam,
                        )
                    };

                    let _ = unsafe {
                        PostMessageW(Some(webview_hwnd), WM_MOUSELEAVE, WPARAM(0), LPARAM(0))
                    };

                    WAS_INSIDE.store(false, Ordering::Relaxed);
                    INTERCEPT_CLICKS.store(false, Ordering::Relaxed);
                }
            }
        }
    }

    unsafe { CallNextHookEx(None, n_code, wparam, lparam) }
}
