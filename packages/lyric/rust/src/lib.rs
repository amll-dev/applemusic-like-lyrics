#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

mod eqrc;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = "decryptQrcHex")]
pub fn decrypt_qrc_hex_js(hex_data: &str) -> String {
    eqrc::decrypt_qrc_hex(hex_data)
}
