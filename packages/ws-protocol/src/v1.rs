use super::common::{Artist, LyricLine, NullString};
use binrw::{BinRead, BinWrite, binrw};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

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

#[cfg(test)]
mod tests {
    use super::*;

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
            print!("0x{byte:02x}, ");
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
}
