//! 一个来自 Foobar2000 的 ESLyric 插件特有的逐词歌词文件格式，后缀名仍为 `.lrc`
//!
//! 在 LyRiC 文件格式的基础上，每行歌词的单词使用和开头一样的时间戳格式代表每个单词的结束时间。
//! 且似乎不允许重复定义时间戳，即每行歌词只能有一个时间戳。
//!
//! 例子：
//!
//! ```text
//! [00:10.82]Test[00:10.97] Word[00:12.62]
//! ```
//!

use nom::{IResult, bytes::complete::take_until1};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use crate::{LyricLine, utils::process_lyrics};

pub fn parse_line(src: &str) -> IResult<&str, LyricLine<'_>> {
    let (mut src, mut start_time) = crate::lrc::parse_time(src)?;
    let mut result = LyricLine::default();
    while !src.trim().is_empty() {
        let (s, word) = take_until1("[")(src)?;
        let (s, end_time) = crate::lrc::parse_time(s)?;
        result.words.push(crate::LyricWord {
            start_time,
            end_time,
            word: word.into(),
        });
        src = s;
        start_time = end_time;
    }
    Ok((src, result))
}

pub fn parse_eslrc(src: &str) -> Vec<LyricLine> {
    let lines = src.lines();
    let mut result = Vec::with_capacity(lines.size_hint().1.unwrap_or(1024).min(1024));

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(line) = parse_line(line.trim()) {
            result.push(line.1);
        }
    }

    process_lyrics(&mut result);

    result
}

pub fn stringify_eslrc(lines: &[LyricLine]) -> String {
    let capacity: usize = lines
        .iter()
        .map(|x| x.words.iter().map(|y| y.word.len()).sum::<usize>() + 13)
        .sum();
    let mut result = String::with_capacity(capacity);

    for line in lines {
        if !line.words.is_empty() {
            crate::lrc::write_timestamp(&mut result, line.words[0].start_time);
            for word in line.words.iter() {
                result.push_str(&word.word);
                crate::lrc::write_timestamp(&mut result, word.end_time);
            }
            result.push('\n');
        }
    }

    result
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "parseEslrc", skip_typescript)]
pub fn parse_eslrc_js(src: &str) -> wasm_bindgen::JsValue {
    serde_wasm_bindgen::to_value(&parse_eslrc(src)).unwrap()
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "stringifyEslrc", skip_typescript)]
pub fn stringify_eslrc_js(lrc: wasm_bindgen::JsValue) -> String {
    let lines: Vec<LyricLine> = serde_wasm_bindgen::from_value(lrc).unwrap();
    stringify_eslrc(&lines)
}
