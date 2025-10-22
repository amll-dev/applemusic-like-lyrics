use ffmpeg_next as ffmpeg;
use serde::*;

#[derive(Serialize, Deserialize, PartialEq, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioQuality {
    pub sample_rate: Option<u32>,
    pub bits_per_coded_sample: Option<u32>,
    pub bits_per_sample: Option<u32>,
    pub channels: Option<u32>,
    pub sample_format: String,
    pub codec: String,
}

impl AudioQuality {
    pub fn from_ffmpeg_decoder(decoder: &ffmpeg::decoder::Audio) -> Self {
        let sample_format_str = match decoder.format() {
            ffmpeg::format::Sample::U8(_) => "u8",
            ffmpeg::format::Sample::I16(_) => "i16",
            ffmpeg::format::Sample::I32(_) => "i32",
            ffmpeg::format::Sample::I64(_) => "i64",
            ffmpeg::format::Sample::F32(_) => "f32",
            ffmpeg::format::Sample::F64(_) => "f64",
            _ => "unknown",
        };

        let bits_per_sample = match decoder.format() {
            ffmpeg::format::Sample::U8(_) => Some(8),
            ffmpeg::format::Sample::I16(_) => Some(16),
            ffmpeg::format::Sample::I32(_) => Some(32),
            ffmpeg::format::Sample::I64(_) => Some(64),
            ffmpeg::format::Sample::F32(_) => Some(32),
            ffmpeg::format::Sample::F64(_) => Some(64),
            _ => None,
        };

        Self {
            sample_rate: Some(decoder.rate()),
            bits_per_coded_sample: None,
            bits_per_sample,
            channels: Some(decoder.channels() as u32),
            codec: decoder
                .codec()
                .map(|c| c.name().to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            sample_format: sample_format_str.to_string(),
        }
    }
}
