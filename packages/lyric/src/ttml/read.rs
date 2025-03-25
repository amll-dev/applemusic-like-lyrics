#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use quick_xml::{
    events::{BytesStart, Event, attributes::AttrError},
    *,
};
use std::{borrow::Cow, io::BufRead};
use thiserror::Error;

use crate::{LyricLine, LyricWord};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CurrentStatus {
    None,
    InDiv,
    InP,

    InSpan,
    InTranslationSpan,
    InRomanSpan,

    InBackgroundSpan,
    InSpanInBackgroundSpan,
    InTranslationSpanInBackgroundSpan,
    InRomanSpanInBackgroundSpan,

    InBody,
    InHead,
    InMetadata,
    InTtml,
}

#[derive(Error, Debug)]
pub enum TTMLError {
    #[error("unexpected tt element at {0}")]
    UnexpectedTTElement(usize),
    #[error("unexpected head element at {0}")]
    UnexpectedHeadElement(usize),
    #[error("unexpected metadata element at {0}")]
    UnexpectedMetadataElement(usize),
    #[error("unexpected ttml:agent element at {0}")]
    UnexpectedTtmlAgentElement(usize),
    #[error("unexpected amll:meta element at {0}")]
    UnexpectedAmllMetaElement(usize),
    #[error("unexpected body element at {0}")]
    UnexpectedBodyElement(usize),
    #[error("unexpected div element at {0}")]
    UnexpectedDivElement(usize),
    #[error("unexpected p element at {0}")]
    UnexpectedPElement(usize),
    #[error("unexpected span element at {0}")]
    UnexpectedSpanElement(usize),
    #[error("xml attr error at {0}: {1}")]
    XmlAttrError(usize, AttrError),
    #[error("xml error on parsing attr timestamp at {0}")]
    XmlTimeStampError(usize),
    #[error("xml error at {0}: {1}")]
    XmlError(usize, quick_xml::Error),
}

impl TTMLError {
    pub fn pos(&self) -> usize {
        *match self {
            TTMLError::UnexpectedTTElement(pos) => pos,
            TTMLError::UnexpectedHeadElement(pos) => pos,
            TTMLError::UnexpectedMetadataElement(pos) => pos,
            TTMLError::UnexpectedTtmlAgentElement(pos) => pos,
            TTMLError::UnexpectedAmllMetaElement(pos) => pos,
            TTMLError::UnexpectedBodyElement(pos) => pos,
            TTMLError::UnexpectedDivElement(pos) => pos,
            TTMLError::UnexpectedPElement(pos) => pos,
            TTMLError::UnexpectedSpanElement(pos) => pos,
            TTMLError::XmlAttrError(pos, _) => pos,
            TTMLError::XmlTimeStampError(pos) => pos,
            TTMLError::XmlError(pos, _) => pos,
        }
    }
}

fn configure_lyric_line(
    e: &BytesStart<'_>,
    read_len: usize,
    main_agent: &[u8],
    line: &mut LyricLine<'_>,
) -> std::result::Result<(), TTMLError> {
    for attr in e.attributes() {
        match attr {
            Ok(a) => match a.key.as_ref() {
                b"ttm:agent" => {
                    line.is_duet |= a.value.as_ref() != main_agent;
                }
                b"begin" => {
                    if let Ok((_, time)) = parse_timestamp(a.value.as_bytes()) {
                        line.start_time = time as _;
                    } else {
                        return Err(TTMLError::XmlTimeStampError(read_len));
                    }
                }
                b"end" => {
                    if let Ok((_, time)) = parse_timestamp(a.value.as_bytes()) {
                        line.end_time = time as _;
                    } else {
                        return Err(TTMLError::XmlTimeStampError(read_len));
                    }
                }
                _ => {}
            },
            Err(err) => return Err(TTMLError::XmlAttrError(read_len, err)),
        }
    }
    Ok(())
}

fn configure_lyric_word(
    e: &BytesStart<'_>,
    read_len: usize,
    word: &mut LyricWord<'_>,
) -> std::result::Result<(), TTMLError> {
    for attr in e.attributes() {
        match attr {
            Ok(a) => match a.key.as_ref() {
                b"begin" => {
                    if let Ok((_, time)) = parse_timestamp(a.value.as_bytes()) {
                        word.start_time = time as _;
                    } else {
                        return Err(TTMLError::XmlTimeStampError(read_len));
                    }
                }
                b"end" => {
                    if let Ok((_, time)) = parse_timestamp(a.value.as_bytes()) {
                        word.end_time = time as _;
                    } else {
                        return Err(TTMLError::XmlTimeStampError(read_len));
                    }
                }
                _ => {}
            },
            Err(err) => return Err(TTMLError::XmlAttrError(read_len, err)),
        }
    }
    Ok(())
}

