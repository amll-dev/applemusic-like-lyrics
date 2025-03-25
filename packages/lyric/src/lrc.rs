#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use crate::{LyricLine, LyricWord, utils::process_lyrics};

use std::fmt::Write;
use std::{borrow::Cow, str::FromStr};

use nom::{IResult, character::complete::line_ending};
use nom::{bytes::complete::*, combinator::opt, multi::many1};

#[inline]
pub fn parse_time(src: &str) -> IResult<&str, u64> {
    let (src, _start) = tag("[")(src)?;

    let (src, min) = take_until1(":")(src)?;

    let min = match u64::from_str(min) {
        Ok(v) => v,
        Err(_) => {
            return IResult::Err(nom::Err::Error(nom::error::Error::new(
                src,
                nom::error::ErrorKind::Digit,
            )));
        }
    };

    let (src, _) = take(1usize)(src)?;
    let (src, sec) = take_till1(|c: char| c == ':' || c == '.')(src)?;

    let sec = match u64::from_str(sec) {
        Ok(v) => v,
        Err(_) => {
            return IResult::Err(nom::Err::Error(nom::error::Error::new(
                src,
                nom::error::ErrorKind::Digit,
            )));
        }
    };

    let (src, _) = take(1usize)(src)?;
    let (src, mss) = take_while_m_n(1, 3, |c: char| c.is_ascii_digit())(src)?;
    let mut ms = u64::from_str(mss).unwrap_or_default();

    match mss.len() {
        0 => {}
        1 => {
            ms *= 100;
        }
        2 => {
            ms *= 10;
        }
        3 => {}
        _ => unreachable!(),
    }

    let time = min * 60 * 1000 + sec * 1000 + ms;

    let (src, _) = tag("]")(src)?;
    Ok((src, time))
}

#[test]
fn time_test() {
    assert_eq!(parse_time("[00:01.12]"), Ok(("", 1120)));
    assert_eq!(parse_time("[00:10.254]"), Ok(("", 10254)));
    assert_eq!(parse_time("[01:10.1]"), Ok(("", 70100)));
    assert_eq!(parse_time("[168:10:254]"), Ok(("", 10090254)));
    assert!(parse_time("[168:10.254233]").is_err());
}

#[inline]
pub fn parse_line(src: &str) -> IResult<&str, Vec<LyricLine<'_>>> {
    let (src, times) = many1(parse_time)(src)?;
    match is_not("\r\n")(src) {
        Ok((src, line)) => {
            let (src, _) = opt(line_ending)(src)?;
            Ok((
                src,
                times
                    .into_iter()
                    .map(|t| LyricLine {
                        words: vec![LyricWord {
                            start_time: t,
                            end_time: 0,
                            word: Cow::Borrowed(line),
                        }],
                        start_time: t,
                        end_time: 0,
                        ..Default::default()
                    })
                    .collect(),
            ))
        }
        Err(nom::Err::Error(nom::error::Error {
            input,
            code: nom::error::ErrorKind::IsNot,
        })) => Ok((
            src,
            times
                .into_iter()
                .map(|t| LyricLine {
                    words: vec![LyricWord {
                        start_time: t,
                        end_time: 0,
                        word: Cow::Borrowed(input),
                    }],
                    start_time: t,
                    ..Default::default()
                })
                .collect(),
        )),
        Err(e) => Err(e),
    }
}

