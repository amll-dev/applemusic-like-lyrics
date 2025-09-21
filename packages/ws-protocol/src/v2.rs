use std::io::Cursor;

use binrw::{BinRead, BinWrite, binrw};
use serde::{Deserialize, Serialize};
use serde_with::serde_as;

use super::common::{Artist, LyricLine};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

/// 顶层消息
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageV2 {
    #[serde(flatten)]
    pub payload: Payload,
}

/// 消息的主体，用于区分消息类型
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "type", content = "value")]
pub enum Payload {
    Initialize,
    Ping,
    Pong,
    Command(Command),
    State(StateUpdate),
}

#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    All,
    One,
}

/// 从 Player 发送到播放器的指令
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "command")]
pub enum Command {
    Pause,
    Resume,
    ForwardSong,
    BackwardSong,
    SetVolume { volume: f64 },
    SeekPlayProgress { progress: u64 },
    SetRepeatMode { mode: RepeatMode },
    SetShuffleMode { enabled: bool },
}

/// 从播放器发送到 Player 的更新
#[derive(Deserialize, Serialize, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "update")]
pub enum StateUpdate {
    SetMusic(MusicInfo),
    SetCover(AlbumCover),
    SetLyric(LyricContent),
    Progress {
        progress: u64,
    },
    Volume {
        volume: f64,
    },
    Paused,
    Resumed,
    AudioData {
        #[serde(with = "serde_bytes")]
        data: Vec<u8>,
    },
    ModeChanged {
        repeat: RepeatMode,
        shuffle: bool,
    },
}

// --- 数据结构 ---

#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MusicInfo {
    pub music_id: String,
    pub music_name: String,
    pub album_id: String,
    pub album_name: String,
    pub artists: Vec<Artist>,
    pub duration: u64,
}

#[serde_as]
#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageData {
    pub mime_type: Option<String>,
    #[serde_as(as = "serde_with::base64::Base64")]
    pub data: Vec<u8>,
}

#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "source")]
pub enum AlbumCover {
    Uri { url: String },
    Data { image: ImageData },
}

#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone)]
#[serde(rename_all = "camelCase", tag = "format")]
pub enum LyricContent {
    Structured { lines: Vec<LyricLine> },
    Ttml { data: String },
}

/// 通过二进制通道传输的负载，可用于降低通过互联网传输数据的延迟。
///
/// 不建议在本地环境中使用它们
#[binrw]
#[brw(little)]
#[derive(PartialEq, Eq, Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "value")]
pub enum BinaryV2 {
    #[brw(magic(0u16))]
    OnAudioData {
        #[bw(try_calc = u32::try_from(data.len()))]
        size: u32,
        #[br(count = size)]
        #[serde(with = "serde_bytes")]
        data: Vec<u8>,
    },
    #[brw(magic(1u16))]
    SetCoverData {
        #[bw(try_calc = u32::try_from(data.len()))]
        size: u32,
        #[br(count = size)]
        #[serde(with = "serde_bytes")]
        data: Vec<u8>,
    },
}

pub fn parse_binary_v2(data: &[u8]) -> anyhow::Result<BinaryV2> {
    Ok(BinaryV2::read(&mut Cursor::new(data))?)
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = "parseBinaryV2")]
pub fn parse_binary_v2_js(data: &[u8]) -> Result<JsValue, JsValue> {
    match parse_binary_v2(data) {
        Ok(binary_v2) => match serde_wasm_bindgen::to_value(&binary_v2) {
            Ok(js_value) => Ok(js_value),
            Err(err) => Err(err.into()),
        },
        Err(err) => Err(js_sys::Error::new(&err.to_string()).into()),
    }
}

pub fn to_binary_v2(payload: &BinaryV2) -> anyhow::Result<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::with_capacity(4096));
    payload.write(&mut cursor)?;
    Ok(cursor.into_inner())
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = "toBinaryV2")]
pub fn to_binary_v2_js(payload: JsValue) -> Result<Box<[u8]>, JsValue> {
    match serde_wasm_bindgen::from_value(payload) {
        Ok(binary_v2) => match to_binary_v2(&binary_v2) {
            Ok(data) => Ok(data.into_boxed_slice()),
            Err(err) => Err(js_sys::Error::new(&err.to_string()).into()),
        },
        Err(err) => Err(err.into()),
    }
}
