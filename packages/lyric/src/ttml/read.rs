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

    InAmllVocals,

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

fn configure_lyric_line<'a>(
    e: &BytesStart<'_>,
    read_len: usize,
    main_agent: &[u8],
    vocal_map: &HashMap<Vec<u8>, Vec<u8>>,
    line: &mut LyricLine<'a>,
) -> std::result::Result<(), TTMLError> {
    // Called for every <p> (and bg) to fill line-level attrs: ttm:agent, amll:vocal, timing.
    // The caller passes prebuilt vocal_map so we can map vocal IDs to values in place.
    for attr in e.attributes() {
        match attr {
            Ok(a) => match a.key.as_ref() {
                b"ttm:agent" => {
                    line.is_duet |= a.value.as_ref() != main_agent;
                }
                b"amll:vocal" => {
                    // Supports multi IDs like "1,2" mapped via vocal_map, keeping caller order.
                    let raw_value = String::from_utf8_lossy(a.value.as_ref());
                    let mut parts: Vec<Cow<'a, str>> = Vec::new();
                    for key in raw_value.split(',') {
                        let key = key.trim();
                        if key.is_empty() {
                            continue;
                        }
                        if let Some(vocal_value) = vocal_map.get(key.as_bytes()) {
                            parts.push(Cow::Owned(
                                String::from_utf8_lossy(vocal_value.as_ref()).into_owned(),
                            ));
                        } else {
                            parts.push(Cow::Owned(key.to_string()));
                        }
                    }
                    if parts.is_empty() {
                        parts.push(Cow::Owned(raw_value.into_owned()));
                    }
                    line.vocal = parts;
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
    // 用于存储行级音译（拼接后的整行）
    let mut itunes_transliterations: HashMap<Vec<u8>, Vec<u8>> = HashMap::new();
    // 用于存储逐词音译片段（按 <span> 分片，字节串列表）
    let mut itunes_transliteration_pieces: HashMap<Vec<u8>, Vec<Vec<u8>>> = HashMap::new();
    // 用于存储 for="L_ID"
    let mut current_itunes_key: Option<Vec<u8>> = None;
    // 用于存储 amll:vocals 中的 key->value 映射
    let mut amll_vocal_map: HashMap<Vec<u8>, Vec<u8>> = HashMap::new();
    // 用于拼接 <text> 下的所有文本（行级）
    let mut current_itunes_text_buffer = String::with_capacity(128);
    // 用于收集 <text> 下每个 <span> 的逐词音译片段（仅用于 transliterations）
    let mut current_itunes_trans_pieces: Vec<String> = Vec::new();
    // 记录每一行对应的 itunes:key，以便结束后把 pieces 分配到 word
    let mut line_key_map: Vec<(usize, Vec<u8>)> = Vec::new();

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
                    b"translations" => match status {
                        CurrentStatus::InITunesMetadata
                        | CurrentStatus::InITunesTransliterations
                        | CurrentStatus::InITunesTranslation => {
                            status = CurrentStatus::InITunesTranslations;
                        }
                        _ => {}
                    },
                    b"transliterations" => match status {
                        CurrentStatus::InITunesMetadata
                        | CurrentStatus::InITunesTranslations
                        | CurrentStatus::InITunesTranslation => {
                            status = CurrentStatus::InITunesTransliterations;
                        }
                        _ => {}
                    },
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
                                    current_itunes_text_buffer.clear();
                                } else {
                                    status = CurrentStatus::InITunesTransliterationText;
                                    current_itunes_text_buffer.clear();
                                    current_itunes_trans_pieces.clear();
                                }
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
                    b"amll:vocals" => {
                        if let CurrentStatus::InMetadata = status {
                            status = CurrentStatus::InAmllVocals;
                        }
                    }
                    b"vocal" => {
                        if let CurrentStatus::InAmllVocals = status {
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
                                amll_vocal_map.insert(
                                    meta_key.as_bytes().to_vec(),
                                    meta_value.as_bytes().to_vec(),
                                );
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

                            configure_lyric_line(
                                &e,
                                read_len,
                                &main_agent,
                                &amll_vocal_map,
                                &mut new_line,
                            )?;

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

                            // 先推入行，获取索引
                            result.lines.push(new_line);
                            let line_idx = result.lines.len() - 1;

                            // 记录行与 key 的映射，供逐词音译后处理
                            if let Some(key) = &itunes_key {
                                line_key_map.push((line_idx, key.clone()));
                            }
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
                                                        vocal: result
                                                            .lines
                                                            .last()
                                                            .unwrap()
                                                            .vocal
                                                            .clone(),
                                                        ..Default::default()
                                                    };
                                                    configure_lyric_line(
                                                        &e,
                                                        read_len,
                                                        &main_agent,
                                                        &amll_vocal_map,
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
                        CurrentStatus::InITunesTranslationText => {}
                        CurrentStatus::InITunesTransliterationText => {
                            // 在 Apple 的逐词音译 <text> 中，每遇到一个 <span> 开始一个新片段
                            current_itunes_trans_pieces.push(String::new());
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
                    b"iTunesMetadata" => match status {
                        CurrentStatus::InITunesMetadata
                        | CurrentStatus::InITunesTranslations
                        | CurrentStatus::InITunesTransliterations
                        | CurrentStatus::InITunesTranslation
                        | CurrentStatus::InITunesTranslationText
                        | CurrentStatus::InITunesTransliterationText => {
                            status = CurrentStatus::InMetadata;
                        }
                        _ => {}
                    },
                    b"text" => {
                        if let Some(key) = current_itunes_key.take() {
                            if status == CurrentStatus::InITunesTranslationText {
                                itunes_translations
                                    .insert(key, current_itunes_text_buffer.clone().into_bytes());
                                status = CurrentStatus::InITunesTranslations;
                            } else if status == CurrentStatus::InITunesTransliterationText {
                                let key_clone = key.clone();
                                itunes_transliterations
                                    .insert(key, current_itunes_text_buffer.clone().into_bytes());
                                // 保存逐词片段（转为字节）
                                let pieces_bytes: Vec<Vec<u8>> = current_itunes_trans_pieces
                                    .iter()
                                    .map(|s| s.as_bytes().to_vec())
                                    .collect();
                                itunes_transliteration_pieces.insert(key_clone, pieces_bytes);
                                current_itunes_trans_pieces.clear();
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
                        if matches!(status, CurrentStatus::InMetadata | CurrentStatus::InAmllVocals)
                        {
                            status = CurrentStatus::InHead;
                        } else {
                            return Err(TTMLError::UnexpectedMetadataElement(read_len));
                        }
                    }
                    b"amll:vocals" => {
                        if let CurrentStatus::InAmllVocals = status {
                            status = CurrentStatus::InMetadata;
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
                            CurrentStatus::InITunesTranslationText => {
                                current_itunes_text_buffer.push(decoded_char);
                            }
                            CurrentStatus::InITunesTransliterationText => {
                                current_itunes_text_buffer.push(decoded_char);
                                if let Some(last) = current_itunes_trans_pieces.last_mut() {
                                    last.push(decoded_char);
                                }
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
                        CurrentStatus::InITunesTranslationText => {
                            current_itunes_text_buffer.push_str(&txt);
                        }
                        CurrentStatus::InITunesTransliterationText => {
                            // 行级缓存
                            current_itunes_text_buffer.push_str(&txt);
                            // 逐词片段：追加到当前片段
                            if let Some(last) = current_itunes_trans_pieces.last_mut() {
                                last.push_str(&txt);
                            } else {
                                // 若未遇到 <span>，也创建一个默认片段
                                current_itunes_trans_pieces.push(txt.into_owned());
                            }
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
    // 结束后：将 iTunes 逐词音译片段映射到对应行的每个词
    for (idx, key) in line_key_map.into_iter() {
        if let Some(pieces) = itunes_transliteration_pieces.get(&key) {
            let line = result.lines.get_mut(idx).unwrap();
            // 仅对前景行进行分配
            if !line.is_bg {
                // 过滤出有效词索引
                let mut word_indices: Vec<usize> = Vec::new();
                for (wi, w) in line.words.iter().enumerate() {
                    if !w.is_empty() {
                        word_indices.push(wi);
                    }
                }

                use std::borrow::Cow as ByteCow;
                let mut pieces_norm: Vec<ByteCow<[u8]>> = pieces
                    .iter()
                    .map(|p| ByteCow::Borrowed(p.as_slice()))
                    .collect();
                // 对齐片段数量和词数
                if !word_indices.is_empty() && !pieces_norm.is_empty() {
                    if pieces_norm.len() > word_indices.len() {
                        // 多余的片段合并到最后一个片段
                        let last_keep = if word_indices.is_empty() {
                            0
                        } else {
                            word_indices.len() - 1
                        };
                        let mut merged_tail: Vec<u8> = Vec::new();
                        for part in pieces.iter().skip(last_keep) {
                            merged_tail.extend_from_slice(part);
                        }
                        pieces_norm.truncate(last_keep);
                        pieces_norm.push(ByteCow::Owned(merged_tail));
                    }

                    for (i, wi) in word_indices.iter().enumerate() {
                        if i < pieces_norm.len() {
                            let piece = &pieces_norm[i];
                            let trimmed = String::from_utf8_lossy(piece.as_ref())
                                .trim_end()
                                .to_string();
                            line.words[*wi].roman_word = trimmed.into();
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
    // JS entry: tries normal parse, then strips amll:vocals on error before surfacing to JS.
    match parse_ttml(src.as_bytes()) {
        Ok(ttml) => serde_wasm_bindgen::to_value(&ttml).unwrap(),
        Err(err) => {
            let stripped = strip_amll_vocals(src);
            if stripped != src {
                if let Ok(ttml) = parse_ttml(stripped.as_bytes()) {
                    return serde_wasm_bindgen::to_value(&ttml).unwrap();
                }
            }
            wasm_bindgen::throw_str(&format!("parseTTML failed: {err}"));
        }
    }
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
fn strip_amll_vocals(input: &str) -> String {
    // Best-effort removal of <amll:vocals>...</amll:vocals> blocks to salvage broken files.
    // Called only from parse_ttml_js on parse failure; returns original string if nothing removed.
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i..].starts_with(b"<amll:vocals") {
            if let Some(end_tag_offset) = bytes[i..].iter().position(|&b| b == b'>') {
                let start_end = i + end_tag_offset + 1;
                if start_end >= 2 && bytes[start_end - 2] == b'/' {
                    i = start_end;
                    continue;
                }
                let close_tag = b"</amll:vocals>";
                if let Some(close_offset) = find_subslice(&bytes[start_end..], close_tag) {
                    i = start_end + close_offset + close_tag.len();
                    continue;
                }
                break;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    // Minimal substring search used by strip_amll_vocals; linear scan is sufficient here.
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    for i in 0..=haystack.len() - needle.len() {
        if &haystack[i..i + needle.len()] == needle {
            return Some(i);
        }
    }
    None
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
fn test_parse_ttml() {
    const TTML_WITH_ENTITIES: &str = r#"<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="Word" xml:lang="ja"><head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="other" xml:id="v2000"/><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal" leadingSilence="0.640"><translations/><songwriters><songwriter>Ayase</songwriter></songwriters><transliterations><transliteration automaticallyCreated="true" xml:lang="ja-Latn"><text for="L61"><span begin="3:10.727" end="3:11.601" xmlns="http://www.w3.org/ns/ttml">asa mo</span> <span begin="3:11.752" end="3:12.406" xmlns="http://www.w3.org/ns/ttml">yoru mo</span> <span begin="3:12.669" end="3:13.392" xmlns="http://www.w3.org/ns/ttml">hashiri</span> <span begin="3:13.392" end="3:14.275" xmlns="http://www.w3.org/ns/ttml">tsudzuke</span></text><text for="L60"><span begin="3:07.216" end="3:08.167" xmlns="http://www.w3.org/ns/ttml">jibun</span> <span begin="3:08.167" end="3:09.047" xmlns="http://www.w3.org/ns/ttml">nishika</span> <span begin="3:09.047" end="3:09.889" xmlns="http://www.w3.org/ns/ttml">dasenai</span> <span begin="3:09.889" end="3:10.273" xmlns="http://www.w3.org/ns/ttml">iro</span> <span begin="3:10.273" end="3:10.716" xmlns="http://www.w3.org/ns/ttml">de</span></text><text for="L63"><span begin="3:17.774" end="3:18.799" xmlns="http://www.w3.org/ns/ttml">suki na</span> <span begin="3:18.857" end="3:19.616" xmlns="http://www.w3.org/ns/ttml">mono to</span> <span begin="3:19.616" end="3:20.750" xmlns="http://www.w3.org/ns/ttml">muki au</span> <span begin="3:20.750" end="3:21.414" xmlns="http://www.w3.org/ns/ttml">koto</span></text><text for="L62"><span begin="3:14.284" end="3:14.996" xmlns="http://www.w3.org/ns/ttml">mitsuke</span> <span begin="3:14.996" end="3:15.673" xmlns="http://www.w3.org/ns/ttml">dashita</span> <span begin="3:15.673" end="3:16.567" xmlns="http://www.w3.org/ns/ttml">aoi</span> <span begin="3:16.567" end="3:17.764" xmlns="http://www.w3.org/ns/ttml">hikari</span></text><text for="L21"><span begin="1:00.518" end="1:00.867" xmlns="http://www.w3.org/ns/ttml">hon</span><span begin="1:00.867" end="1:01.349" xmlns="http://www.w3.org/ns/ttml">tou</span> <span begin="1:01.349" end="1:01.694" xmlns="http://www.w3.org/ns/ttml">no</span> <span begin="1:01.943" end="1:02.188" xmlns="http://www.w3.org/ns/ttml">ji</span><span begin="1:02.188" end="1:02.756" xmlns="http://www.w3.org/ns/ttml">bun</span></text><text for="L65"><span begin="3:24.523" end="3:25.748" xmlns="http://www.w3.org/ns/ttml">mou ima wa</span> <span begin="3:25.966" end="3:26.590" xmlns="http://www.w3.org/ns/ttml">ano hi</span> <span begin="3:26.590" end="3:26.934" xmlns="http://www.w3.org/ns/ttml">no</span> <span begin="3:26.934" end="3:27.828" xmlns="http://www.w3.org/ns/ttml">toumei</span> <span begin="3:27.828" end="3:28.112" xmlns="http://www.w3.org/ns/ttml">na</span> <span begin="3:28.112" end="3:28.548" xmlns="http://www.w3.org/ns/ttml">boku</span> <span begin="3:28.548" end="3:28.842" xmlns="http://www.w3.org/ns/ttml">ja</span> <span begin="3:28.842" end="3:29.152" xmlns="http://www.w3.org/ns/ttml">na</span><span begin="3:29.152" end="3:30.221" xmlns="http://www.w3.org/ns/ttml">i</span></text><text for="L20"><span begin="57.425" end="58.535" xmlns="http://www.w3.org/ns/ttml">kowakute</span> <span begin="58.535" end="59.452" xmlns="http://www.w3.org/ns/ttml">shikata</span> <span begin="59.452" end="59.844" xmlns="http://www.w3.org/ns/ttml">nai</span> <span begin="59.844" end="1:00.509" xmlns="http://www.w3.org/ns/ttml">kedo</span></text><text for="L64"><span begin="3:21.424" end="3:22.519" xmlns="http://www.w3.org/ns/ttml">ima datte</span> <span begin="3:22.519" end="3:23.167" xmlns="http://www.w3.org/ns/ttml">kowai</span> <span begin="3:23.167" end="3:23.642" xmlns="http://www.w3.org/ns/ttml">koto</span> <span begin="3:23.642" end="3:24.134" xmlns="http://www.w3.org/ns/ttml">dake</span><span begin="3:24.134" end="3:24.514" xmlns="http://www.w3.org/ns/ttml">do</span></text><text for="L23"><span begin="1:15.708" end="1:16.264" xmlns="http://www.w3.org/ns/ttml">aa</span><span begin="1:16.264" end="1:16.364" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="1:16.551" end="1:17.038" xmlns="http://www.w3.org/ns/ttml">te o</span> <span begin="1:17.038" end="1:18.067" xmlns="http://www.w3.org/ns/ttml">nobaseba</span> <span begin="1:18.241" end="1:19.044" xmlns="http://www.w3.org/ns/ttml">nobasu</span> <span begin="1:19.044" end="1:19.518" xmlns="http://www.w3.org/ns/ttml">hodo</span> <span begin="1:19.518" end="1:20.075" xmlns="http://www.w3.org/ns/ttml">ni</span></text><text for="L67"><span begin="3:33.855" end="3:34.919" xmlns="http://www.w3.org/ns/ttml">kakegae no</span> <span begin="3:34.919" end="3:35.388" xmlns="http://www.w3.org/ns/ttml">nai</span> <span begin="3:35.388" end="3:36.246" xmlns="http://www.w3.org/ns/ttml">boku da</span></text><text for="L22"><span begin="1:02.765" end="1:03.627" xmlns="http://www.w3.org/ns/ttml">deaeta</span> <span begin="1:03.627" end="1:04.095" xmlns="http://www.w3.org/ns/ttml">ki ga</span> <span begin="1:04.095" end="1:04.525" xmlns="http://www.w3.org/ns/ttml">shita</span><span begin="1:04.525" end="1:04.755" xmlns="http://www.w3.org/ns/ttml">n</span> <span begin="1:04.755" end="1:05.249" xmlns="http://www.w3.org/ns/ttml">da</span></text><text for="L66"><span begin="3:32.101" end="3:33.126" xmlns="http://www.w3.org/ns/ttml">arino</span><span begin="3:33.126" end="3:33.844" xmlns="http://www.w3.org/ns/ttml">mamano</span></text><text for="L25"><span begin="1:22.188" end="1:22.708" xmlns="http://www.w3.org/ns/ttml">omou</span> <span begin="1:22.708" end="1:23.280" xmlns="http://www.w3.org/ns/ttml">you ni</span> <span begin="1:23.507" end="1:23.969" xmlns="http://www.w3.org/ns/ttml">ika</span><span begin="1:24.148" end="1:24.723" xmlns="http://www.w3.org/ns/ttml">nai</span><span begin="1:24.723" end="1:24.860" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="1:24.956" end="1:25.534" xmlns="http://www.w3.org/ns/ttml">kyou</span> <span begin="1:25.534" end="1:25.831" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L69"><span begin="3:38.932" end="3:39.636" xmlns="http://www.w3.org/ns/ttml">hontou</span> <span begin="3:39.636" end="3:39.849" xmlns="http://www.w3.org/ns/ttml">no</span> <span begin="3:39.849" end="3:40.540" xmlns="http://www.w3.org/ns/ttml">koe</span> <span begin="3:40.540" end="3:40.979" xmlns="http://www.w3.org/ns/ttml">o</span> <span begin="3:41.072" end="3:41.654" xmlns="http://www.w3.org/ns/ttml">hibika</span><span begin="3:41.654" end="3:42.689" xmlns="http://www.w3.org/ns/ttml">sete yo</span><span begin="3:42.689" end="3:42.854" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="3:42.854" end="3:43.407" xmlns="http://www.w3.org/ns/ttml">hora</span></text><text for="L24"><span begin="1:20.075" end="1:20.978" xmlns="http://www.w3.org/ns/ttml">tooku e</span> <span begin="1:20.978" end="1:21.387" xmlns="http://www.w3.org/ns/ttml">yu</span><span begin="1:21.387" end="1:22.188" xmlns="http://www.w3.org/ns/ttml">ku</span></text><text for="L68"><span begin="3:36.257" end="3:36.729" xmlns="http://www.w3.org/ns/ttml">shira</span><span begin="3:36.729" end="3:37.063" xmlns="http://www.w3.org/ns/ttml">zu</span> <span begin="3:37.063" end="3:37.460" xmlns="http://www.w3.org/ns/ttml">shira</span><span begin="3:37.460" end="3:37.749" xmlns="http://www.w3.org/ns/ttml">zu</span> <span begin="3:37.749" end="3:38.555" xmlns="http://www.w3.org/ns/ttml">kakushite</span><span begin="3:38.555" end="3:38.932" xmlns="http://www.w3.org/ns/ttml">ta</span></text><text for="L27"><span begin="1:29.658" end="1:30.067" xmlns="http://www.w3.org/ns/ttml">kuya</span><span begin="1:30.067" end="1:30.603" xmlns="http://www.w3.org/ns/ttml">shii</span> <span begin="1:30.783" end="1:31.026" xmlns="http://www.w3.org/ns/ttml">ki</span><span begin="1:31.026" end="1:31.349" xmlns="http://www.w3.org/ns/ttml">mochi</span> <span begin="1:31.349" end="1:31.614" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L26"><span begin="1:25.831" end="1:26.315" xmlns="http://www.w3.org/ns/ttml">mata</span> <span begin="1:26.315" end="1:26.729" xmlns="http://www.w3.org/ns/ttml">awa</span><span begin="1:26.729" end="1:27.178" xmlns="http://www.w3.org/ns/ttml">tada</span><span begin="1:27.178" end="1:27.632" xmlns="http://www.w3.org/ns/ttml">shi</span><span begin="1:27.632" end="1:27.850" xmlns="http://www.w3.org/ns/ttml">ku</span> <span begin="1:27.904" end="1:28.164" xmlns="http://www.w3.org/ns/ttml">mo</span><span begin="1:28.164" end="1:28.501" xmlns="http://www.w3.org/ns/ttml">ga</span><span begin="1:28.501" end="1:28.761" xmlns="http://www.w3.org/ns/ttml">ite</span> <span begin="1:28.761" end="1:29.495" xmlns="http://www.w3.org/ns/ttml">ru</span></text><text for="L29"><span begin="1:34.274" end="1:35.176" xmlns="http://www.w3.org/ns/ttml">namida ga</span> <span begin="1:35.176" end="1:35.421" xmlns="http://www.w3.org/ns/ttml">de</span><span begin="1:35.421" end="1:35.968" xmlns="http://www.w3.org/ns/ttml">ru</span></text><text for="L28"><span begin="1:31.625" end="1:31.921" xmlns="http://www.w3.org/ns/ttml">ta</span><span begin="1:31.921" end="1:32.582" xmlns="http://www.w3.org/ns/ttml">da</span> <span begin="1:32.582" end="1:33.293" xmlns="http://www.w3.org/ns/ttml">nasake</span><span begin="1:33.293" end="1:33.670" xmlns="http://www.w3.org/ns/ttml">naku</span><span begin="1:33.670" end="1:34.265" xmlns="http://www.w3.org/ns/ttml">te</span></text><text for="L70"><span begin="3:43.407" end="3:44.100" xmlns="http://www.w3.org/ns/ttml">minai</span> <span begin="3:44.100" end="3:44.664" xmlns="http://www.w3.org/ns/ttml">furi</span> <span begin="3:44.664" end="3:45.218" xmlns="http://www.w3.org/ns/ttml">shite</span> <span begin="3:45.218" end="3:45.721" xmlns="http://www.w3.org/ns/ttml">ite</span> <span begin="3:45.721" end="3:45.962" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L72"><span begin="3:50.525" end="3:51.056" xmlns="http://www.w3.org/ns/ttml">shira</span><span begin="3:51.056" end="3:51.280" xmlns="http://www.w3.org/ns/ttml">zu</span> <span begin="3:51.280" end="3:51.690" xmlns="http://www.w3.org/ns/ttml">shira</span><span begin="3:51.690" end="3:52.029" xmlns="http://www.w3.org/ns/ttml">zu</span> <span begin="3:52.029" end="3:52.701" xmlns="http://www.w3.org/ns/ttml">kakushite</span><span begin="3:52.701" end="3:53.153" xmlns="http://www.w3.org/ns/ttml">ta</span></text><text for="L71"><span begin="3:45.973" end="3:46.984" xmlns="http://www.w3.org/ns/ttml">tashika ni</span> <span begin="3:46.984" end="3:48.023" xmlns="http://www.w3.org/ns/ttml">soko ni</span> <span begin="3:48.023" end="3:48.827" xmlns="http://www.w3.org/ns/ttml">ima mo</span> <span begin="3:48.827" end="3:49.771" xmlns="http://www.w3.org/ns/ttml">soko ni</span> <span begin="3:49.771" end="3:50.513" xmlns="http://www.w3.org/ns/ttml">aru yo</span></text><text for="L30"><span begin="1:35.978" end="1:36.513" xmlns="http://www.w3.org/ns/ttml">fumi</span><span begin="1:36.513" end="1:36.971" xmlns="http://www.w3.org/ns/ttml">komu</span><span begin="1:36.971" end="1:37.745" xmlns="http://www.w3.org/ns/ttml">hodo</span></text><text for="L74"><span begin="3:57.586" end="3:58.290" xmlns="http://www.w3.org/ns/ttml">mi nai</span> <span begin="3:58.290" end="3:58.908" xmlns="http://www.w3.org/ns/ttml">furi</span> <span begin="3:59.008" end="3:59.467" xmlns="http://www.w3.org/ns/ttml">shi te</span> <span begin="3:59.467" end="4:00.211" xmlns="http://www.w3.org/ns/ttml">i te mo</span></text><text for="L73"><span begin="3:53.153" end="3:53.989" xmlns="http://www.w3.org/ns/ttml">hontou</span> <span begin="3:53.989" end="3:54.210" xmlns="http://www.w3.org/ns/ttml">no</span> <span begin="3:54.210" end="3:54.711" xmlns="http://www.w3.org/ns/ttml">koe</span> <span begin="3:54.711" end="3:55.121" xmlns="http://www.w3.org/ns/ttml">o</span> <span begin="3:55.212" end="3:55.641" xmlns="http://www.w3.org/ns/ttml">hibi</span><span begin="3:55.641" end="3:55.862" xmlns="http://www.w3.org/ns/ttml">ka</span><span begin="3:55.862" end="3:56.883" xmlns="http://www.w3.org/ns/ttml">sete yo</span><span begin="3:56.883" end="3:56.991" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="3:56.991" end="3:57.586" xmlns="http://www.w3.org/ns/ttml">saa</span></text><text for="L32"><span begin="1:39.534" end="1:40.627" xmlns="http://www.w3.org/ns/ttml">itaku mo</span> <span begin="1:40.627" end="1:40.910" xmlns="http://www.w3.org/ns/ttml">na</span><span begin="1:40.910" end="1:42.751" xmlns="http://www.w3.org/ns/ttml">ru</span></text><text for="L31"><span begin="1:37.754" end="1:38.748" xmlns="http://www.w3.org/ns/ttml">kurushiku</span> <span begin="1:38.748" end="1:39.524" xmlns="http://www.w3.org/ns/ttml">naru</span></text><text for="L75"><span begin="4:00.222" end="4:01.202" xmlns="http://www.w3.org/ns/ttml">tashika ni</span> <span begin="4:01.202" end="4:02.347" xmlns="http://www.w3.org/ns/ttml">soko ni</span> <span begin="4:02.347" end="4:02.957" xmlns="http://www.w3.org/ns/ttml">kimi no</span> <span begin="4:02.957" end="4:03.734" xmlns="http://www.w3.org/ns/ttml">naka</span> <span begin="4:03.734" end="4:04.212" xmlns="http://www.w3.org/ns/ttml">ni</span></text><text for="L34"><span begin="1:47.158" end="1:47.472" xmlns="http://www.w3.org/ns/ttml">ji</span><span begin="1:47.472" end="1:48.105" xmlns="http://www.w3.org/ns/ttml">bun</span> <span begin="1:48.105" end="1:48.434" xmlns="http://www.w3.org/ns/ttml">de</span> <span begin="1:48.434" end="1:49.262" xmlns="http://www.w3.org/ns/ttml">eranda</span> <span begin="1:49.262" end="1:49.911" xmlns="http://www.w3.org/ns/ttml">kono</span> <span begin="1:49.911" end="1:50.342" xmlns="http://www.w3.org/ns/ttml">michi</span> <span begin="1:50.342" end="1:50.713" xmlns="http://www.w3.org/ns/ttml">o</span></text><text for="L33"><span begin="1:44.374" end="1:44.810" xmlns="http://www.w3.org/ns/ttml">kan</span><span begin="1:44.810" end="1:45.327" xmlns="http://www.w3.org/ns/ttml">jita</span> <span begin="1:45.445" end="1:46.386" xmlns="http://www.w3.org/ns/ttml">mama ni</span> <span begin="1:46.386" end="1:47.099" xmlns="http://www.w3.org/ns/ttml">susumu</span></text><text for="L36"><span begin="1:54.254" end="1:55.037" xmlns="http://www.w3.org/ns/ttml">shigami</span><span begin="1:55.037" end="1:55.449" xmlns="http://www.w3.org/ns/ttml">tsui</span><span begin="1:55.449" end="1:55.740" xmlns="http://www.w3.org/ns/ttml">ta</span> <span begin="1:55.740" end="1:56.551" xmlns="http://www.w3.org/ns/ttml">aoi</span> <span begin="1:56.551" end="1:57.834" xmlns="http://www.w3.org/ns/ttml">chikai</span></text><text for="L35"><span begin="1:50.722" end="1:51.593" xmlns="http://www.w3.org/ns/ttml">omoi</span> <span begin="1:51.593" end="1:52.482" xmlns="http://www.w3.org/ns/ttml">mabuta</span> <span begin="1:52.482" end="1:53.436" xmlns="http://www.w3.org/ns/ttml">suru</span> <span begin="1:53.436" end="1:53.827" xmlns="http://www.w3.org/ns/ttml">yoru</span> <span begin="1:53.827" end="1:54.242" xmlns="http://www.w3.org/ns/ttml">ni</span></text><text for="L38"><span begin="2:01.425" end="2:02.015" xmlns="http://www.w3.org/ns/ttml">sore wa</span> <span begin="2:02.079" end="2:02.206" xmlns="http://www.w3.org/ns/ttml">"</span><span begin="2:02.206" end="2:02.746" xmlns="http://www.w3.org/ns/ttml">tano</span><span begin="2:02.746" end="2:03.214" xmlns="http://www.w3.org/ns/ttml">shii</span><span begin="2:03.214" end="2:03.314" xmlns="http://www.w3.org/ns/ttml">"</span> <span begin="2:03.314" end="2:03.631" xmlns="http://www.w3.org/ns/ttml">dake</span> <span begin="2:03.631" end="2:03.887" xmlns="http://www.w3.org/ns/ttml">ja</span> <span begin="2:03.887" end="2:04.550" xmlns="http://www.w3.org/ns/ttml">nai</span></text><text for="L37"><span begin="1:57.845" end="1:58.738" xmlns="http://www.w3.org/ns/ttml">sukina</span> <span begin="1:58.738" end="1:59.684" xmlns="http://www.w3.org/ns/ttml">koto o</span> <span begin="1:59.684" end="2:00.519" xmlns="http://www.w3.org/ns/ttml">tsuzuke</span><span begin="2:00.519" end="2:00.878" xmlns="http://www.w3.org/ns/ttml">ru</span> <span begin="2:00.878" end="2:01.425" xmlns="http://www.w3.org/ns/ttml">koto</span></text><text for="L39"><span begin="2:04.550" end="2:05.452" xmlns="http://www.w3.org/ns/ttml">hontou</span> <span begin="2:05.452" end="2:05.842" xmlns="http://www.w3.org/ns/ttml">ni</span> <span begin="2:05.842" end="2:06.275" xmlns="http://www.w3.org/ns/ttml">deki</span><span begin="2:06.275" end="2:06.743" xmlns="http://www.w3.org/ns/ttml">ru?</span></text><text for="L41"><span begin="2:09.240" end="2:09.528" xmlns="http://www.w3.org/ns/ttml">nan</span><span begin="2:09.528" end="2:09.845" xmlns="http://www.w3.org/ns/ttml">mai</span> <span begin="2:09.845" end="2:10.064" xmlns="http://www.w3.org/ns/ttml">de</span><span begin="2:10.064" end="2:10.562" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L40"><span begin="2:06.743" end="2:07.468" xmlns="http://www.w3.org/ns/ttml">fuan</span> <span begin="2:07.468" end="2:07.667" xmlns="http://www.w3.org/ns/ttml">ni</span> <span begin="2:07.667" end="2:08.061" xmlns="http://www.w3.org/ns/ttml">naru</span> <span begin="2:08.061" end="2:08.331" xmlns="http://www.w3.org/ns/ttml">ke</span><span begin="2:08.331" end="2:08.873" xmlns="http://www.w3.org/ns/ttml">do</span></text><text for="L43"><span begin="2:12.351" end="2:12.585" xmlns="http://www.w3.org/ns/ttml">ji</span><span begin="2:12.585" end="2:12.992" xmlns="http://www.w3.org/ns/ttml">shin</span> <span begin="2:12.992" end="2:13.248" xmlns="http://www.w3.org/ns/ttml">ga</span> <span begin="2:13.248" end="2:14.150" xmlns="http://www.w3.org/ns/ttml">nai kara</span> <span begin="2:14.150" end="2:14.766" xmlns="http://www.w3.org/ns/ttml">kaite</span> <span begin="2:14.766" end="2:15.311" xmlns="http://www.w3.org/ns/ttml">kitan</span> <span begin="2:15.311" end="2:15.796" xmlns="http://www.w3.org/ns/ttml">da yo</span></text><text for="L42"><span begin="2:10.562" end="2:11.024" xmlns="http://www.w3.org/ns/ttml">hora</span> <span begin="2:11.024" end="2:11.316" xmlns="http://www.w3.org/ns/ttml">nan</span><span begin="2:11.316" end="2:11.610" xmlns="http://www.w3.org/ns/ttml">mai</span> <span begin="2:11.610" end="2:11.887" xmlns="http://www.w3.org/ns/ttml">de</span><span begin="2:11.887" end="2:12.341" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L45"><span begin="2:17.658" end="2:18.153" xmlns="http://www.w3.org/ns/ttml">hora</span> <span begin="2:18.153" end="2:18.699" xmlns="http://www.w3.org/ns/ttml">nankai</span> <span begin="2:18.699" end="2:19.326" xmlns="http://www.w3.org/ns/ttml">demo</span></text><text for="L44"><span begin="2:16.345" end="2:16.888" xmlns="http://www.w3.org/ns/ttml">nankai</span> <span begin="2:16.888" end="2:17.519" xmlns="http://www.w3.org/ns/ttml">demo</span></text><text for="L47"><span begin="2:22.919" end="2:23.859" xmlns="http://www.w3.org/ns/ttml">mawari o </span><span begin="2:23.859" end="2:24.197" xmlns="http://www.w3.org/ns/ttml">mita</span><span begin="2:24.197" end="2:24.524" xmlns="http://www.w3.org/ns/ttml">tte</span></text><text for="L46"><span begin="2:19.337" end="2:20.534" xmlns="http://www.w3.org/ns/ttml">tsumiagete</span> <span begin="2:20.534" end="2:21.596" xmlns="http://www.w3.org/ns/ttml">kita koto ga</span> <span begin="2:21.596" end="2:22.299" xmlns="http://www.w3.org/ns/ttml">buki ni</span> <span begin="2:22.299" end="2:22.909" xmlns="http://www.w3.org/ns/ttml">naru</span></text><text for="L49"><span begin="2:26.269" end="2:26.988" xmlns="http://www.w3.org/ns/ttml">boku ni</span> <span begin="2:26.988" end="2:27.490" xmlns="http://www.w3.org/ns/ttml">shika</span> <span begin="2:27.490" end="2:28.309" xmlns="http://www.w3.org/ns/ttml">dekinai</span> <span begin="2:28.309" end="2:29.195" xmlns="http://www.w3.org/ns/ttml">koto wa</span> <span begin="2:29.195" end="2:30.029" xmlns="http://www.w3.org/ns/ttml">nanda</span></text><text for="L48"><span begin="2:24.535" end="2:25.223" xmlns="http://www.w3.org/ns/ttml">dare to</span> <span begin="2:25.223" end="2:25.837" xmlns="http://www.w3.org/ns/ttml">kurabe</span> <span begin="2:25.837" end="2:26.260" xmlns="http://www.w3.org/ns/ttml">tatte</span></text><text for="L1"><span begin="1.106" end="1.552" xmlns="http://www.w3.org/ns/ttml">aa</span><span begin="1.552" end="1.652" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="1.855" end="2.672" xmlns="http://www.w3.org/ns/ttml">itsumo no</span> <span begin="2.672" end="2.981" xmlns="http://www.w3.org/ns/ttml">you</span> <span begin="2.981" end="3.663" xmlns="http://www.w3.org/ns/ttml">ni</span></text><text for="L2"><span begin="3.663" end="4.291" xmlns="http://www.w3.org/ns/ttml">sugiru</span> <span begin="4.291" end="4.773" xmlns="http://www.w3.org/ns/ttml">hibi</span> <span begin="4.773" end="5.524" xmlns="http://www.w3.org/ns/ttml">ni</span> <span begin="5.524" end="6.081" xmlns="http://www.w3.org/ns/ttml">akubi</span> <span begin="6.081" end="6.358" xmlns="http://www.w3.org/ns/ttml">ga</span> <span begin="6.358" end="7.459" xmlns="http://www.w3.org/ns/ttml">deru</span></text><text for="L50"><span begin="2:30.041" end="2:30.981" xmlns="http://www.w3.org/ns/ttml">ima</span><span begin="2:30.981" end="2:31.679" xmlns="http://www.w3.org/ns/ttml">demo</span> <span begin="2:31.679" end="2:32.293" xmlns="http://www.w3.org/ns/ttml">jishin</span> <span begin="2:32.293" end="2:33.034" xmlns="http://www.w3.org/ns/ttml">nanka</span> <span begin="2:33.034" end="2:33.446" xmlns="http://www.w3.org/ns/ttml">nai</span></text><text for="L3"><span begin="7.459" end="8.686" xmlns="http://www.w3.org/ns/ttml">sanzameku</span> <span begin="8.847" end="9.301" xmlns="http://www.w3.org/ns/ttml">yoru</span><span begin="9.301" end="9.401" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="9.543" end="10.060" xmlns="http://www.w3.org/ns/ttml">koe</span><span begin="10.060" end="10.235" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="10.235" end="10.795" xmlns="http://www.w3.org/ns/ttml">kyou</span> <span begin="10.795" end="11.189" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L4"><span begin="11.189" end="12.154" xmlns="http://www.w3.org/ns/ttml">shibuya no</span> <span begin="12.154" end="12.872" xmlns="http://www.w3.org/ns/ttml">machi ni</span> <span begin="13.021" end="13.902" xmlns="http://www.w3.org/ns/ttml">asa ga</span> <span begin="13.902" end="14.629" xmlns="http://www.w3.org/ns/ttml">furu</span></text><text for="L52"><span begin="2:35.875" end="2:36.971" xmlns="http://www.w3.org/ns/ttml">kanjita</span> <span begin="2:36.971" end="2:37.410" xmlns="http://www.w3.org/ns/ttml">koto</span> <span begin="2:37.410" end="2:37.894" xmlns="http://www.w3.org/ns/ttml">nai</span> <span begin="2:37.894" end="2:38.333" xmlns="http://www.w3.org/ns/ttml">kimo</span><span begin="2:38.333" end="2:38.761" xmlns="http://www.w3.org/ns/ttml">chi</span></text><text for="L5"><span begin="14.990" end="15.490" xmlns="http://www.w3.org/ns/ttml">doko</span> <span begin="15.490" end="16.087" xmlns="http://www.w3.org/ns/ttml">ka</span> <span begin="16.087" end="16.920" xmlns="http://www.w3.org/ns/ttml">munashii</span> <span begin="16.920" end="17.194" xmlns="http://www.w3.org/ns/ttml">you</span> <span begin="17.194" end="17.658" xmlns="http://www.w3.org/ns/ttml">na</span></text><text for="L51"><span begin="2:33.455" end="2:34.068" xmlns="http://www.w3.org/ns/ttml">sorede</span><span begin="2:34.068" end="2:35.307" xmlns="http://www.w3.org/ns/ttml">mo</span></text><text for="L6"><span begin="17.911" end="18.503" xmlns="http://www.w3.org/ns/ttml">sonna</span> <span begin="18.503" end="18.929" xmlns="http://www.w3.org/ns/ttml">kimo</span><span begin="18.929" end="19.534" xmlns="http://www.w3.org/ns/ttml">chi</span></text><text for="L10"><span begin="24.907" end="25.642" xmlns="http://www.w3.org/ns/ttml">kore de</span> <span begin="25.642" end="26.074" xmlns="http://www.w3.org/ns/ttml">ii</span></text><text for="L54"><span begin="2:41.936" end="2:42.633" xmlns="http://www.w3.org/ns/ttml">ano hi</span> <span begin="2:42.633" end="2:43.153" xmlns="http://www.w3.org/ns/ttml">fumi</span><span begin="2:43.153" end="2:43.367" xmlns="http://www.w3.org/ns/ttml">da</span><span begin="2:43.411" end="2:44.117" xmlns="http://www.w3.org/ns/ttml">shite</span></text><text for="L7"><span begin="19.543" end="20.343" xmlns="http://www.w3.org/ns/ttml">tsumara</span><span begin="20.343" end="20.765" xmlns="http://www.w3.org/ns/ttml">nai</span><span begin="20.765" end="21.403" xmlns="http://www.w3.org/ns/ttml">na</span></text><text for="L53"><span begin="2:38.771" end="2:39.464" xmlns="http://www.w3.org/ns/ttml">shirazu</span> <span begin="2:39.464" end="2:39.846" xmlns="http://www.w3.org/ns/ttml">ni</span> <span begin="2:40.131" end="2:40.652" xmlns="http://www.w3.org/ns/ttml">ita</span> <span begin="2:40.652" end="2:41.115" xmlns="http://www.w3.org/ns/ttml">omo</span><span begin="2:41.115" end="2:41.624" xmlns="http://www.w3.org/ns/ttml">i</span></text><text for="L8"><span begin="21.413" end="21.851" xmlns="http://www.w3.org/ns/ttml">demo</span> <span begin="21.851" end="22.483" xmlns="http://www.w3.org/ns/ttml">sorede</span> <span begin="22.483" end="23.150" xmlns="http://www.w3.org/ns/ttml">ii</span></text><text for="L12"><span begin="28.683" end="29.387" xmlns="http://www.w3.org/ns/ttml">hontou</span> <span begin="29.387" end="29.600" xmlns="http://www.w3.org/ns/ttml">no</span> <span begin="29.600" end="30.291" xmlns="http://www.w3.org/ns/ttml">koe</span> <span begin="30.291" end="30.730" xmlns="http://www.w3.org/ns/ttml">o</span> <span begin="30.823" end="31.405" xmlns="http://www.w3.org/ns/ttml">hibika</span><span begin="31.405" end="32.440" xmlns="http://www.w3.org/ns/ttml">sete yo</span><span begin="32.440" end="32.605" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="32.605" end="33.176" xmlns="http://www.w3.org/ns/ttml">hora</span></text><text for="L56"><span begin="2:49.430" end="2:50.365" xmlns="http://www.w3.org/ns/ttml">suki na</span> <span begin="2:50.365" end="2:51.173" xmlns="http://www.w3.org/ns/ttml">mono to</span> <span begin="2:51.173" end="2:51.973" xmlns="http://www.w3.org/ns/ttml">muki au</span> <span begin="2:51.973" end="2:52.922" xmlns="http://www.w3.org/ns/ttml">koto de</span></text><text for="L9"><span begin="23.160" end="23.899" xmlns="http://www.w3.org/ns/ttml">sonna</span> <span begin="23.899" end="24.287" xmlns="http://www.w3.org/ns/ttml">mon</span> <span begin="24.287" end="24.897" xmlns="http://www.w3.org/ns/ttml">sa</span></text><text for="L11"><span begin="26.085" end="26.514" xmlns="http://www.w3.org/ns/ttml">shira</span><span begin="26.514" end="26.803" xmlns="http://www.w3.org/ns/ttml">zu</span> <span begin="26.803" end="27.257" xmlns="http://www.w3.org/ns/ttml">shira</span><span begin="27.257" end="27.470" xmlns="http://www.w3.org/ns/ttml">zu</span> <span begin="27.470" end="28.317" xmlns="http://www.w3.org/ns/ttml">kakushite</span><span begin="28.317" end="28.683" xmlns="http://www.w3.org/ns/ttml">ta</span></text><text for="L55"><span begin="2:44.127" end="2:44.614" xmlns="http://www.w3.org/ns/ttml">haji</span><span begin="2:44.614" end="2:45.181" xmlns="http://www.w3.org/ns/ttml">mete</span> <span begin="2:45.516" end="2:46.319" xmlns="http://www.w3.org/ns/ttml">kanjita</span> <span begin="2:46.319" end="2:46.925" xmlns="http://www.w3.org/ns/ttml">kono</span> <span begin="2:47.287" end="2:48.061" xmlns="http://www.w3.org/ns/ttml">itami mo</span> <span begin="2:48.061" end="2:48.588" xmlns="http://www.w3.org/ns/ttml">zen</span><span begin="2:48.588" end="2:49.222" xmlns="http://www.w3.org/ns/ttml">bu</span></text><text for="L14"><span begin="35.805" end="36.755" xmlns="http://www.w3.org/ns/ttml">tashika ni</span> <span begin="36.755" end="37.473" xmlns="http://www.w3.org/ns/ttml">soko</span> <span begin="37.473" end="37.862" xmlns="http://www.w3.org/ns/ttml">ni</span> <span begin="37.862" end="38.149" xmlns="http://www.w3.org/ns/ttml">a</span><span begin="38.149" end="38.746" xmlns="http://www.w3.org/ns/ttml">ru</span></text><text for="L58"><span begin="2:56.088" end="2:57.149" xmlns="http://www.w3.org/ns/ttml">daijoubu</span><span begin="2:57.149" end="2:57.331" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="2:57.331" end="2:58.008" xmlns="http://www.w3.org/ns/ttml">ikou</span><span begin="2:58.008" end="2:58.182" xmlns="http://www.w3.org/ns/ttml">,</span> <span begin="2:58.182" end="2:58.917" xmlns="http://www.w3.org/ns/ttml">ato wa</span> <span begin="2:58.917" end="2:59.383" xmlns="http://www.w3.org/ns/ttml">tano</span><span begin="2:59.383" end="2:59.778" xmlns="http://www.w3.org/ns/ttml">shimu</span> <span begin="2:59.778" end="3:00.276" xmlns="http://www.w3.org/ns/ttml">dake</span> <span begin="3:00.276" end="3:00.757" xmlns="http://www.w3.org/ns/ttml">da</span></text><text for="L13"><span begin="33.176" end="33.858" xmlns="http://www.w3.org/ns/ttml">minai</span> <span begin="33.858" end="34.280" xmlns="http://www.w3.org/ns/ttml">furi</span> <span begin="34.302" end="34.943" xmlns="http://www.w3.org/ns/ttml">shite</span> <span begin="34.943" end="35.796" xmlns="http://www.w3.org/ns/ttml">itemo</span></text><text for="L57"><span begin="2:52.930" end="2:53.881" xmlns="http://www.w3.org/ns/ttml">fureta</span> <span begin="2:53.881" end="2:54.405" xmlns="http://www.w3.org/ns/ttml">mada</span> <span begin="2:54.405" end="2:55.197" xmlns="http://www.w3.org/ns/ttml">chiisana</span> <span begin="2:55.197" end="2:56.088" xmlns="http://www.w3.org/ns/ttml">hikari</span></text><text for="L16"><span begin="43.147" end="44.080" xmlns="http://www.w3.org/ns/ttml">jibun</span> <span begin="44.080" end="44.362" xmlns="http://www.w3.org/ns/ttml">de</span> <span begin="44.362" end="45.201" xmlns="http://www.w3.org/ns/ttml">eranda</span> <span begin="45.201" end="45.508" xmlns="http://www.w3.org/ns/ttml">so</span><span begin="45.508" end="46.014" xmlns="http://www.w3.org/ns/ttml">no</span> <span begin="46.014" end="46.303" xmlns="http://www.w3.org/ns/ttml">iro</span> <span begin="46.303" end="46.757" xmlns="http://www.w3.org/ns/ttml">de</span></text><text for="L15"><span begin="40.311" end="41.415" xmlns="http://www.w3.org/ns/ttml">kanjita</span> <span begin="41.415" end="42.363" xmlns="http://www.w3.org/ns/ttml">mamani</span> <span begin="42.363" end="42.733" xmlns="http://www.w3.org/ns/ttml">e</span><span begin="42.733" end="43.139" xmlns="http://www.w3.org/ns/ttml">gaku</span></text><text for="L59"><span begin="3:04.259" end="3:05.457" xmlns="http://www.w3.org/ns/ttml">subete o</span> <span begin="3:05.457" end="3:06.354" xmlns="http://www.w3.org/ns/ttml">kakete</span> <span begin="3:06.354" end="3:07.205" xmlns="http://www.w3.org/ns/ttml">egaku</span></text><text for="L18"><span begin="50.351" end="51.016" xmlns="http://www.w3.org/ns/ttml">tazu</span><span begin="51.016" end="51.367" xmlns="http://www.w3.org/ns/ttml">ne</span><span begin="51.367" end="51.616" xmlns="http://www.w3.org/ns/ttml">ta</span> <span begin="51.616" end="52.590" xmlns="http://www.w3.org/ns/ttml">aoi</span> <span begin="52.590" end="53.069" xmlns="http://www.w3.org/ns/ttml">se</span><span begin="53.069" end="53.939" xmlns="http://www.w3.org/ns/ttml">kai</span></text><text for="L17"><span begin="46.766" end="47.737" xmlns="http://www.w3.org/ns/ttml">nemui</span> <span begin="47.737" end="48.558" xmlns="http://www.w3.org/ns/ttml">kuuki</span> <span begin="48.637" end="49.427" xmlns="http://www.w3.org/ns/ttml">matou</span> <span begin="49.561" end="49.896" xmlns="http://www.w3.org/ns/ttml">asa</span> <span begin="49.896" end="50.341" xmlns="http://www.w3.org/ns/ttml">ni</span></text><text for="L19"><span begin="53.947" end="54.697" xmlns="http://www.w3.org/ns/ttml">sukina</span> <span begin="54.778" end="55.557" xmlns="http://www.w3.org/ns/ttml">mono o</span> <span begin="55.737" end="56.163" xmlns="http://www.w3.org/ns/ttml">suki</span> <span begin="56.163" end="56.470" xmlns="http://www.w3.org/ns/ttml">da</span> <span begin="56.610" end="56.983" xmlns="http://www.w3.org/ns/ttml">to i</span><span begin="56.983" end="57.417" xmlns="http://www.w3.org/ns/ttml">u</span></text></transliteration></transliterations></iTunesMetadata></metadata></head><body dur="4:08.444"><div begin="1.106" end="26.074" itunes:songPart="Verse"><p begin="1.106" end="3.663" itunes:key="L1" ttm:agent="v1"><span begin="1.106" end="1.552">嗚呼</span><span begin="1.552" end="1.652">、</span><span begin="1.855" end="2.672">いつもの</span><span begin="2.672" end="2.981">様</span><span begin="2.981" end="3.663">に</span></p><p begin="3.663" end="7.459" itunes:key="L2" ttm:agent="v1"><span begin="3.663" end="4.291">過ぎる</span><span begin="4.291" end="4.773">日々</span><span begin="4.773" end="5.524">に</span><span begin="5.524" end="6.081">あくび</span><span begin="6.081" end="6.358">が</span><span begin="6.358" end="7.459">出る</span></p><p begin="7.459" end="11.189" itunes:key="L3" ttm:agent="v1"><span begin="7.459" end="8.686">さんざめく</span><span begin="8.847" end="9.301">夜</span><span begin="9.301" end="9.401">、</span><span begin="9.543" end="10.060">越え</span><span begin="10.060" end="10.235">、</span><span begin="10.235" end="10.795">今日</span><span begin="10.795" end="11.189">も</span></p><p begin="11.189" end="14.629" itunes:key="L4" ttm:agent="v1"><span begin="11.189" end="12.154">渋谷の</span><span begin="12.154" end="12.872">街に</span><span begin="13.021" end="13.902">朝が</span><span begin="13.902" end="14.629">降る</span></p><p begin="14.990" end="17.658" itunes:key="L5" ttm:agent="v1"><span begin="14.990" end="15.490">どこ</span><span begin="15.490" end="16.087">か</span><span begin="16.087" end="16.920">虚しい</span><span begin="16.920" end="17.194">よう</span><span begin="17.194" end="17.658">な</span></p><p begin="17.911" end="19.534" itunes:key="L6" ttm:agent="v1"><span begin="17.911" end="18.503">そんな</span><span begin="18.503" end="18.929">気持</span><span begin="18.929" end="19.534">ち</span></p><p begin="19.543" end="21.403" itunes:key="L7" ttm:agent="v1"><span begin="19.543" end="20.343">つまら</span><span begin="20.343" end="20.765">ない</span><span begin="20.765" end="21.403">な</span></p><p begin="21.413" end="23.150" itunes:key="L8" ttm:agent="v1"><span begin="21.413" end="21.851">でも</span><span begin="21.851" end="22.483">それで</span><span begin="22.483" end="23.150">いい</span></p><p begin="23.160" end="24.897" itunes:key="L9" ttm:agent="v1"><span begin="23.160" end="23.899">そんな</span><span begin="23.899" end="24.287">もん</span><span begin="24.287" end="24.897">さ</span></p><p begin="24.907" end="26.074" itunes:key="L10" ttm:agent="v1"><span begin="24.907" end="25.642">これで</span><span begin="25.642" end="26.074">いい</span></p></div><div begin="26.085" end="38.746" itunes:songPart="Verse" ttm:agent="v2000"><p begin="26.085" end="28.683" itunes:key="L11" ttm:agent="v2000"><span begin="26.085" end="26.514">知ら</span><span begin="26.514" end="26.803">ず</span><span begin="26.803" end="27.257">知ら</span><span begin="27.257" end="27.470">ず</span><span begin="27.470" end="28.317">隠して</span><span begin="28.317" end="28.683">た</span></p><p begin="28.683" end="33.176" itunes:key="L12" ttm:agent="v2000"><span begin="28.683" end="29.387">本当</span><span begin="29.387" end="29.600">の</span><span begin="29.600" end="30.291">声</span><span begin="30.291" end="30.730">を</span><span begin="30.823" end="31.405">響か</span><span begin="31.405" end="32.440">せてよ</span><span begin="32.440" end="32.605">、</span><span begin="32.605" end="33.176">ほら</span></p><p begin="33.176" end="35.796" itunes:key="L13" ttm:agent="v2000"><span begin="33.176" end="33.858">見ない</span><span begin="33.858" end="34.280">フリ</span><span begin="34.302" end="34.943">して</span><span begin="34.943" end="35.796">いても</span></p><p begin="35.805" end="38.746" itunes:key="L14" ttm:agent="v2000"><span begin="35.805" end="36.755">確かに</span><span begin="36.755" end="37.473">そこ</span><span begin="37.473" end="37.862">に</span><span begin="37.862" end="38.149">あ</span><span begin="38.149" end="38.746">る</span></p></div><div begin="40.311" end="1:05.249" itunes:songPart="Chorus"><p begin="40.311" end="43.139" itunes:key="L15" ttm:agent="v1"><span begin="40.311" end="41.415">感じた</span><span begin="41.415" end="42.363">ままに</span><span begin="42.363" end="42.733">描</span><span begin="42.733" end="43.139">く</span></p><p begin="43.147" end="46.757" itunes:key="L16" ttm:agent="v1"><span begin="43.147" end="44.080">自分</span><span begin="44.080" end="44.362">で</span><span begin="44.362" end="45.201">選んだ</span><span begin="45.201" end="45.508">そ</span><span begin="45.508" end="46.014">の</span><span begin="46.014" end="46.303">色</span><span begin="46.303" end="46.757">で</span></p><p begin="46.766" end="50.341" itunes:key="L17" ttm:agent="v1"><span begin="46.766" end="47.737">眠い</span><span begin="47.737" end="48.558">空気</span><span begin="48.637" end="49.427">纏う</span><span begin="49.561" end="49.896">朝</span><span begin="49.896" end="50.341">に</span></p><p begin="50.351" end="53.939" itunes:key="L18" ttm:agent="v1"><span begin="50.351" end="51.016">訪</span><span begin="51.016" end="51.367">れ</span><span begin="51.367" end="51.616">た</span><span begin="51.616" end="52.590">青い</span><span begin="52.590" end="53.069">世</span><span begin="53.069" end="53.939">界</span></p><p begin="53.947" end="57.417" itunes:key="L19" ttm:agent="v1"><span begin="53.947" end="54.697">好きな</span><span begin="54.778" end="55.557">ものを</span><span begin="55.737" end="56.163">好き</span><span begin="56.163" end="56.470">だ</span><span begin="56.610" end="56.983">と言</span><span begin="56.983" end="57.417">う</span></p><p begin="57.425" end="1:00.509" itunes:key="L20" ttm:agent="v1"><span begin="57.425" end="58.535">怖くて</span><span begin="58.535" end="59.452">仕方</span><span begin="59.452" end="59.844">ない</span><span begin="59.844" end="1:00.509">けど</span></p><p begin="1:00.518" end="1:02.756" itunes:key="L21" ttm:agent="v1"><span begin="1:00.518" end="1:00.867">本</span><span begin="1:00.867" end="1:01.349">当</span><span begin="1:01.349" end="1:01.694">の</span><span begin="1:01.943" end="1:02.188">自</span><span begin="1:02.188" end="1:02.756">分</span></p><p begin="1:02.765" end="1:05.249" itunes:key="L22" ttm:agent="v1"><span begin="1:02.765" end="1:03.627">出会えた</span><span begin="1:03.627" end="1:04.095">気が</span><span begin="1:04.095" end="1:04.525">した</span><span begin="1:04.525" end="1:04.755">ん</span><span begin="1:04.755" end="1:05.249">だ</span></p></div><div begin="1:15.708" end="1:42.751" itunes:songPart="Verse"><p begin="1:15.708" end="1:20.075" itunes:key="L23" ttm:agent="v1"><span begin="1:15.708" end="1:16.264">嗚呼</span><span begin="1:16.264" end="1:16.364">、</span><span begin="1:16.551" end="1:17.038">手を</span><span begin="1:17.038" end="1:18.067">伸ばせば</span><span begin="1:18.241" end="1:19.044">伸ばす</span><span begin="1:19.044" end="1:19.518">ほど</span><span begin="1:19.518" end="1:20.075">に</span></p><p begin="1:20.075" end="1:22.188" itunes:key="L24" ttm:agent="v1"><span begin="1:20.075" end="1:20.978">遠くへ</span><span begin="1:20.978" end="1:21.387">ゆ</span><span begin="1:21.387" end="1:22.188">く</span></p><p begin="1:22.188" end="1:25.831" itunes:key="L25" ttm:agent="v1"><span begin="1:22.188" end="1:22.708">思う</span><span begin="1:22.708" end="1:23.280">ように</span><span begin="1:23.507" end="1:23.969">いか</span><span begin="1:24.148" end="1:24.723">ない</span><span begin="1:24.723" end="1:24.860">、</span><span begin="1:24.956" end="1:25.534">今日</span><span begin="1:25.534" end="1:25.831">も</span></p><p begin="1:25.831" end="1:29.495" itunes:key="L26" ttm:agent="v1"><span begin="1:25.831" end="1:26.315">また</span><span begin="1:26.315" end="1:26.729">慌</span><span begin="1:26.729" end="1:27.178">ただ</span><span begin="1:27.178" end="1:27.632">し</span><span begin="1:27.632" end="1:27.850">く</span><span begin="1:27.904" end="1:28.164">も</span><span begin="1:28.164" end="1:28.501">が</span><span begin="1:28.501" end="1:28.761">いて</span><span begin="1:28.761" end="1:29.495">る</span></p><p begin="1:29.658" end="1:31.614" itunes:key="L27" ttm:agent="v1"><span begin="1:29.658" end="1:30.067">悔</span><span begin="1:30.067" end="1:30.603">しい</span><span begin="1:30.783" end="1:31.026">気</span><span begin="1:31.026" end="1:31.349">持ち</span><span begin="1:31.349" end="1:31.614">も</span></p><p begin="1:31.625" end="1:34.265" itunes:key="L28" ttm:agent="v1"><span begin="1:31.625" end="1:31.921">た</span><span begin="1:31.921" end="1:32.582">だ</span><span begin="1:32.582" end="1:33.293">情け</span><span begin="1:33.293" end="1:33.670">なく</span><span begin="1:33.670" end="1:34.265">て</span></p><p begin="1:34.274" end="1:35.968" itunes:key="L29" ttm:agent="v1"><span begin="1:34.274" end="1:35.176">涙が</span><span begin="1:35.176" end="1:35.421">出</span><span begin="1:35.421" end="1:35.968">る</span></p><p begin="1:35.978" end="1:37.745" itunes:key="L30" ttm:agent="v1"><span begin="1:35.978" end="1:36.513">踏み</span><span begin="1:36.513" end="1:36.971">込む</span><span begin="1:36.971" end="1:37.745">ほど</span></p><p begin="1:37.754" end="1:39.524" itunes:key="L31" ttm:agent="v1"><span begin="1:37.754" end="1:38.748">苦しく</span><span begin="1:38.748" end="1:39.524">なる</span></p><p begin="1:39.534" end="1:42.751" itunes:key="L32" ttm:agent="v1"><span begin="1:39.534" end="1:40.627">痛くも</span><span begin="1:40.627" end="1:40.910">な</span><span begin="1:40.910" end="1:42.751">る</span></p></div><div begin="1:44.374" end="2:08.873" itunes:songPart="Chorus"><p begin="1:44.374" end="1:47.099" itunes:key="L33" ttm:agent="v1"><span begin="1:44.374" end="1:44.810">感</span><span begin="1:44.810" end="1:45.327">じた</span><span begin="1:45.445" end="1:46.386">ままに</span><span begin="1:46.386" end="1:47.099">進む</span></p><p begin="1:47.158" end="1:50.713" itunes:key="L34" ttm:agent="v1"><span begin="1:47.158" end="1:47.472">自</span><span begin="1:47.472" end="1:48.105">分</span><span begin="1:48.105" end="1:48.434">で</span><span begin="1:48.434" end="1:49.262">選んだ</span><span begin="1:49.262" end="1:49.911">この</span><span begin="1:49.911" end="1:50.342">道</span><span begin="1:50.342" end="1:50.713">を</span></p><p begin="1:50.722" end="1:54.242" itunes:key="L35" ttm:agent="v1"><span begin="1:50.722" end="1:51.593">重い</span><span begin="1:51.593" end="1:52.482">まぶた</span><span begin="1:52.482" end="1:53.436">擦る</span><span begin="1:53.436" end="1:53.827">夜</span><span begin="1:53.827" end="1:54.242">に</span></p><p begin="1:54.254" end="1:57.834" itunes:key="L36" ttm:agent="v1"><span begin="1:54.254" end="1:55.037">しがみ</span><span begin="1:55.037" end="1:55.449">つい</span><span begin="1:55.449" end="1:55.740">た</span><span begin="1:55.740" end="1:56.551">青い</span><span begin="1:56.551" end="1:57.834">誓い</span></p><p begin="1:57.845" end="2:01.425" itunes:key="L37" ttm:agent="v1"><span begin="1:57.845" end="1:58.738">好きな</span><span begin="1:58.738" end="1:59.684">ことを</span><span begin="1:59.684" end="2:00.519">続け</span><span begin="2:00.519" end="2:00.878">る</span><span begin="2:00.878" end="2:01.425">こと</span></p><p begin="2:01.425" end="2:04.550" itunes:key="L38" ttm:agent="v1"><span begin="2:01.425" end="2:02.015">それは</span><span begin="2:02.079" end="2:02.206">「</span><span begin="2:02.206" end="2:02.746">楽</span><span begin="2:02.746" end="2:03.214">しい</span><span begin="2:03.214" end="2:03.314">」</span><span begin="2:03.314" end="2:03.631">だけ</span><span begin="2:03.631" end="2:03.887">じゃ</span><span begin="2:03.887" end="2:04.550">ない</span></p><p begin="2:04.550" end="2:06.743" itunes:key="L39" ttm:agent="v1"><span begin="2:04.550" end="2:05.452">本当</span><span begin="2:05.452" end="2:05.842">に</span><span begin="2:05.842" end="2:06.275">でき</span><span begin="2:06.275" end="2:06.743">る？</span></p><p begin="2:06.743" end="2:08.873" itunes:key="L40" ttm:agent="v1"><span begin="2:06.743" end="2:07.468">不安</span><span begin="2:07.468" end="2:07.667">に</span><span begin="2:07.667" end="2:08.061">なる</span><span begin="2:08.061" end="2:08.331">け</span><span begin="2:08.331" end="2:08.873">ど</span></p></div><div begin="2:09.240" end="2:35.307" itunes:songPart="Verse"><p begin="2:09.240" end="2:10.562" itunes:key="L41" ttm:agent="v1"><span begin="2:09.240" end="2:09.528">何</span><span begin="2:09.528" end="2:09.845">枚</span><span begin="2:09.845" end="2:10.064">で</span><span begin="2:10.064" end="2:10.562">も</span></p><p begin="2:10.562" end="2:12.341" itunes:key="L42" ttm:agent="v1"><span begin="2:10.562" end="2:11.024">ほら</span><span begin="2:11.024" end="2:11.316">何</span><span begin="2:11.316" end="2:11.610">枚</span><span begin="2:11.610" end="2:11.887">で</span><span begin="2:11.887" end="2:12.341">も</span></p><p begin="2:12.351" end="2:15.796" itunes:key="L43" ttm:agent="v1"><span begin="2:12.351" end="2:12.585">自</span><span begin="2:12.585" end="2:12.992">信</span><span begin="2:12.992" end="2:13.248">が</span><span begin="2:13.248" end="2:14.150">ないから</span><span begin="2:14.150" end="2:14.766">描いて</span><span begin="2:14.766" end="2:15.311">きたん</span><span begin="2:15.311" end="2:15.796">だよ</span></p><p begin="2:16.345" end="2:17.519" itunes:key="L44" ttm:agent="v1"><span begin="2:16.345" end="2:16.888">何回</span><span begin="2:16.888" end="2:17.519">でも</span></p><p begin="2:17.658" end="2:19.326" itunes:key="L45" ttm:agent="v1"><span begin="2:17.658" end="2:18.153">ほら</span><span begin="2:18.153" end="2:18.699">何回</span><span begin="2:18.699" end="2:19.326">でも</span></p><p begin="2:19.337" end="2:22.909" itunes:key="L46" ttm:agent="v1"><span begin="2:19.337" end="2:20.534">積み上げて</span><span begin="2:20.534" end="2:21.596">きたことが</span><span begin="2:21.596" end="2:22.299">武器に</span><span begin="2:22.299" end="2:22.909">なる</span></p><p begin="2:22.919" end="2:24.524" itunes:key="L47" ttm:agent="v1"><span begin="2:22.919" end="2:23.859">周りを</span><span begin="2:23.859" end="2:24.197">見たっ</span><span begin="2:24.197" end="2:24.524">て</span></p><p begin="2:24.535" end="2:26.260" itunes:key="L48" ttm:agent="v1"><span begin="2:24.535" end="2:25.223">誰と</span><span begin="2:25.223" end="2:25.837">比べ</span><span begin="2:25.837" end="2:26.260">たって</span></p><p begin="2:26.269" end="2:30.029" itunes:key="L49" ttm:agent="v1"><span begin="2:26.269" end="2:26.988">僕に</span><span begin="2:26.988" end="2:27.490">しか</span><span begin="2:27.490" end="2:28.309">できない</span><span begin="2:28.309" end="2:29.195">ことは</span><span begin="2:29.195" end="2:30.029">なんだ</span></p><p begin="2:30.041" end="2:33.446" itunes:key="L50" ttm:agent="v1"><span begin="2:30.041" end="2:30.981">今</span><span begin="2:30.981" end="2:31.679">でも</span><span begin="2:31.679" end="2:32.293">自信</span><span begin="2:32.293" end="2:33.034">なんか</span><span begin="2:33.034" end="2:33.446">ない</span></p><p begin="2:33.455" end="2:35.307" itunes:key="L51" ttm:agent="v1"><span begin="2:33.455" end="2:34.068">それで</span><span begin="2:34.068" end="2:35.307">も</span></p></div><div begin="2:35.875" end="3:00.757" itunes:songPart="Chorus"><p begin="2:35.875" end="2:38.761" itunes:key="L52" ttm:agent="v1"><span begin="2:35.875" end="2:36.971">感じた</span><span begin="2:36.971" end="2:37.410">こと</span><span begin="2:37.410" end="2:37.894">ない</span><span begin="2:37.894" end="2:38.333">気持</span><span begin="2:38.333" end="2:38.761">ち</span></p><p begin="2:38.771" end="2:41.624" itunes:key="L53" ttm:agent="v1"><span begin="2:38.771" end="2:39.464">知らず</span><span begin="2:39.464" end="2:39.846">に</span><span begin="2:40.131" end="2:40.652">いた</span><span begin="2:40.652" end="2:41.115">想</span><span begin="2:41.115" end="2:41.624">い</span></p><p begin="2:41.936" end="2:44.117" itunes:key="L54" ttm:agent="v1"><span begin="2:41.936" end="2:42.633">あの日</span><span begin="2:42.633" end="2:43.153">踏み</span><span begin="2:43.153" end="2:43.367">出</span><span begin="2:43.411" end="2:44.117">して</span></p><p begin="2:44.127" end="2:49.222" itunes:key="L55" ttm:agent="v1"><span begin="2:44.127" end="2:44.614">初</span><span begin="2:44.614" end="2:45.181">めて</span><span begin="2:45.516" end="2:46.319">感じた</span><span begin="2:46.319" end="2:46.925">この</span><span begin="2:47.287" end="2:48.061">痛みも</span><span begin="2:48.061" end="2:48.588">全</span><span begin="2:48.588" end="2:49.222">部</span></p><p begin="2:49.430" end="2:52.922" itunes:key="L56" ttm:agent="v1"><span begin="2:49.430" end="2:50.365">好きな</span><span begin="2:50.365" end="2:51.173">ものと</span><span begin="2:51.173" end="2:51.973">向き合う</span><span begin="2:51.973" end="2:52.922">ことで</span></p><p begin="2:52.930" end="2:56.088" itunes:key="L57" ttm:agent="v1"><span begin="2:52.930" end="2:53.881">触れた</span><span begin="2:53.881" end="2:54.405">まだ</span><span begin="2:54.405" end="2:55.197">小さな</span><span begin="2:55.197" end="2:56.088">光</span></p><p begin="2:56.088" end="3:00.757" itunes:key="L58" ttm:agent="v1"><span begin="2:56.088" end="2:57.149">大丈夫</span><span begin="2:57.149" end="2:57.331">、</span><span begin="2:57.331" end="2:58.008">行こう</span><span begin="2:58.008" end="2:58.182">、</span><span begin="2:58.182" end="2:58.917">あとは</span><span begin="2:58.917" end="2:59.383">楽</span><span begin="2:59.383" end="2:59.778">しむ</span><span begin="2:59.778" end="3:00.276">だけ</span><span begin="3:00.276" end="3:00.757">だ</span></p></div><div begin="3:04.259" end="3:36.246" itunes:songPart="Chorus"><p begin="3:04.259" end="3:07.205" itunes:key="L59" ttm:agent="v1"><span begin="3:04.259" end="3:05.457">全てを</span><span begin="3:05.457" end="3:06.354">賭けて</span><span begin="3:06.354" end="3:07.205">描く</span></p><p begin="3:07.216" end="3:10.716" itunes:key="L60" ttm:agent="v1"><span begin="3:07.216" end="3:08.167">自分</span><span begin="3:08.167" end="3:09.047">にしか</span><span begin="3:09.047" end="3:09.889">出せない</span><span begin="3:09.889" end="3:10.273">色</span><span begin="3:10.273" end="3:10.716">で</span></p><p begin="3:10.727" end="3:14.275" itunes:key="L61" ttm:agent="v1"><span begin="3:10.727" end="3:11.601">朝も</span><span begin="3:11.752" end="3:12.406">夜も</span><span begin="3:12.669" end="3:13.392">走り</span><span begin="3:13.392" end="3:14.275">続け</span></p><p begin="3:14.284" end="3:17.764" itunes:key="L62" ttm:agent="v1"><span begin="3:14.284" end="3:14.996">見つけ</span><span begin="3:14.996" end="3:15.673">出した</span><span begin="3:15.673" end="3:16.567">青い</span><span begin="3:16.567" end="3:17.764">光</span></p><p begin="3:17.774" end="3:21.414" itunes:key="L63" ttm:agent="v1"><span begin="3:17.774" end="3:18.799">好きな</span><span begin="3:18.857" end="3:19.616">ものと</span><span begin="3:19.616" end="3:20.750">向き合う</span><span begin="3:20.750" end="3:21.414">こと</span></p><p begin="3:21.424" end="3:24.514" itunes:key="L64" ttm:agent="v1"><span begin="3:21.424" end="3:22.519">今だって</span><span begin="3:22.519" end="3:23.167">怖い</span><span begin="3:23.167" end="3:23.642">こと</span><span begin="3:23.642" end="3:24.134">だけ</span><span begin="3:24.134" end="3:24.514">ど</span></p><p begin="3:24.523" end="3:30.221" itunes:key="L65" ttm:agent="v1"><span begin="3:24.523" end="3:25.748">もう今は</span><span begin="3:25.966" end="3:26.590">あの日</span><span begin="3:26.590" end="3:26.934">の</span><span begin="3:26.934" end="3:27.828">透明</span><span begin="3:27.828" end="3:28.112">な</span><span begin="3:28.112" end="3:28.548">僕</span><span begin="3:28.548" end="3:28.842">じゃ</span><span begin="3:28.842" end="3:29.152">な</span><span begin="3:29.152" end="3:30.221">い</span></p><p begin="3:32.101" end="3:33.844" itunes:key="L66" ttm:agent="v1"><span begin="3:32.101" end="3:33.126">ありの</span><span begin="3:33.126" end="3:33.844">ままの</span></p><p begin="3:33.855" end="3:36.246" itunes:key="L67" ttm:agent="v1"><span begin="3:33.855" end="3:34.919">かけがえの</span><span begin="3:34.919" end="3:35.388">無い</span><span begin="3:35.388" end="3:36.246">僕だ</span></p></div><div begin="3:36.257" end="4:04.212" itunes:songPart="Verse" ttm:agent="v2000"><p begin="3:36.257" end="3:38.932" itunes:key="L68" ttm:agent="v2000"><span begin="3:36.257" end="3:36.729">知ら</span><span begin="3:36.729" end="3:37.063">ず</span><span begin="3:37.063" end="3:37.460">知ら</span><span begin="3:37.460" end="3:37.749">ず</span><span begin="3:37.749" end="3:38.555">隠して</span><span begin="3:38.555" end="3:38.932">た</span></p><p begin="3:38.932" end="3:43.407" itunes:key="L69" ttm:agent="v2000"><span begin="3:38.932" end="3:39.636">本当</span><span begin="3:39.636" end="3:39.849">の</span><span begin="3:39.849" end="3:40.540">声</span><span begin="3:40.540" end="3:40.979">を</span><span begin="3:41.072" end="3:41.654">響か</span><span begin="3:41.654" end="3:42.689">せてよ</span><span begin="3:42.689" end="3:42.854">、</span><span begin="3:42.854" end="3:43.407">ほら</span></p><p begin="3:43.407" end="3:45.962" itunes:key="L70" ttm:agent="v2000"><span begin="3:43.407" end="3:44.100">見ない</span><span begin="3:44.100" end="3:44.664">フリ</span><span begin="3:44.664" end="3:45.218">して</span><span begin="3:45.218" end="3:45.721">いて</span><span begin="3:45.721" end="3:45.962">も</span></p><p begin="3:45.973" end="3:50.513" itunes:key="L71" ttm:agent="v2000"><span begin="3:45.973" end="3:46.984">確かに</span><span begin="3:46.984" end="3:48.023">そこに</span><span begin="3:48.023" end="3:48.827">今も</span><span begin="3:48.827" end="3:49.771">そこに</span><span begin="3:49.771" end="3:50.513">あるよ</span></p><p begin="3:50.525" end="3:53.153" itunes:key="L72" ttm:agent="v2000"><span begin="3:50.525" end="3:51.056">知ら</span><span begin="3:51.056" end="3:51.280">ず</span><span begin="3:51.280" end="3:51.690">知ら</span><span begin="3:51.690" end="3:52.029">ず</span><span begin="3:52.029" end="3:52.701">隠して</span><span begin="3:52.701" end="3:53.153">た</span></p><p begin="3:53.153" end="3:57.586" itunes:key="L73" ttm:agent="v2000"><span begin="3:53.153" end="3:53.989">本当</span><span begin="3:53.989" end="3:54.210">の</span><span begin="3:54.210" end="3:54.711">声</span><span begin="3:54.711" end="3:55.121">を</span><span begin="3:55.212" end="3:55.641">響</span><span begin="3:55.641" end="3:55.862">か</span><span begin="3:55.862" end="3:56.883">せてよ</span><span begin="3:56.883" end="3:56.991">、</span><span begin="3:56.991" end="3:57.586">さあ</span></p><p begin="3:57.586" end="4:00.211" itunes:key="L74" ttm:agent="v2000"><span begin="3:57.586" end="3:58.290">見ない</span><span begin="3:58.290" end="3:58.908">フリ</span><span begin="3:59.008" end="3:59.467">して</span><span begin="3:59.467" end="4:00.211">いても</span></p><p begin="4:00.222" end="4:04.212" itunes:key="L75" ttm:agent="v2000"><span begin="4:00.222" end="4:01.202">確かに</span><span begin="4:01.202" end="4:02.347">そこに</span><span begin="4:02.347" end="4:02.957">君の</span><span begin="4:02.957" end="4:03.734">中</span><span begin="4:03.734" end="4:04.212">に</span></p></div></body></tt>"#;

    let ttml = parse_ttml(TTML_WITH_ENTITIES.as_bytes()).unwrap();

    // 工具方法：按完全匹配的词序定位一行
    fn find_line_with_words<'a>(lines: &'a [LyricLine<'a>], words: &[&str]) -> &'a LyricLine<'a> {
        for line in lines {
            if line.words.len() == words.len()
                && line
                    .words
                    .iter()
                    .zip(words.iter())
                    .all(|(w, exp)| w.word == *exp)
            {
                return line;
            }
        }
        panic!("未找到包含指定词序的行: {:?}", words);
    }

    // L51: それでも -> [それで, も] => [sorede, mo]
    let line_51 = find_line_with_words(&ttml.lines, &["それで", "も"]);
    assert_eq!(line_51.words[0].roman_word, "sorede");
    assert_eq!(line_51.words[1].roman_word, "mo");

    // L52: 感じた こと ない 気持 ち -> kanjita koto nai kimo chi
    let line_52 = find_line_with_words(&ttml.lines, &["感じた", "こと", "ない", "気持", "ち"]);
    let expected_52 = ["kanjita", "koto", "nai", "kimo", "chi"];
    for (w, exp) in line_52.words.iter().zip(expected_52) {
        assert_eq!(w.roman_word, exp, "L52 逐词音译不匹配");
    }

    // L54: あの日 踏み 出 して -> ano hi fumi da shite
    let line_54 = find_line_with_words(&ttml.lines, &["あの日", "踏み", "出", "して"]);
    let expected_54 = ["ano hi", "fumi", "da", "shite"];
    for (w, exp) in line_54.words.iter().zip(expected_54) {
        assert_eq!(w.roman_word, exp, "L54 逐词音译不匹配");
    }

    // L58: 大丈夫 、 行こう 、 あとは 楽 しむ だけ だ
    let line_58 = find_line_with_words(
        &ttml.lines,
        &[
            "大丈夫",
            "、",
            "行こう",
            "、",
            "あとは",
            "楽",
            "しむ",
            "だけ",
            "だ",
        ],
    );
    let expected_58 = [
        "daijoubu", ",", "ikou", ",", "ato wa", "tano", "shimu", "dake", "da",
    ];
    for (w, exp) in line_58.words.iter().zip(expected_58) {
        assert_eq!(w.roman_word, exp, "L58 逐词音译不匹配");
    }

    // L59: 全てを 賭けて 描く -> subete o kakete egaku
    let line_59 = find_line_with_words(&ttml.lines, &["全てを", "賭けて", "描く"]);
    let expected_59 = ["subete o", "kakete", "egaku"];
    for (w, exp) in line_59.words.iter().zip(expected_59) {
        assert_eq!(w.roman_word, exp, "L59 逐词音译不匹配");
    }
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