#[test]
fn lyric_line_test() {
    assert_eq!(
        parse_line("[00:01.12] test LyRiC"),
        Ok((
            "",
            vec![LyricLine {
                words: vec![LyricWord {
                    start_time: 1120,
                    end_time: 0,
                    word: Cow::Borrowed(" test LyRiC")
                }],
                start_time: 1120,
                ..Default::default()
            }]
        ))
    );
    parse_lrc("[by: username]\n[00:01.00] \n");
    assert_eq!(
        parse_line("[00:10.254][00:10.254] sssxxx\nrestline"),
        Ok((
            "restline",
            vec![
                LyricLine {
                    words: vec![LyricWord {
                        start_time: 10254,
                        end_time: 0,
                        word: Cow::Borrowed(" sssxxx")
                    }],
                    start_time: 10254,
                    ..Default::default()
                },
                LyricLine {
                    words: vec![LyricWord {
                        start_time: 10254,
                        end_time: 0,
                        word: Cow::Borrowed(" sssxxx")
                    }],
                    start_time: 10254,
                    ..Default::default()
                }
            ]
        ))
    );
    assert_eq!(
        parse_line("[01:10.1]"),
        Ok((
            "",
            vec![LyricLine {
                words: vec![LyricWord {
                    start_time: 70100,
                    end_time: 0,
                    word: Cow::Borrowed("")
                }],
                start_time: 70100,
                ..Default::default()
            }]
        ))
    );
    assert_eq!(
        parse_line("[00:26.650]"),
        Ok((
            "",
            vec![LyricLine {
                words: vec![LyricWord {
                    start_time: 26650,
                    end_time: 0,
                    word: Cow::Borrowed("")
                }],
                start_time: 26650,
                ..Default::default()
            }]
        ))
    );
}

#[inline]
pub fn parse_lrc(src: &str) -> Vec<LyricLine> {
    let lines = src.lines();
    let mut result = Vec::with_capacity(lines.size_hint().1.unwrap_or(1024).min(1024));
    let mut last_end_time = u64::MAX as _;
    for line in lines {
        if let Ok((_, line)) = parse_line(line) {
            result.extend_from_slice(&line);
        }
    }
    result.sort_unstable_by_key(|x| x.start_time);
    for line in result.iter_mut().rev() {
        line.end_time = last_end_time;
        if let Some(first_word) = line.words.first_mut() {
            first_word.end_time = last_end_time;
        }
        last_end_time = line.start_time;
    }

    process_lyrics(&mut result);

    result
}

pub fn write_timestamp(result: &mut String, time: u64) {
    let ms = time % 1000;
    let sec = (time - ms) / 1000;
    let min = (sec - sec % 60) / 60;

    write!(result, "[{:02}:{:02}.{:03}]", min, sec % 60, ms).unwrap()
}

#[inline]
pub fn stringify_lrc(lines: &[LyricLine]) -> String {
    let capacity: usize = lines
        .iter()
        .map(|x| x.words.iter().map(|y| y.word.len()).sum::<usize>() + 13)
        .sum();
    let mut result = String::with_capacity(capacity);

    for line in lines {
        if !line.words.is_empty() {
            write_timestamp(&mut result, line.words[0].start_time);
            for word in line.words.iter() {
                result.push_str(&word.word);
            }
            result.push('\n');
        }
    }

    result
}

#[test]
fn stringify_lrc_test() {
    let lrc = parse_lrc("[00:01.12] test LyRiC\n[00:10.254] sssxxx");
    assert_eq!(
        stringify_lrc(&lrc),
        "[00:01.120] test LyRiC\n[00:10.254] sssxxx\n"
    );
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "parseLrc", skip_typescript)]
pub fn parse_lrc_js(src: &str) -> JsValue {
    serde_wasm_bindgen::to_value(&parse_lrc(src)).unwrap()
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "stringifyLrc", skip_typescript)]
pub fn stringify_lrc_js(lrc: JsValue) -> String {
    let lines: Vec<LyricLine> = serde_wasm_bindgen::from_value(lrc).unwrap();
    stringify_lrc(&lines)
}

#[test]
fn lrc_max_num() {
    dbg!(parse_line("[999:99.999]Test"));
}

#[test]
fn lrc_bench_test() {
    let mut times = Vec::with_capacity(1024);
    for _ in 0..1024 {
        let t = std::time::Instant::now();
        let _l = parse_lrc("[00:01.12] test LyRiC");
        times.push(t.elapsed());
    }
    let times = times.into_iter().map(|x| x.as_micros()).collect::<Vec<_>>();
    println!("used {} us", times.iter().sum::<u128>());
    println!(
        "average {} us",
        times.iter().sum::<u128>() / times.len() as u128
    );
}
