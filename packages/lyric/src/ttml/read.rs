#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use quick_xml::{
    events::{BytesStart, Event, attributes::AttrError},
    *,
};
use std::{borrow::Cow, collections::HashMap, io::BufRead};
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
    InITunesMetadata,
    InITunesTranslation,
    InITunesTranslations,
    InITunesTransliterations,
    InITunesTranslationText,
    InITunesTransliterationText,

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

    // 用于存储 Apple Music 格式的翻译
    let mut itunes_translations: HashMap<Vec<u8>, Vec<u8>> = HashMap::new();
    // 用于存储音译
    let mut itunes_transliterations: HashMap<Vec<u8>, Vec<u8>> = HashMap::new();
    // 用于存储 for="L_ID"
    let mut current_itunes_key: Option<Vec<u8>> = None;
    // 用于拼接 <span/> 内的文本
    let mut current_itunes_text_buffer = String::with_capacity(128);

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
                    b"iTunesMetadata" => {
                        if let CurrentStatus::InMetadata = status {
                            status = CurrentStatus::InITunesMetadata;
                        }
                    }
                    b"translations" => {
                        if let CurrentStatus::InITunesMetadata = status {
                            status = CurrentStatus::InITunesTranslations;
                        }
                    }
                    b"transliterations" => {
                        if let CurrentStatus::InITunesMetadata = status {
                            status = CurrentStatus::InITunesTransliterations;
                        }
                    }
                    b"translation" => {
                        if let CurrentStatus::InITunesMetadata = status {
                            status = CurrentStatus::InITunesTranslation;
                        } else if let CurrentStatus::InITunesTranslations = status {
                            // 等待 <text>
                        }
                    }
                    b"text" => {
                        if let CurrentStatus::InITunesTranslation = status {
                            let mut key: Option<Vec<u8>> = None;
                            for attr in e.attributes() {
                                match attr {
                                    Ok(a) if a.key.as_ref() == b"for" => {
                                        key = Some(a.value.into_owned());
                                    }
                                    _ => {}
                                }
                            }
                            if let Some(k) = key
                                && let Ok(Event::Text(text_event)) =
                                    reader.read_event_into(&mut Vec::new())
                                && let Ok(unescaped_text) = text_event.decode()
                            {
                                itunes_translations
                                    .insert(k, unescaped_text.into_owned().into_bytes());
                            }
                        } else if matches!(
                            status,
                            CurrentStatus::InITunesTranslations
                                | CurrentStatus::InITunesTransliterations
                        ) {
                            current_itunes_key = None;
                            for attr in e.attributes() {
                                match attr {
                                    Ok(a) if a.key.as_ref() == b"for" => {
                                        current_itunes_key = Some(a.value.into_owned());
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                            if current_itunes_key.is_some() {
                                if status == CurrentStatus::InITunesTranslations {
                                    status = CurrentStatus::InITunesTranslationText;
                                } else {
                                    status = CurrentStatus::InITunesTransliterationText;
                                }
                                current_itunes_text_buffer.clear();
                            }
                        }
                    }
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
                            if let Ok(meta_key) = std::str::from_utf8(&meta_key)
                                && let Ok(meta_value) = std::str::from_utf8(&meta_value)
                            {
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

                            // 在配置行信息时，检查是否有 itunes:key 并查找翻译
                            let mut itunes_key: Option<Vec<u8>> = None;
                            for a in e.attributes().flatten() {
                                if a.key.as_ref() == b"itunes:key" {
                                    itunes_key = Some(a.value.into_owned());
                                    break; // 找到 key 就退出
                                }
                            }

                            configure_lyric_line(&e, read_len, &main_agent, &mut new_line)?;

                            if let Some(key) = &itunes_key {
                                if let Some(translation_text) = itunes_translations.get(key)
                                    && let Ok(s) = std::str::from_utf8(translation_text)
                                {
                                    new_line.translated_lyric = Cow::Owned(s.to_string());
                                }
                                if let Some(transliteration_text) = itunes_transliterations.get(key)
                                    && let Ok(s) = std::str::from_utf8(transliteration_text)
                                {
                                    new_line.roman_lyric = Cow::Owned(s.to_string());
                                }
                            }

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
                        CurrentStatus::InITunesTranslationText
                        | CurrentStatus::InITunesTransliterationText => {}
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
                    b"iTunesMetadata" => {
                        if let CurrentStatus::InITunesMetadata = status {
                            status = CurrentStatus::InMetadata;
                        }
                    }
                    b"text" => {
                        if let Some(key) = current_itunes_key.take() {
                            if status == CurrentStatus::InITunesTranslationText {
                                itunes_translations
                                    .insert(key, current_itunes_text_buffer.clone().into_bytes());
                                status = CurrentStatus::InITunesTranslations;
                            } else if status == CurrentStatus::InITunesTransliterationText {
                                itunes_transliterations
                                    .insert(key, current_itunes_text_buffer.clone().into_bytes());

                                status = CurrentStatus::InITunesTransliterations;
                            }
                        }
                    }
                    b"translation" => {
                        if let CurrentStatus::InITunesTranslation = status {
                            status = CurrentStatus::InITunesMetadata;
                        }
                    }
                    b"translations" => {
                        if let CurrentStatus::InITunesTranslations = status {
                            status = CurrentStatus::InITunesMetadata;
                        }
                    }
                    b"transliterations" => {
                        if let CurrentStatus::InITunesTransliterations = status {
                            status = CurrentStatus::InITunesMetadata;
                        }
                    }
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
                            // 只有在没有 Apple Music 样式翻译时才使用内嵌翻译
                            let current_line =
                                result.lines.iter_mut().rev().find(|x| !x.is_bg).unwrap();

                            if current_line.translated_lyric.is_empty() {
                                current_line.translated_lyric = str_buf.clone().into();
                            }
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
                        CurrentStatus::InITunesTranslationText
                        | CurrentStatus::InITunesTransliterationText => {}
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
            Ok(Event::GeneralRef(e)) => {
                if let Ok(entity_name) = e.decode() {
                    let decoded_char = match entity_name.as_ref() {
                        "amp" => '&',
                        "lt" => '<',
                        "gt" => '>',
                        "quot" => '"',
                        "apos" => '\'',
                        // 应该在此处记录一个警告
                        _ => '\0',
                    };

                    if decoded_char != '\0' {
                        // 处于各类 span 内部时，才将解码后的字符追加到 str_buf
                        match status {
                            CurrentStatus::InSpan
                            | CurrentStatus::InTranslationSpan
                            | CurrentStatus::InRomanSpan
                            | CurrentStatus::InSpanInBackgroundSpan
                            | CurrentStatus::InTranslationSpanInBackgroundSpan
                            | CurrentStatus::InRomanSpanInBackgroundSpan => {
                                str_buf.push(decoded_char);
                            }
                            _ => {}
                        }
                    }
                }
            }
            Ok(Event::Text(e)) => match e.decode() {
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
                        CurrentStatus::InITunesTranslationText
                        | CurrentStatus::InITunesTransliterationText => {
                            current_itunes_text_buffer.push_str(&txt);
                        }
                        _ => {}
                    }
                }
                Err(err) => {
                    return Err(TTMLError::XmlError(
                        read_len,
                        quick_xml::Error::Encoding(err),
                    ));
                }
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
            println!("ttml: {ttml:#?}");
            let lys = crate::lys::stringify_lys(&ttml.lines);
            println!("lys:\n{lys}");
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
    println!("ttml: {t:?}");
}

use nom::{bytes::complete::*, combinator::*, *};
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
    let (input, _) = tag(b".".as_slice()).parse(input)?;
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
    match (
        parse_hour,
        tag(b":".as_slice()),
        parse_minutes_or_seconds,
        tag(b":".as_slice()),
        parse_minutes_or_seconds,
        opt(parse_fraction),
        eof,
    )
        .parse(input)
    {
        Ok((input, result)) => {
            let time = result.0 * 60 * 60 * 1000 + result.2 * 60 * 1000 + result.4 * 1000;

            if let Some(frac) = result.5 {
                Ok((input, time + frac))
            } else {
                Ok((input, time))
            }
        }
        Err(_) => match (
            parse_minutes_or_seconds,
            tag(b":".as_slice()),
            parse_minutes_or_seconds,
            opt(parse_fraction),
            eof,
        )
            .parse(input)
        {
            Ok((input, result)) => {
                let time = result.0 * 60 * 1000 + result.2 * 1000;
                if let Some(frac) = result.3 {
                    Ok((input, time + frac))
                } else {
                    Ok((input, time))
                }
            }
            Err(_) => {
                match (
                    parse_minutes_or_seconds,
                    opt(parse_fraction),
                    opt(tag("s")),
                    eof,
                )
                    .parse(input)
                {
                    Ok((input, result)) => {
                        let time = result.0 * 1000;
                        if let Some(frac) = result.1 {
                            Ok((input, time + frac))
                        } else {
                            Ok((input, time))
                        }
                    }
                    Err(err) => Err(err),
                }
            }
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

#[test]
fn test_parse_ttml_with_entities() {
    const TTML_WITH_ENTITIES: &str = r#"<tt><body><div><p begin="0" end="5"><span begin="0" end="5">Test: &lt; &gt; &amp; &quot; &apos;</span></p></div></body></tt>"#;

    let result = parse_ttml(TTML_WITH_ENTITIES.as_bytes());

    assert!(result.is_ok(), "解析TTML应该成功");
    let ttml_lyric = result.unwrap();

    assert_eq!(ttml_lyric.lines.len(), 1, "应该解析出一行歌词");
    let line = &ttml_lyric.lines[0];

    assert_eq!(line.words.len(), 1, "该行歌词应该包含一个音节");
    let word = &line.words[0];

    let expected_text = "Test: < > & \" '";
    assert_eq!(word.word, expected_text, "实体引用没有被正确解码");
}

#[test]
fn test_parse_apple_music_word_by_word_lyrics() {
    const TTML_EXAMPLE: &str = r##"<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja"><head><metadata><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation type="replacement" xml:lang="en"><text for="L1"><span xmlns="http://www.w3.org/ns/ttml">This</span> <span xmlns="http://www.w3.org/ns/ttml">is</span></text><text for="L2"><span xmlns="http://www.w3.org/ns/ttml">a test</span></text></translation></translations><transliterations><transliteration xml:lang="ja-Latn"><text for="L1"><span xmlns="http://www.w3.org/ns/ttml">ko</span><span xmlns="http://www.w3.org/ns/ttml">re</span><span xmlns="http://www.w3.org/ns/ttml">wa</span></text><text for="L2"><span xmlns="http://www.w3.org/ns/ttml">tesuto</span></text></transliteration></transliterations></iTunesMetadata></metadata></head><body><div><p begin="10s" end="12s" itunes:key="L1"><span begin="10s" end="12s">これは</span></p><p begin="13s" end="15s" itunes:key="L2"><span begin="13s" end="15s">テスト</span></p><p begin="16s" end="18s" itunes:key="L3"><span begin="16s" end="18s">未翻译行</span></p></div></body></tt>"##;

    let result = parse_ttml(TTML_EXAMPLE.as_bytes());

    let ttml_lyric = result.unwrap();

    assert_eq!(ttml_lyric.lines.len(), 3, "应该解析出三行歌词");

    let line1 = &ttml_lyric.lines[0];
    assert_eq!(line1.words[0].word, "これは", "第一行原文不匹配");
    assert_eq!(line1.translated_lyric, "This is", "第一行逐字翻译拼接错误");
    assert_eq!(line1.roman_lyric, "korewa", "第一行逐字音译拼接错误");

    let line2 = &ttml_lyric.lines[1];
    assert_eq!(line2.words[0].word, "テスト", "第二行原文不匹配");
    assert_eq!(line2.translated_lyric, "a test", "第二行逐字翻译拼接错误");
    assert_eq!(line2.roman_lyric, "tesuto", "第二行逐字音译拼接错误");

    let line3 = &ttml_lyric.lines[2];
    assert_eq!(line3.words[0].word, "未翻译行", "第三行原文不匹配");
    assert!(line3.translated_lyric.is_empty(), "第三行不应有翻译");
    assert!(line3.roman_lyric.is_empty(), "第三行不应有音译");
}
