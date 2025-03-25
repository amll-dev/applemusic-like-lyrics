#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use crate::{LyricLine, LyricWord, utils::process_lyrics};

use std::fmt::Write;
use std::{borrow::Cow, str::FromStr};

use nom::{IResult, character::complete::line_ending};
use nom::{bytes::complete::*, combinator::opt, multi::many0, sequence::pair};

fn process_time<'a>(
    src: &'a str,
    start_time: &'a str,
    duration: &'a str,
) -> IResult<&'a str, (u64, u64)> {
    let start_time = u64::from_str(start_time);
    if start_time.is_err() {
        return Err(nom::Err::Error(nom::error::Error {
            input: src,
            code: nom::error::ErrorKind::Digit,
        }));
    }
    let start_time = start_time.unwrap();
    let duration = u64::from_str(duration);
    if duration.is_err() {
        return Err(nom::Err::Error(nom::error::Error {
            input: src,
            code: nom::error::ErrorKind::Digit,
        }));
    }
    let duration = duration.unwrap();

    Ok((src, (start_time, duration)))
}

pub fn parse_time(src: &str) -> IResult<&str, (u64, u64)> {
    let (src, _) = tag("[")(src)?;
    let (src, start_time) = nom::character::complete::digit1(src)?;
    let (src, _) = tag(",")(src)?;
    let (src, duration) = nom::character::complete::digit1(src)?;
    let (src, _) = tag("]")(src)?;

    process_time(src, start_time, duration)
}

pub fn parse_word_time(src: &str) -> IResult<&str, (u64, u64)> {
    let (src, _) = tag("(")(src)?;
    let (src, start_time) = take_until1(",")(src)?;
    let (src, _) = tag(",")(src)?;
    let (src, duration) = take_until1(",")(src)?;
    let (src, _) = tag(",0)")(src)?;

    process_time(src, start_time, duration)
}

pub fn parse_words(src: &str) -> IResult<&str, Vec<LyricWord<'_>>> {
    let (src, words) = many0(pair(
        parse_word_time,
        take_till(|x| x == '(' || x == '\n' || x == '\r'),
    ))(src)?;
    let words = words
        .into_iter()
        .map(|x| LyricWord {
            start_time: x.0.0,
            end_time: x.0.0 + x.0.1,
            word: Cow::Borrowed(x.1),
        })
        .collect();
    Ok((src, words))
}

pub fn parse_line(src: &str) -> IResult<&str, LyricLine<'_>> {
    let (src, _) = parse_time(src)?;
    match is_not("\r\n")(src) {
        Ok((src, line)) => {
            let (src, _) = opt(line_ending)(src)?;
            let (_, words) = parse_words(line)?;
            Ok((
                src,
                LyricLine {
                    words,
                    ..Default::default()
                },
            ))
        }
        Err(nom::Err::Error(nom::error::Error {
            code: nom::error::ErrorKind::IsNot,
            ..
        })) => {
            let (src, words) = parse_words(src)?;
            Ok((
                src,
                LyricLine {
                    words,
                    ..Default::default()
                },
            ))
        }
        Err(e) => Err(e),
    }
}

pub fn parse_yrc(src: &str) -> Vec<LyricLine> {
    let lines = src.lines();
    let mut result = Vec::with_capacity(lines.size_hint().1.unwrap_or(1024).min(1024));

    for line in lines {
        if let Ok((_, line)) = parse_line(line) {
            result.push(line);
        }
    }

    process_lyrics(&mut result);

    result
}

pub fn stringify_yrc(lines: &[LyricLine]) -> String {
    let capacity: usize = lines
        .iter()
        .map(|x| x.words.iter().map(|y| y.word.len()).sum::<usize>() + 32)
        .sum();
    let mut result = String::with_capacity(capacity);

    for line in lines {
        if !line.words.is_empty() {
            let start_time = line.words[0].start_time;
            let duration: u64 = line.words.iter().map(|x| x.end_time - x.start_time).sum();
            write!(result, "[{start_time},{duration}]").unwrap();
            for word in line.words.iter() {
                let start_time = word.start_time;
                let duration = word.end_time - word.start_time;
                write!(result, "({start_time},{duration},0)").unwrap();
                for c in word.word.chars() {
                    // 目前已知 YRC 不允许直接出现英文括号，所以要换成中文括号
                    if c == '(' {
                        result.push('（');
                    } else if c == ')' {
                        result.push('）');
                    } else {
                        result.push(c);
                    }
                }
            }
            result.push('\n');
        }
    }

    result
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "parseYrc", skip_typescript)]
pub fn parse_yrc_js(src: &str) -> JsValue {
    serde_wasm_bindgen::to_value(&parse_yrc(src)).unwrap()
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "stringifyYrc", skip_typescript)]
pub fn stringify_yrc_js(lrc: JsValue) -> String {
    let lines: Vec<LyricLine> = serde_wasm_bindgen::from_value(lrc).unwrap();
    stringify_yrc(&lines)
}
