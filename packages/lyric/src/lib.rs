#[cfg(feature = "ass")]
pub mod ass;
#[cfg(feature = "eqrc")]
pub mod eqrc;
#[cfg(feature = "eslrc")]
pub mod eslrc;
#[cfg(feature = "lrc")]
pub mod lrc;
#[cfg(feature = "lys")]
pub mod lys;
#[cfg(feature = "qrc")]
pub mod qrc;
#[cfg(feature = "ttml")]
pub mod ttml;
#[cfg(feature = "yrc")]
pub mod yrc;

pub mod utils;
#[cfg(target_arch = "wasm32")]
mod types {
    include!(concat!(env!("OUT_DIR"), "/types.rs"));
}

use std::borrow::Cow;

#[cfg(feature = "serde")]
use serde::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(all(target_arch = "wasm32", feature = "wee_alloc"))]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Debug, Clone, PartialEq, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct LyricWord<'a> {
    pub start_time: u64,
    pub end_time: u64,
    pub word: Cow<'a, str>,
    pub roman_word: Cow<'a, str>,
}

#[derive(Debug, Clone, PartialEq, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct LyricWordOwned {
    pub start_time: u64,
    pub end_time: u64,
    pub word: String,
    pub roman_word: String,
}

impl<'a> From<LyricWord<'a>> for LyricWordOwned {
    fn from(value: LyricWord<'a>) -> Self {
        Self {
            start_time: value.start_time,
            end_time: value.end_time,
            word: value.word.into_owned(),
            roman_word: value.roman_word.into_owned(),
        }
    }
}

impl LyricWord<'_> {
    pub fn to_owned(&self) -> LyricWordOwned {
        LyricWordOwned {
            start_time: self.start_time,
            end_time: self.end_time,
            word: self.word.clone().into_owned(),
            roman_word: self.roman_word.clone().into_owned(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.word.trim().is_empty()
    }
}

impl LyricWordOwned {
    pub fn to_ref<'a>(&'a self) -> LyricWord<'a> {
        LyricWord {
            start_time: self.start_time,
            end_time: self.end_time,
            word: self.word.as_str().into(),
            roman_word: self.roman_word.as_str().into(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.word.trim().is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct LyricLine<'a> {
    pub words: Vec<LyricWord<'a>>,
    #[cfg_attr(feature = "serde", serde(default))]
    pub translated_lyric: Cow<'a, str>,
    #[cfg_attr(feature = "serde", serde(default))]
    pub roman_lyric: Cow<'a, str>,
    #[cfg_attr(feature = "serde", serde(default))]
    pub vocal: Cow<'a, str>,
    #[cfg_attr(feature = "serde", serde(default, rename = "isBG"))]
    pub is_bg: bool,
    #[cfg_attr(feature = "serde", serde(default))]
    pub is_duet: bool,
    #[cfg_attr(feature = "serde", serde(default))]
    pub start_time: u64,
    #[cfg_attr(feature = "serde", serde(default))]
    pub end_time: u64,
}

#[derive(Debug, Clone, PartialEq, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct LyricLineOwned {
    pub words: Vec<LyricWordOwned>,
    pub translated_lyric: String,
    pub roman_lyric: String,
    pub vocal: String,
    pub is_bg: bool,
    pub is_duet: bool,
    pub start_time: u64,
    pub end_time: u64,
}

impl<'a> From<LyricLine<'a>> for LyricLineOwned {
    fn from(value: LyricLine<'a>) -> Self {
        Self {
            words: value.words.iter().map(|w| w.to_owned()).collect(),
            translated_lyric: value.translated_lyric.into_owned(),
            roman_lyric: value.roman_lyric.into_owned(),
            vocal: value.vocal.into_owned(),
            is_bg: value.is_bg,
            is_duet: value.is_duet,
            start_time: value.start_time,
            end_time: value.end_time,
        }
    }
}

impl LyricLine<'_> {
    pub fn to_owned(&self) -> LyricLineOwned {
        LyricLineOwned {
            words: self.words.iter().map(|w| w.to_owned()).collect(),
            translated_lyric: self.translated_lyric.clone().into_owned(),
            roman_lyric: self.roman_lyric.clone().into_owned(),
            vocal: self.vocal.clone().into_owned(),
            is_bg: self.is_bg,
            is_duet: self.is_duet,
            start_time: self.start_time,
            end_time: self.end_time,
        }
    }

    pub fn to_line(&self) -> String {
        self.words
            .iter()
            .map(|x| x.word.to_string())
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn is_empty(&self) -> bool {
        self.words.is_empty() || self.words.iter().all(|x| x.is_empty())
    }
}

impl LyricLineOwned {
    pub fn to_ref<'a>(&'a self) -> LyricLine<'a> {
        LyricLine {
            words: self.words.iter().map(|w| w.to_ref()).collect(),
            translated_lyric: self.translated_lyric.as_str().into(),
            roman_lyric: self.roman_lyric.as_str().into(),
            vocal: self.vocal.as_str().into(),
            is_bg: self.is_bg,
            is_duet: self.is_duet,
            start_time: self.start_time,
            end_time: self.end_time,
        }
    }

    pub fn to_line(&self) -> String {
        self.words
            .iter()
            .map(|x| x.word.to_string())
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn is_empty(&self) -> bool {
        self.words.is_empty() || self.words.iter().all(|x| x.is_empty())
    }
}
