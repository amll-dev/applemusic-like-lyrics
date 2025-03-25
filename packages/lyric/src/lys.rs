/// Lyricify Syllable 歌词格式
///
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use crate::{LyricLine, LyricWord, utils::process_lyrics};

use std::fmt::Write;
use std::{borrow::Cow, str::FromStr};

use nom::{IResult, character::complete::line_ending};
use nom::{bytes::complete::*, combinator::opt, multi::many0};

fn process_time<'a>(
    src: &'a str,
    start_time: &'a str,
    duration: &'a str,
) -> IResult<&'a str, (u64, u64)> {
    let start_time = match u64::from_str(start_time) {
        Ok(start_time) => start_time,
        Err(_) => {
            return Err(nom::Err::Error(nom::error::Error {
                input: src,
                code: nom::error::ErrorKind::Digit,
            }));
        }
    };
    let duration = match u64::from_str(duration) {
        Ok(duration) => duration,
        Err(_) => {
            return Err(nom::Err::Error(nom::error::Error {
                input: src,
                code: nom::error::ErrorKind::Digit,
            }));
        }
    };

    Ok((src, (start_time, duration)))
}

pub fn parse_property(src: &str) -> IResult<&str, (bool, bool)> {
    let (src, _) = tag("[")(src)?;
    let (src, prop) = nom::character::complete::digit1(src)?;
    let (src, _) = tag("]")(src)?;

    let prop = prop.parse::<u8>().unwrap();

    Ok((
        src,
        match prop {
            0 => (false, false),
            1 => (false, false),
            2 => (false, true),
            3 => (false, false),
            4 => (false, false),
            5 => (false, true),
            6 => (true, false),
            7 => (true, false),
            8 => (true, true),
            _ => (false, false),
        },
    ))
}

pub fn parse_word_time(src: &str) -> IResult<&str, (u64, u64)> {
    let (src, _) = tag("(")(src)?;
    let (src, start_time) = take_until1(",")(src)?;
    let (src, _) = tag(",")(src)?;
    let (src, duration) = take_until1(")")(src)?;
    let (src, _) = tag(")")(src)?;

    process_time(src, start_time, duration)
}

pub fn parse_word(src: &str) -> IResult<&str, LyricWord<'_>> {
    for (i, _c) in src.char_indices() {
        if let Ok((nsrc, (start_time, duration))) = parse_word_time(&src[i..]) {
            return Ok((
                nsrc,
                LyricWord {
                    start_time,
                    end_time: start_time + duration,
                    word: Cow::Borrowed(&src[..i]),
                },
            ));
        }
    }

    Err(nom::Err::Error(nom::error::Error {
        input: src,
        code: nom::error::ErrorKind::TakeTill1,
    }))
}

#[test]
fn test_word() {
    let _ = dbg!(parse_word("Counting(0,18) (18,18)Stars(36,18)"));
}

pub fn parse_words(src: &str) -> IResult<&str, Vec<LyricWord<'_>>> {
    let (src, words) = many0(parse_word)(src)?;
    Ok((src, words))
}

pub fn parse_line(src: &str) -> IResult<&str, LyricLine<'_>> {
    let (src, (is_bg, is_duet)) = parse_property(src)?;
    match is_not("\r\n")(src) {
        Ok((src, line)) => {
            let (src, _) = opt(line_ending)(src)?;
            let (_, words) = parse_words(line)?;
            Ok((
                src,
                LyricLine {
                    words,
                    is_bg,
                    is_duet,
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
                    is_bg,
                    is_duet,
                    ..Default::default()
                },
            ))
        }
        Err(e) => Err(e),
    }
}

pub fn parse_lys(src: &str) -> Vec<LyricLine> {
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

pub fn stringify_lys(lines: &[LyricLine]) -> String {
    let capacity: usize = lines
        .iter()
        .map(|x| x.words.iter().map(|y| y.word.len()).sum::<usize>() + 32)
        .sum();
    let mut result = String::with_capacity(capacity);

    for line in lines {
        if !line.words.is_empty() {
            let prop = match (line.is_bg, line.is_duet) {
                (false, false) => "[0]",
                (false, true) => "[2]",
                (true, false) => "[6]",
                (true, true) => "[8]",
            };
            write!(result, "{prop}").unwrap();
            for word in line.words.iter() {
                let start_time = word.start_time;
                let duration = word.end_time - word.start_time;
                result.push_str(&word.word);
                write!(result, "({start_time},{duration})").unwrap();
            }
            result.push('\n');
        }
    }

    result
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "parseLys", skip_typescript)]
pub fn parse_lys_js(src: &str) -> JsValue {
    serde_wasm_bindgen::to_value(&parse_lys(src)).unwrap()
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "stringifyLys", skip_typescript)]
pub fn stringify_lys_js(lrc: JsValue) -> String {
    let lines: Vec<LyricLine> = serde_wasm_bindgen::from_value(lrc).unwrap();
    stringify_lys(&lines)
}

#[test]
fn test_props() {
    let line = parse_line("[0]Test(1234,567)").unwrap().1;
    assert!(!line.is_bg);
    assert!(!line.is_duet);
    let line = parse_line("[1]Test(1234,567)").unwrap().1;
    assert!(!line.is_bg);
    assert!(!line.is_duet);
    let line = parse_line("[2]Test(1234,567)").unwrap().1;
    assert!(!line.is_bg);
    assert!(line.is_duet);
    let line = parse_line("[8]Test(1234,567)").unwrap().1;
    assert!(line.is_bg);
    assert!(line.is_duet);
    assert_eq!(
        "[8]Test(1234,567)\n",
        stringify_lys(&parse_lys("[8]Test(1234,567)"))
    );
}