pub fn parse_ttml<'a>(data: impl BufRead) -> std::result::Result<TTMLLyric<'a>, TTMLError> {
    let mut reader = Reader::from_reader(data);
    let mut buf: Vec<u8> = Vec::with_capacity(256);
    let mut str_buf = String::with_capacity(256);
    let mut status = CurrentStatus::None;
    let mut result = TTMLLyric::default();
    let mut read_len = 0;
    let mut main_agent = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Eof) => break,
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let attr_name = e.name();
                // println!(
                //     "start {} {:?}",
                //     String::from_utf8_lossy(attr_name.as_ref()),
                //     status
                // );
                match attr_name.as_ref() {
                    b"tt" => {
                        if let CurrentStatus::None = status {
                            status = CurrentStatus::InTtml;
                        } else {
                            return Err(TTMLError::UnexpectedTTElement(read_len));
                        }
                    }
                    b"head" => {
                        if let CurrentStatus::InTtml = status {
                            status = CurrentStatus::InHead;
                        } else {
                            return Err(TTMLError::UnexpectedHeadElement(read_len));
                        }
                    }
                    b"metadata" => {
                        if let CurrentStatus::InHead = status {
                            status = CurrentStatus::InMetadata;
                        } else {
                            return Err(TTMLError::UnexpectedMetadataElement(read_len));
                        }
                    }
                    b"ttm:agent" => {
                        if main_agent.is_empty() {
                            if let CurrentStatus::InMetadata = status {
                                let mut agent_type = Cow::Borrowed(&[] as &[u8]);
                                let mut agent_id = Cow::Borrowed(&[] as &[u8]);
                                for attr in e.attributes() {
                                    match attr {
                                        Ok(a) => match a.key.as_ref() {
                                            b"type" => {
                                                agent_type = a.value.clone();
                                            }
                                            b"xml:id" => {
                                                agent_id = a.value.clone();
                                            }
                                            _ => {}
                                        },
                                        Err(err) => {
                                            return Err(TTMLError::XmlAttrError(read_len, err));
                                        }
                                    }
                                }
                                if agent_type == &b"person"[..] {
                                    main_agent = agent_id.into_owned();
                                    // println!(
                                    //     "main agent: {}",
                                    //     std::str::from_utf8(&main_agent).unwrap()
                                    // );
                                }
                            } else {
                                return Err(TTMLError::UnexpectedTtmlAgentElement(read_len));
                            }
                        }
                    }
                    b"amll:meta" => {
                        if let CurrentStatus::InMetadata = status {
                            let mut meta_key = Cow::Borrowed(&[] as &[u8]);
                            let mut meta_value = Cow::Borrowed(&[] as &[u8]);
                            for attr in e.attributes() {
                                match attr {
                                    Ok(a) => match a.key.as_ref() {
                                        b"key" => {
                                            meta_key = a.value.clone();
                                        }
                                        b"value" => {
                                            meta_value = a.value.clone();
                                        }
                                        _ => {}
                                    },
                                    Err(err) => return Err(TTMLError::XmlAttrError(read_len, err)),
                                }
                            }
                            if let Ok(meta_key) = std::str::from_utf8(&meta_key) {
                                if let Ok(meta_value) = std::str::from_utf8(&meta_value) {
                                    let meta_key = Cow::Borrowed(meta_key);
                                    let meta_value = Cow::Borrowed(meta_value);
                                    if let Some(values) =
                                        result.metadata.iter_mut().find(|x| x.0 == meta_key)
                                    {
                                        values.1.push(Cow::Owned(meta_value.into_owned()));
                                    } else {
                                        result.metadata.push((
                                            Cow::Owned(meta_key.into_owned()),
                                            vec![Cow::Owned(meta_value.into_owned())],
                                        ));
                                    }
                                }
                            }
                        } else {
                            return Err(TTMLError::UnexpectedAmllMetaElement(read_len));
                        }
                    }
                    b"body" => {
                        if let CurrentStatus::InTtml = status {
                            status = CurrentStatus::InBody;
                        } else {
                            return Err(TTMLError::UnexpectedBodyElement(read_len));
                        }
                    }
                    b"div" => {
                        if let CurrentStatus::InBody = status {
                            status = CurrentStatus::InDiv;
                        } else {
                            return Err(TTMLError::UnexpectedDivElement(read_len));
                        }
                    }
                    b"p" => {
                        if let CurrentStatus::InDiv = status {
                            status = CurrentStatus::InP;
                            let mut new_line = LyricLine::default();
                            configure_lyric_line(&e, read_len, &main_agent, &mut new_line)?;
                            result.lines.push(new_line);
                        } else {
                            return Err(TTMLError::UnexpectedPElement(read_len));
                        }
                    }
                    b"span" => match status {
                        CurrentStatus::InP => {
                            status = CurrentStatus::InSpan;
                            for attr in e.attributes() {
                                match attr {
                                    Ok(a) => {
                                        if a.key.as_ref() == b"ttm:role" {
                                            match a.value.as_ref() {
                                                b"x-bg" => {
                                                    status = CurrentStatus::InBackgroundSpan;
                                                    let mut new_bg_line = LyricLine {
                                                        is_bg: true,
                                                        is_duet: result
                                                            .lines
                                                            .last()
                                                            .unwrap()
                                                            .is_duet,
                                                        ..Default::default()
                                                    };
                                                    configure_lyric_line(
                                                        &e,
                                                        read_len,
                                                        &main_agent,
                                                        &mut new_bg_line,
                                                    )?;
                                                    result.lines.push(new_bg_line);
                                                    break;
                                                }
                                                b"x-translation" => {
                                                    status = CurrentStatus::InTranslationSpan;
                                                    break;
                                                }
                                                b"x-roman" => {
                                                    status = CurrentStatus::InRomanSpan;
                                                    break;
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                    Err(err) => return Err(TTMLError::XmlAttrError(read_len, err)),
                                }
                            }
                            if let CurrentStatus::InSpan = status {
                                let mut new_word = LyricWord::default();
                                configure_lyric_word(&e, read_len, &mut new_word)?;
                                result.lines.last_mut().unwrap().words.push(new_word);
                            }
                        }
                        CurrentStatus::InBackgroundSpan => {
                            status = CurrentStatus::InSpanInBackgroundSpan;
                            for attr in e.attributes() {
                                match attr {
                                    Ok(a) => {
                                        if a.key.as_ref() == b"ttm:role" {
                                            match a.value.as_ref() {
                                                b"x-translation" => {
                                                    status = CurrentStatus::InTranslationSpanInBackgroundSpan;
                                                    break;
                                                }
                                                b"x-roman" => {
                                                    status =
                                                        CurrentStatus::InRomanSpanInBackgroundSpan;
                                                    break;
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                    Err(err) => return Err(TTMLError::XmlAttrError(read_len, err)),
                                }
                            }
                            if let CurrentStatus::InSpanInBackgroundSpan = status {
                                let mut new_word = LyricWord::default();
                                configure_lyric_word(&e, read_len, &mut new_word)?;
                                result.lines.last_mut().unwrap().words.push(new_word);
                            }
                        }
                        _ => return Err(TTMLError::UnexpectedSpanElement(read_len)),
                    },
                    _ => {}
                }
                // println!(
                //     "start(finish) {} {:?}",
                //     String::from_utf8_lossy(attr_name.as_ref()),
                //     status
                // );
            }
            Ok(Event::End(e)) => {
                let attr_name = e.name();
                // println!(
                //     "end {} {:?}",
                //     String::from_utf8_lossy(attr_name.as_ref()),
                //     status
                // );
                match attr_name.as_ref() {
                    b"tt" => {
                        if let CurrentStatus::InTtml = status {
                            status = CurrentStatus::None;
                        } else {
                            return Err(TTMLError::UnexpectedTTElement(read_len));
                        }
                    }
                    b"head" => {
                        if let CurrentStatus::InHead = status {
                            status = CurrentStatus::InTtml;
                        } else {
                            return Err(TTMLError::UnexpectedHeadElement(read_len));
                        }
                    }
                    b"metadata" => {
                        if let CurrentStatus::InMetadata = status {
                            status = CurrentStatus::InHead;
                        } else {
                            return Err(TTMLError::UnexpectedMetadataElement(read_len));
                        }
                    }
                    b"body" => {
                        if let CurrentStatus::InBody = status {
                            status = CurrentStatus::InTtml;
                        } else {
                            return Err(TTMLError::UnexpectedBodyElement(read_len));
                        }
                    }
                    b"div" => {
                        if let CurrentStatus::InDiv = status {
                            status = CurrentStatus::InBody;
                        } else {
                            return Err(TTMLError::UnexpectedDivElement(read_len));
                        }
                    }
                    b"p" => {
                        if let CurrentStatus::InP = status {
                            status = CurrentStatus::InDiv;
                        } else {
                            return Err(TTMLError::UnexpectedPElement(read_len));
                        }
                    }
                    b"span" => match status {
                        CurrentStatus::InSpan => {
                            status = CurrentStatus::InP;
                            result
                                .lines
                                .last_mut()
                                .unwrap()
                                .words
                                .last_mut()
                                .unwrap()
                                .word = str_buf.clone().into();
                            str_buf.clear();
                        }
                        CurrentStatus::InBackgroundSpan => {
                            status = CurrentStatus::InP;
                            str_buf.clear();
                        }
                        CurrentStatus::InSpanInBackgroundSpan => {
                            status = CurrentStatus::InBackgroundSpan;
                            // TODO: 尽可能借用而不克隆
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| x.is_bg)
                                .unwrap()
                                .words
                                .last_mut()
                                .unwrap()
                                .word = str_buf.clone().into();
                            str_buf.clear();
                        }
                        CurrentStatus::InTranslationSpan => {
                            status = CurrentStatus::InP;
                            // TODO: 尽可能借用而不克隆
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| !x.is_bg)
                                .unwrap()
                                .translated_lyric = str_buf.clone().into();
                            str_buf.clear();
                        }
                        CurrentStatus::InRomanSpan => {
                            status = CurrentStatus::InP;
                            // TODO: 尽可能借用而不克隆
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| !x.is_bg)
                                .unwrap()
                                .roman_lyric = str_buf.clone().into();
                            str_buf.clear();
                        }
                        CurrentStatus::InTranslationSpanInBackgroundSpan => {
                            status = CurrentStatus::InBackgroundSpan;
                            // TODO: 尽可能借用而不克隆
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| x.is_bg)
                                .unwrap()
                                .translated_lyric = str_buf.clone().into();
                            str_buf.clear();
                        }
                        CurrentStatus::InRomanSpanInBackgroundSpan => {
                            status = CurrentStatus::InBackgroundSpan;
                            // TODO: 尽可能借用而不克隆
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| x.is_bg)
                                .unwrap()
                                .roman_lyric = str_buf.clone().into();
                            str_buf.clear();
                        }
                        _ => return Err(TTMLError::UnexpectedSpanElement(read_len)),
                    },
                    _ => {}
                }
                // println!(
                //     "end(finish) {} {:?}",
                //     String::from_utf8_lossy(attr_name.as_ref()),
                //     status
                // );
            }
            Ok(Event::Text(e)) => match e.unescape() {
                Ok(txt) => {
                    // println!("  text: {:?}", txt);
                    match status {
                        CurrentStatus::InP => {
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| !x.is_bg)
                                .unwrap()
                                .words
                                .push(LyricWord {
                                    word: txt.into_owned().into(),
                                    ..Default::default()
                                });
                        }
                        CurrentStatus::InBackgroundSpan => {
                            result
                                .lines
                                .iter_mut()
                                .rev()
                                .find(|x| x.is_bg)
                                .unwrap()
                                .words
                                .push(LyricWord {
                                    word: txt.into_owned().into(),
                                    ..Default::default()
                                });
                        }
                        CurrentStatus::InSpan
                        | CurrentStatus::InTranslationSpan
                        | CurrentStatus::InRomanSpan
                        | CurrentStatus::InSpanInBackgroundSpan
                        | CurrentStatus::InTranslationSpanInBackgroundSpan
                        | CurrentStatus::InRomanSpanInBackgroundSpan => {
                            str_buf.push_str(&txt);
                        }
                        _ => {}
                    }
                }
                Err(err) => return Err(TTMLError::XmlError(read_len, err)),
            },
            Err(err) => return Err(TTMLError::XmlError(read_len, err)),
            _ => (),
        }
        read_len += buf.len();
        buf.clear();
    }
    for line in result.lines.iter_mut() {
        if line.is_bg {
            if let Some(first_word) = line.words.first_mut() {
                match &mut first_word.word {
                    Cow::Borrowed(word) => {
                        *word = word.strip_suffix('(').unwrap_or(word);
                    }
                    Cow::Owned(word) => {
                        if let Some(new_word) = word.strip_prefix('(') {
                            *word = new_word.to_owned()
                        }
                    }
                }
            }
            if let Some(last_word) = line.words.last_mut() {
                match &mut last_word.word {
                    Cow::Borrowed(word) => {
                        *word = word.strip_suffix(')').unwrap_or(word);
                    }
                    Cow::Owned(word) => {
                        if let Some(new_word) = word.strip_suffix(')') {
                            *word = new_word.to_owned()
                        }
                    }
                }
            }
        }
    }
    Ok(result)
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "parseTTML", skip_typescript)]
pub fn parse_ttml_js(src: &str) -> JsValue {
    serde_wasm_bindgen::to_value(&parse_ttml(src.as_bytes()).unwrap()).unwrap()
}

