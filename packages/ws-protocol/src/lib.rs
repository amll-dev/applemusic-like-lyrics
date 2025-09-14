use std::io::Cursor;

use binrw::prelude::*;
use serde::{Deserialize, Serialize};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use strings::NullString;

mod strings;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(all(target_arch = "wasm32", feature = "wee_alloc"))]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: NullString,
    pub name: NullString,
}

#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LyricWord {
    pub start_time: u64,
    pub end_time: u64,
    pub word: NullString,
    #[brw(ignore)]
    #[serde(default)]
    pub roman_word: NullString,
}

#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub start_time: u64,
    pub end_time: u64,
    #[bw(try_calc = u32::try_from(words.len()))]
    size: u32,
    #[br(count = size)]
    pub words: Vec<LyricWord>,
    #[serde(default)]
    pub translated_lyric: NullString,
    #[serde(default)]
    pub roman_lyric: NullString,
    #[serde(skip)]
    #[bw(calc = *is_bg as u8 | ((*is_duet as u8) << 1))]
    flag: u8,
    #[serde(default, rename = "isBG")]
    #[br(calc = flag & 0b01 != 0)]
    #[bw(ignore)]
    pub is_bg: bool,
    #[serde(default)]
    #[br(calc = flag & 0b10 != 0)]
    #[bw(ignore)]
    pub is_duet: bool,
}

/// 信息主体
#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "type", content = "value")]
pub enum Body {
    // 心跳信息
    #[brw(magic(0u16))]
    Ping,
    #[brw(magic(1u16))]
    Pong,
    // 可从发送方发送给接收方的指令，用于同步播放进度和内容
    #[serde(rename_all = "camelCase")]
    #[brw(magic(2u16))]
    SetMusicInfo {
        music_id: NullString,
        music_name: NullString,
        album_id: NullString,
        album_name: NullString,
        #[bw(try_calc = u32::try_from(artists.len()))]
        artists_size: u32,
        #[br(count = artists_size)]
        artists: Vec<Artist>,
        duration: u64,
    },
    #[serde(rename_all = "camelCase")]
    #[brw(magic(3u16))]
    SetMusicAlbumCoverImageURI { img_url: NullString },
    #[brw(magic(4u16))]
    SetMusicAlbumCoverImageData {
        #[bw(try_calc = u32::try_from(data.len()))]
        size: u32,
        #[br(count = size)]
        #[serde(with = "serde_bytes")]
        data: Vec<u8>,
    },
    #[brw(magic(5u16))]
    OnPlayProgress { progress: u64 },
    #[brw(magic(6u16))]
    OnVolumeChanged { volume: f64 },
    #[brw(magic(7u16))]
    OnPaused,
    #[brw(magic(8u16))]
    OnResumed,
    #[brw(magic(9u16))]
    OnAudioData {
        #[bw(try_calc = u32::try_from(data.len()))]
        size: u32,
        #[br(count = size)]
        #[serde(with = "serde_bytes")]
        data: Vec<u8>,
    },
    #[brw(magic(10u16))]
    SetLyric {
        #[bw(try_calc = u32::try_from(data.len()))]
        size: u32,
        #[br(count = size)]
        data: Vec<LyricLine>,
    },
    #[brw(magic(11u16))]
    SetLyricFromTTML { data: NullString },
    // 可从接收方发送给发送方的指令，用于控制播放内容进度
    #[brw(magic(12u16))]
    Pause,
    #[brw(magic(13u16))]
    Resume,
    #[brw(magic(14u16))]
    ForwardSong,
    #[brw(magic(15u16))]
    BackwardSong,
    #[brw(magic(16u16))]
    SetVolume { volume: f64 },
    #[brw(magic(17u16))]
    SeekPlayProgress { progress: u64 },
}

#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "type", content = "value")]
pub enum JsonBody {
    InitializeV2,
    Ping,
    Pong,
    #[serde(rename_all = "camelCase")]
    SetMusicInfo {
        music_id: String,
        music_name: String,
        album_id: String,
        album_name: String,
        artists: Vec<Artist>,
        duration: u64,
    },
    #[serde(rename_all = "camelCase")]
    SetMusicAlbumCoverImageURI {
        img_url: String,
    },
    OnPlayProgress {
        progress: u64,
    },
    OnVolumeChanged {
        volume: f64,
    },
    OnPaused,
    OnResumed,
    SetLyric {
        data: Vec<LyricLine>,
    },
    SetLyricFromTTML {
        data: String,
    },
    Pause,
    Resume,
    ForwardSong,
    BackwardSong,
    SetVolume {
        volume: f64,
    },
    SeekPlayProgress {
        progress: u64,
    },
}

pub fn parse_body(body: &[u8]) -> anyhow::Result<Body> {
    Ok(Body::read(&mut Cursor::new(body))?)
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = "parseBody")]
pub fn parse_body_js(body: &[u8]) -> Result<JsValue, String> {
    match parse_body(body) {
        Ok(body) => match serde_wasm_bindgen::to_value(&body) {
            Ok(body) => Ok(body),
            Err(err) => Err(err.to_string()),
        },
        Err(err) => Err(err.to_string()),
    }
}

pub fn to_body(body: &Body) -> anyhow::Result<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::with_capacity(4096));
    body.write(&mut cursor)?;
    Ok(cursor.into_inner())
}

#[test]
fn body_test() {
    let body = Body::SetMusicInfo {
        music_id: "1".into(),
        music_name: "2".into(),
        album_id: "3".into(),
        album_name: "4".into(),
        artists: vec![Artist {
            id: "5".into(),
            name: "6".into(),
        }],
        duration: 7,
    };
    let encoded = to_body(&body).unwrap();
    // print hex
    print!("[");
    for byte in &encoded {
        print!("0x{:02x}, ", byte);
    }
    println!("]");
    assert_eq!(parse_body(&encoded).unwrap(), body);
    println!("{}", serde_json::to_string_pretty(&body).unwrap());
    let body = Body::SetMusicAlbumCoverImageURI {
        img_url: "https://example.com".into(),
    };
    assert_eq!(parse_body(&to_body(&body).unwrap()).unwrap(), body);
    println!("{}", serde_json::to_string_pretty(&body).unwrap());
    let body = Body::Ping;
    assert_eq!(parse_body(&to_body(&body).unwrap()).unwrap(), body);
    println!("{}", serde_json::to_string_pretty(&body).unwrap());
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = "toBody")]
pub fn to_body_js(body: JsValue) -> Result<Box<[u8]>, String> {
    match serde_wasm_bindgen::from_value(body) {
        Ok(body) => match to_body(&body) {
            Ok(data) => Ok(data.into_boxed_slice()),
            Err(err) => Err(err.to_string()),
        },
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
/// When the `console_error_panic_hook` feature is enabled, we can call the
/// `set_panic_hook` function at least once during initialization, and then
/// we will get better error messages if our code ever panics.
///
/// For more details see
/// https://github.com/rustwasm/console_error_panic_hook#readme
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