#[test]
fn test_ttml() {
    const TEST_TTML: &str = include_str!("../../test/test.ttml");
    let t = std::time::Instant::now();
    let r = parse_ttml(TEST_TTML.as_bytes());
    let t = t.elapsed();
    match r {
        Ok(ttml) => {
            println!("ttml: {:#?}", ttml);
            let lys = crate::lys::stringify_lys(&ttml.lines);
            println!("lys:\n{}", lys);
        }
        Err(e) => {
            // output line number and column number
            let mut pos = e.pos();
            for (i, l) in TEST_TTML.lines().enumerate() {
                if pos < l.len() {
                    println!("error: {} at {}:{}: {:?}", e, i + 1, pos + 1, l);
                    break;
                }
                pos -= l.len() + 1;
            }
        }
    }
    println!("ttml: {:?}", t);
}

use nom::{bytes::complete::*, combinator::*, sequence::tuple, *};
use std::str::FromStr;

use super::TTMLLyric;

pub fn parse_hour(input: &[u8]) -> IResult<&[u8], u64> {
    let (input, result) = take_while_m_n(2, 3, |x: u8| x.is_dec_digit())(input)?;
    let result = u64::from_str(std::str::from_utf8(result).unwrap()).unwrap();
    Ok((input, result))
}

pub fn parse_minutes_or_seconds(input: &[u8]) -> IResult<&[u8], u64> {
    let (input, result) = take_while_m_n(1, 2, |x: u8| x.is_dec_digit())(input)?;
    let result = u64::from_str(std::str::from_utf8(result).unwrap()).unwrap();
    Ok((input, result))
}

pub fn parse_fraction(input: &[u8]) -> IResult<&[u8], u64> {
    let (input, _) = tag(b".")(input)?;
    let (input, result) = take_while1(|x: u8| x.is_dec_digit())(input)?;
    let frac_str = std::str::from_utf8(result).unwrap();
    let result = match frac_str.len() {
        0 => unreachable!(),
        1 => u64::from_str(frac_str).unwrap() * 100,
        2 => u64::from_str(frac_str).unwrap() * 10,
        3 => u64::from_str(frac_str).unwrap(),
        _ => u64::from_str(&frac_str[0..3]).unwrap(),
    };
    Ok((input, result))
}

// HH:MM:SS.MS
// or MM:SS.MS
pub fn parse_timestamp(input: &[u8]) -> IResult<&[u8], u64> {
    match tuple((
        parse_hour,
        tag(b":"),
        parse_minutes_or_seconds,
        tag(b":"),
        parse_minutes_or_seconds,
        opt(parse_fraction),
        eof,
    ))(input)
    {
        Ok((input, result)) => {
            let time = result.0 * 60 * 60 * 1000 + result.2 * 60 * 1000 + result.4 * 1000;

            if let Some(frac) = result.5 {
                Ok((input, time + frac))
            } else {
                Ok((input, time))
            }
        }
        Err(_) => match tuple((
            parse_minutes_or_seconds,
            tag(b":"),
            parse_minutes_or_seconds,
            opt(parse_fraction),
            eof,
        ))(input)
        {
            Ok((input, result)) => {
                let time = result.0 * 60 * 1000 + result.2 * 1000;
                if let Some(frac) = result.3 {
                    Ok((input, time + frac))
                } else {
                    Ok((input, time))
                }
            }
            Err(_) => match tuple((parse_minutes_or_seconds, opt(parse_fraction), eof))(input) {
                Ok((input, result)) => {
                    let time = result.0 * 1000;
                    if let Some(frac) = result.1 {
                        Ok((input, time + frac))
                    } else {
                        Ok((input, time))
                    }
                }
                Err(err) => Err(err),
            },
        },
    }
}

#[test]
fn test_timestamp() {
    assert_eq!(
        parse_timestamp("00:00.088".as_bytes()),
        Ok(("".as_bytes(), 88))
    );
    assert_eq!(
        parse_timestamp("00:45:12.2".as_bytes()),
        Ok(("".as_bytes(), 2712200))
    );
    assert_eq!(
        parse_timestamp("00:00:10.254".as_bytes()),
        Ok(("".as_bytes(), 10254))
    );
    assert_eq!(
        parse_timestamp("00:01:10".as_bytes()),
        Ok(("".as_bytes(), 70000))
    );
    assert_eq!(
        parse_timestamp("10.24".as_bytes()),
        Ok(("".as_bytes(), 10240))
    );
}
