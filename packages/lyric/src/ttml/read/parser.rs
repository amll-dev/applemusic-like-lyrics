use quick_xml::Reader;
use quick_xml::events::{BytesStart, Event};
use std::borrow::Cow;
use std::collections::HashMap;
use std::io::BufRead;

use super::super::TTMLLyric;
use super::error::TTMLError;
use crate::{LyricLine, LyricWord};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CurrentStatus {
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
    InITunesSingularTranslationText,
    InITunesTransliterationText,

    InITunesSongwriters,
    InITunesSongwriter,

    InTtml,
}

pub struct TTMLParser<'a, R: BufRead> {
    reader: Reader<R>,
    status: CurrentStatus,
    result: TTMLLyric<'a>,
    read_len: usize,
    main_agent: Vec<u8>,

    // Buffers and maps
    buf: Vec<u8>,
    str_buf: String,

    // iTunes specific tracking
    itunes_translations: HashMap<Vec<u8>, Vec<u8>>,
    itunes_transliterations: HashMap<Vec<u8>, Vec<u8>>,
    itunes_transliteration_pieces: HashMap<Vec<u8>, Vec<Vec<u8>>>,
    current_itunes_key: Option<Vec<u8>>,
    current_itunes_text_buffer: String,
    current_itunes_trans_pieces: Vec<String>,
    line_key_map: Vec<(usize, Vec<u8>)>,
}

impl<'a, R: BufRead> TTMLParser<'a, R> {
    pub fn new(data: R) -> Self {
        Self {
            reader: Reader::from_reader(data),
            status: CurrentStatus::None,
            result: TTMLLyric::default(),
            read_len: 0,
            main_agent: Vec::new(),
            buf: Vec::with_capacity(256),
            str_buf: String::with_capacity(256),
            itunes_translations: HashMap::new(),
            itunes_transliterations: HashMap::new(),
            itunes_transliteration_pieces: HashMap::new(),
            current_itunes_key: None,
            current_itunes_text_buffer: String::with_capacity(128),
            current_itunes_trans_pieces: Vec::new(),
            line_key_map: Vec::new(),
        }
    }

    pub fn parse(mut self) -> Result<TTMLLyric<'a>, TTMLError> {
        let mut buf = std::mem::take(&mut self.buf);
        loop {
            let event = self
                .reader
                .read_event_into(&mut buf)
                .map_err(|e| TTMLError::XmlError(self.read_len, e))?;

            match event {
                Event::Eof => break,
                Event::Start(e) | Event::Empty(e) => self.handle_start(&e)?,
                Event::End(e) => self.handle_end(&e)?,
                Event::GeneralRef(e) => self.handle_general_ref(&e)?,
                Event::Text(e) => self.handle_text(&e)?,
                _ => {}
            }
            self.read_len += buf.len();
            buf.clear();
        }

        self.post_process();
        Ok(self.result)
    }

    fn handle_start(&mut self, e: &BytesStart<'_>) -> Result<(), TTMLError> {
        let name = e.name();
        match name.as_ref() {
            b"iTunesMetadata" => {
                if let CurrentStatus::InMetadata = self.status {
                    self.status = CurrentStatus::InITunesMetadata;
                }
            }
            b"songwriters" => {
                if let CurrentStatus::InITunesMetadata = self.status {
                    self.status = CurrentStatus::InITunesSongwriters;
                }
            }
            b"songwriter" => {
                if let CurrentStatus::InITunesSongwriters = self.status {
                    self.status = CurrentStatus::InITunesSongwriter;
                    self.str_buf.clear();
                }
            }
            b"translations" => match self.status {
                CurrentStatus::InITunesMetadata
                | CurrentStatus::InITunesTransliterations
                | CurrentStatus::InITunesTranslation => {
                    self.status = CurrentStatus::InITunesTranslations;
                }
                _ => {}
            },
            b"transliterations" => match self.status {
                CurrentStatus::InITunesMetadata
                | CurrentStatus::InITunesTranslations
                | CurrentStatus::InITunesTranslation => {
                    self.status = CurrentStatus::InITunesTransliterations;
                }
                _ => {}
            },
            b"translation" => {
                if let CurrentStatus::InITunesMetadata = self.status {
                    self.status = CurrentStatus::InITunesTranslation;
                }
            }
            b"text" => self.handle_itunes_text_start(e)?,
            b"tt" => {
                if let CurrentStatus::None = self.status {
                    self.status = CurrentStatus::InTtml;
                } else {
                    return Err(TTMLError::UnexpectedTTElement(self.read_len));
                }
            }
            b"head" => {
                if let CurrentStatus::InTtml = self.status {
                    self.status = CurrentStatus::InHead;
                } else {
                    return Err(TTMLError::UnexpectedHeadElement(self.read_len));
                }
            }
            b"metadata" => {
                if let CurrentStatus::InHead = self.status {
                    self.status = CurrentStatus::InMetadata;
                } else {
                    return Err(TTMLError::UnexpectedMetadataElement(self.read_len));
                }
            }
            b"ttm:agent" => self.handle_agent_start(e)?,
            b"amll:meta" => self.handle_amll_meta_start(e)?,
            b"body" => {
                if let CurrentStatus::InTtml = self.status {
                    self.status = CurrentStatus::InBody;
                } else {
                    return Err(TTMLError::UnexpectedBodyElement(self.read_len));
                }
            }
            b"div" => {
                if let CurrentStatus::InBody = self.status {
                    self.status = CurrentStatus::InDiv;
                } else {
                    return Err(TTMLError::UnexpectedDivElement(self.read_len));
                }
            }
            b"p" => self.handle_p_start(e)?,
            b"span" => self.handle_span_start(e)?,
            _ => {}
        }
        Ok(())
    }

    fn handle_itunes_text_start(&mut self, e: &BytesStart<'_>) -> Result<(), TTMLError> {
        if let CurrentStatus::InITunesTranslation = self.status {
            let mut key: Option<Vec<u8>> = None;
            for attr in e.attributes() {
                let a = attr.map_err(|err| TTMLError::XmlAttrError(self.read_len, err))?;
                if a.key.as_ref() == b"for" {
                    key = Some(a.value.into_owned());
                }
            }
            if let Some(k) = key {
                self.current_itunes_key = Some(k);
                self.status = CurrentStatus::InITunesSingularTranslationText;
                self.current_itunes_text_buffer.clear();
            }
        } else if matches!(
            self.status,
            CurrentStatus::InITunesTranslations | CurrentStatus::InITunesTransliterations
        ) {
            self.current_itunes_key = None;
            for attr in e.attributes() {
                let a = attr.map_err(|err| TTMLError::XmlAttrError(self.read_len, err))?;
                if a.key.as_ref() == b"for" {
                    self.current_itunes_key = Some(a.value.into_owned());
                    break;
                }
            }
            if self.current_itunes_key.is_some() {
                if self.status == CurrentStatus::InITunesTranslations {
                    self.status = CurrentStatus::InITunesTranslationText;
                    self.current_itunes_text_buffer.clear();
                } else {
                    self.status = CurrentStatus::InITunesTransliterationText;
                    self.current_itunes_text_buffer.clear();
                    self.current_itunes_trans_pieces.clear();
                }
            }
        }
        Ok(())
    }

    fn handle_agent_start(&mut self, e: &BytesStart<'_>) -> Result<(), TTMLError> {
        if self.main_agent.is_empty() {
            if let CurrentStatus::InMetadata = self.status {
                let mut agent_type = Cow::Borrowed(&[] as &[u8]);
                let mut agent_id = Cow::Borrowed(&[] as &[u8]);
                for attr in e.attributes() {
                    let a = attr.map_err(|err| TTMLError::XmlAttrError(self.read_len, err))?;
                    match a.key.as_ref() {
                        b"type" => {
                            agent_type = a.value.clone();
                        }
                        b"xml:id" => {
                            agent_id = a.value.clone();
                        }
                        _ => {}
                    }
                }
                if agent_type == &b"person"[..] {
                    self.main_agent = agent_id.into_owned();
                }
            } else {
                return Err(TTMLError::UnexpectedTtmlAgentElement(self.read_len));
            }
        }
        Ok(())
    }

    fn handle_amll_meta_start(&mut self, e: &BytesStart<'_>) -> Result<(), TTMLError> {
        if let CurrentStatus::InMetadata = self.status {
            let mut meta_key = Cow::Borrowed(&[] as &[u8]);
            let mut meta_value = Cow::Borrowed(&[] as &[u8]);
            for attr in e.attributes() {
                let a = attr.map_err(|err| TTMLError::XmlAttrError(self.read_len, err))?;
                match a.key.as_ref() {
                    b"key" => {
                        meta_key = a.value.clone();
                    }
                    b"value" => {
                        meta_value = a.value.clone();
                    }
                    _ => {}
                }
            }
            if let Ok(meta_key_str) = std::str::from_utf8(&meta_key)
                && let Ok(meta_value_str) = std::str::from_utf8(&meta_value)
            {
                if let Some(values) = self
                    .result
                    .metadata
                    .iter_mut()
                    .find(|x| x.0 == meta_key_str)
                {
                    values.1.push(Cow::Owned(meta_value_str.to_string()));
                } else {
                    self.result.metadata.push((
                        Cow::Owned(meta_key_str.to_string()),
                        vec![Cow::Owned(meta_value_str.to_string())],
                    ));
                }
            }
        } else {
            return Err(TTMLError::UnexpectedAmllMetaElement(self.read_len));
        }
        Ok(())
    }

    fn handle_p_start(&mut self, e: &BytesStart<'_>) -> Result<(), TTMLError> {
        if let CurrentStatus::InDiv = self.status {
            self.status = CurrentStatus::InP;
            let mut new_line = LyricLine::default();

            let mut itunes_key: Option<Vec<u8>> = None;
            for a in e.attributes().flatten() {
                if a.key.as_ref() == b"itunes:key" {
                    itunes_key = Some(a.value.into_owned());
                    break;
                }
            }

            configure_lyric_line(e, self.read_len, &self.main_agent, &mut new_line)?;

            if let Some(key) = &itunes_key {
                if let Some(translation_text) = self.itunes_translations.get(key)
                    && let Ok(s) = std::str::from_utf8(translation_text)
                {
                    new_line.translated_lyric = Cow::Owned(s.to_string());
                }
                if let Some(transliteration_text) = self.itunes_transliterations.get(key)
                    && let Ok(s) = std::str::from_utf8(transliteration_text)
                {
                    new_line.roman_lyric = Cow::Owned(s.to_string());
                }
            }

            self.result.lines.push(new_line);
            let line_idx = self.result.lines.len() - 1;

            if let Some(key) = itunes_key {
                self.line_key_map.push((line_idx, key));
            }
        } else {
            return Err(TTMLError::UnexpectedPElement(self.read_len));
        }
        Ok(())
    }

    fn handle_span_start(&mut self, e: &BytesStart<'_>) -> Result<(), TTMLError> {
        match self.status {
            CurrentStatus::InP => {
                self.status = CurrentStatus::InSpan;
                for attr in e.attributes() {
                    let a = attr.map_err(|err| TTMLError::XmlAttrError(self.read_len, err))?;
                    if a.key.as_ref() == b"ttm:role" {
                        match a.value.as_ref() {
                            b"x-bg" => {
                                self.status = CurrentStatus::InBackgroundSpan;
                                let mut new_bg_line = LyricLine {
                                    is_bg: true,
                                    is_duet: self
                                        .result
                                        .lines
                                        .last()
                                        .map(|l| l.is_duet)
                                        .unwrap_or(false),
                                    ..Default::default()
                                };
                                configure_lyric_line(
                                    e,
                                    self.read_len,
                                    &self.main_agent,
                                    &mut new_bg_line,
                                )?;
                                self.result.lines.push(new_bg_line);
                                return Ok(());
                            }
                            b"x-translation" => {
                                self.status = CurrentStatus::InTranslationSpan;
                                return Ok(());
                            }
                            b"x-roman" => {
                                self.status = CurrentStatus::InRomanSpan;
                                return Ok(());
                            }
                            _ => {}
                        }
                    }
                }
                if let CurrentStatus::InSpan = self.status {
                    let mut new_word = LyricWord::default();
                    configure_lyric_word(e, self.read_len, &mut new_word)?;
                    self.result.lines.last_mut().unwrap().words.push(new_word);
                }
            }
            CurrentStatus::InBackgroundSpan => {
                self.status = CurrentStatus::InSpanInBackgroundSpan;
                for attr in e.attributes() {
                    let a = attr.map_err(|err| TTMLError::XmlAttrError(self.read_len, err))?;
                    if a.key.as_ref() == b"ttm:role" {
                        match a.value.as_ref() {
                            b"x-translation" => {
                                self.status = CurrentStatus::InTranslationSpanInBackgroundSpan;
                                return Ok(());
                            }
                            b"x-roman" => {
                                self.status = CurrentStatus::InRomanSpanInBackgroundSpan;
                                return Ok(());
                            }
                            _ => {}
                        }
                    }
                }
                if let CurrentStatus::InSpanInBackgroundSpan = self.status {
                    let mut new_word = LyricWord::default();
                    configure_lyric_word(e, self.read_len, &mut new_word)?;
                    self.result.lines.last_mut().unwrap().words.push(new_word);
                }
            }
            CurrentStatus::InITunesTranslationText => {}
            CurrentStatus::InITunesTransliterationText => {
                self.current_itunes_trans_pieces.push(String::new());
            }
            _ => return Err(TTMLError::UnexpectedSpanElement(self.read_len)),
        }
        Ok(())
    }

    fn handle_end(&mut self, e: &quick_xml::events::BytesEnd<'_>) -> Result<(), TTMLError> {
        let name = e.name();
        match name.as_ref() {
            b"iTunesMetadata" => match self.status {
                CurrentStatus::InITunesMetadata
                | CurrentStatus::InITunesTranslations
                | CurrentStatus::InITunesTransliterations
                | CurrentStatus::InITunesTranslation
                | CurrentStatus::InITunesTranslationText
                | CurrentStatus::InITunesSingularTranslationText
                | CurrentStatus::InITunesTransliterationText
                | CurrentStatus::InITunesSongwriters
                | CurrentStatus::InITunesSongwriter => {
                    self.status = CurrentStatus::InMetadata;
                }
                _ => {}
            },
            b"songwriters" => {
                if let CurrentStatus::InITunesSongwriters = self.status {
                    self.status = CurrentStatus::InITunesMetadata;
                }
            }
            b"songwriter" => {
                if let CurrentStatus::InITunesSongwriter = self.status {
                    self.status = CurrentStatus::InITunesSongwriters;

                    let meta_key_str = "songWriters";
                    let meta_value = self.str_buf.clone();
                    if let Some(values) = self
                        .result
                        .metadata
                        .iter_mut()
                        .find(|x| x.0 == meta_key_str)
                    {
                        values.1.push(Cow::Owned(meta_value));
                    } else {
                        self.result.metadata.push((
                            Cow::Owned(meta_key_str.to_string()),
                            vec![Cow::Owned(meta_value)],
                        ));
                    }
                    self.str_buf.clear();
                }
            }
            b"text" => {
                if let Some(key) = self.current_itunes_key.take() {
                    if self.status == CurrentStatus::InITunesTranslationText {
                        self.itunes_translations
                            .insert(key, self.current_itunes_text_buffer.clone().into_bytes());
                        self.status = CurrentStatus::InITunesTranslations;
                    } else if self.status == CurrentStatus::InITunesSingularTranslationText {
                        self.itunes_translations
                            .insert(key, self.current_itunes_text_buffer.clone().into_bytes());
                        self.status = CurrentStatus::InITunesTranslation;
                    } else if self.status == CurrentStatus::InITunesTransliterationText {
                        let key_clone = key.clone();
                        self.itunes_transliterations
                            .insert(key, self.current_itunes_text_buffer.clone().into_bytes());
                        let pieces_bytes: Vec<Vec<u8>> = self
                            .current_itunes_trans_pieces
                            .iter()
                            .map(|s| s.as_bytes().to_vec())
                            .collect();
                        self.itunes_transliteration_pieces
                            .insert(key_clone, pieces_bytes);
                        self.current_itunes_trans_pieces.clear();
                        self.status = CurrentStatus::InITunesTransliterations;
                    }
                }
            }
            b"translation" => {
                if let CurrentStatus::InITunesTranslation = self.status {
                    self.status = CurrentStatus::InITunesMetadata;
                }
            }
            b"translations" => {
                if let CurrentStatus::InITunesTranslations = self.status {
                    self.status = CurrentStatus::InITunesMetadata;
                }
            }
            b"transliterations" => {
                if let CurrentStatus::InITunesTransliterations = self.status {
                    self.status = CurrentStatus::InITunesMetadata;
                }
            }
            b"tt" => {
                if let CurrentStatus::InTtml = self.status {
                    self.status = CurrentStatus::None;
                } else {
                    return Err(TTMLError::UnexpectedTTElement(self.read_len));
                }
            }
            b"head" => {
                if let CurrentStatus::InHead = self.status {
                    self.status = CurrentStatus::InTtml;
                } else {
                    return Err(TTMLError::UnexpectedHeadElement(self.read_len));
                }
            }
            b"metadata" => {
                if let CurrentStatus::InMetadata = self.status {
                    self.status = CurrentStatus::InHead;
                } else {
                    return Err(TTMLError::UnexpectedMetadataElement(self.read_len));
                }
            }
            b"body" => {
                if let CurrentStatus::InBody = self.status {
                    self.status = CurrentStatus::InTtml;
                } else {
                    return Err(TTMLError::UnexpectedBodyElement(self.read_len));
                }
            }
            b"div" => {
                if let CurrentStatus::InDiv = self.status {
                    self.status = CurrentStatus::InBody;
                } else {
                    return Err(TTMLError::UnexpectedDivElement(self.read_len));
                }
            }
            b"p" => {
                if let CurrentStatus::InP = self.status {
                    self.status = CurrentStatus::InDiv;
                } else {
                    return Err(TTMLError::UnexpectedPElement(self.read_len));
                }
            }
            b"span" => self.handle_span_end()?,
            _ => {}
        }
        Ok(())
    }

    fn handle_span_end(&mut self) -> Result<(), TTMLError> {
        match self.status {
            CurrentStatus::InSpan => {
                self.status = CurrentStatus::InP;
                self.result
                    .lines
                    .last_mut()
                    .unwrap()
                    .words
                    .last_mut()
                    .unwrap()
                    .word = self.str_buf.clone().into();
                self.str_buf.clear();
            }
            CurrentStatus::InBackgroundSpan => {
                self.status = CurrentStatus::InP;
                self.str_buf.clear();
            }
            CurrentStatus::InSpanInBackgroundSpan => {
                self.status = CurrentStatus::InBackgroundSpan;
                self.result
                    .lines
                    .iter_mut()
                    .rev()
                    .find(|x| x.is_bg)
                    .unwrap()
                    .words
                    .last_mut()
                    .unwrap()
                    .word = self.str_buf.clone().into();
                self.str_buf.clear();
            }
            CurrentStatus::InTranslationSpan => {
                self.status = CurrentStatus::InP;
                let current_line = self
                    .result
                    .lines
                    .iter_mut()
                    .rev()
                    .find(|x| !x.is_bg)
                    .unwrap();
                if current_line.translated_lyric.is_empty() {
                    current_line.translated_lyric = self.str_buf.clone().into();
                }
                self.str_buf.clear();
            }
            CurrentStatus::InRomanSpan => {
                self.status = CurrentStatus::InP;
                let current_line = self
                    .result
                    .lines
                    .iter_mut()
                    .rev()
                    .find(|x| !x.is_bg)
                    .unwrap();
                current_line.roman_lyric = self.str_buf.clone().into();
                self.str_buf.clear();
            }
            CurrentStatus::InTranslationSpanInBackgroundSpan => {
                self.status = CurrentStatus::InBackgroundSpan;
                self.result
                    .lines
                    .iter_mut()
                    .rev()
                    .find(|x| x.is_bg)
                    .unwrap()
                    .translated_lyric = self.str_buf.clone().into();
                self.str_buf.clear();
            }
            CurrentStatus::InRomanSpanInBackgroundSpan => {
                self.status = CurrentStatus::InBackgroundSpan;
                self.result
                    .lines
                    .iter_mut()
                    .rev()
                    .find(|x| x.is_bg)
                    .unwrap()
                    .roman_lyric = self.str_buf.clone().into();
                self.str_buf.clear();
            }
            CurrentStatus::InITunesTranslationText
            | CurrentStatus::InITunesSingularTranslationText
            | CurrentStatus::InITunesTransliterationText => {}
            _ => return Err(TTMLError::UnexpectedSpanElement(self.read_len)),
        }
        Ok(())
    }

    fn handle_general_ref(&mut self, e: &quick_xml::events::BytesRef<'_>) -> Result<(), TTMLError> {
        if let Ok(entity_name) = e.decode() {
            let decoded_char = match entity_name.as_ref() {
                "amp" => '&',
                "lt" => '<',
                "gt" => '>',
                "quot" => '"',
                "apos" => '\'',
                _ => '\0',
            };

            if decoded_char != '\0' {
                match self.status {
                    CurrentStatus::InSpan
                    | CurrentStatus::InTranslationSpan
                    | CurrentStatus::InRomanSpan
                    | CurrentStatus::InSpanInBackgroundSpan
                    | CurrentStatus::InTranslationSpanInBackgroundSpan
                    | CurrentStatus::InRomanSpanInBackgroundSpan
                    | CurrentStatus::InITunesSongwriter => {
                        self.str_buf.push(decoded_char);
                    }
                    CurrentStatus::InITunesTranslationText
                    | CurrentStatus::InITunesSingularTranslationText => {
                        self.current_itunes_text_buffer.push(decoded_char);
                    }
                    CurrentStatus::InITunesTransliterationText => {
                        self.current_itunes_text_buffer.push(decoded_char);
                        if let Some(last) = self.current_itunes_trans_pieces.last_mut() {
                            last.push(decoded_char);
                        }
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    }

    fn handle_text(&mut self, e: &quick_xml::events::BytesText<'_>) -> Result<(), TTMLError> {
        match e.decode() {
            Ok(txt) => match self.status {
                CurrentStatus::InP => {
                    self.result
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
                    self.result
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
                | CurrentStatus::InRomanSpanInBackgroundSpan
                | CurrentStatus::InITunesSongwriter => {
                    self.str_buf.push_str(&txt);
                }
                CurrentStatus::InITunesTranslationText
                | CurrentStatus::InITunesSingularTranslationText => {
                    self.current_itunes_text_buffer.push_str(&txt);
                }
                CurrentStatus::InITunesTransliterationText => {
                    self.current_itunes_text_buffer.push_str(&txt);
                    if let Some(last) = self.current_itunes_trans_pieces.last_mut() {
                        last.push_str(&txt);
                    } else {
                        self.current_itunes_trans_pieces.push(txt.into_owned());
                    }
                }
                _ => {}
            },
            Err(err) => {
                return Err(TTMLError::XmlError(
                    self.read_len,
                    quick_xml::Error::Encoding(err),
                ));
            }
        }
        Ok(())
    }

    fn post_process(&mut self) {
        for line in self.result.lines.iter_mut() {
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

        for (idx, key) in std::mem::take(&mut self.line_key_map).into_iter() {
            if let Some(pieces) = self.itunes_transliteration_pieces.get(&key) {
                let line = self.result.lines.get_mut(idx).unwrap();
                if !line.is_bg {
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
                    if !word_indices.is_empty() && !pieces_norm.is_empty() {
                        if pieces_norm.len() > word_indices.len() {
                            let last_keep = word_indices.len() - 1;
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
                                line.words[*wi].roman_word = Some(trimmed.into());
                            }
                        }
                    }
                }
            }
        }
    }
}

// Keep these as standalone functions for now as they don't depend on parser state
fn configure_lyric_line(
    e: &BytesStart<'_>,
    read_len: usize,
    main_agent: &[u8],
    line: &mut LyricLine<'_>,
) -> Result<(), TTMLError> {
    for attr in e.attributes() {
        let a = attr.map_err(|err| TTMLError::XmlAttrError(read_len, err))?;
        match a.key.as_ref() {
            b"begin" => {
                if let Ok((_, time)) = super::utils::parse_timestamp(a.value.as_ref()) {
                    line.start_time = time;
                }
            }
            b"end" => {
                if let Ok((_, time)) = super::utils::parse_timestamp(a.value.as_ref()) {
                    line.end_time = time;
                }
            }
            b"ttm:agent" => {
                if a.value.as_ref() != main_agent {
                    line.is_duet = true;
                }
            }
            _ => {}
        }
    }
    Ok(())
}

fn configure_lyric_word(
    e: &BytesStart<'_>,
    read_len: usize,
    word: &mut LyricWord<'_>,
) -> Result<(), TTMLError> {
    for attr in e.attributes() {
        let a = attr.map_err(|err| TTMLError::XmlAttrError(read_len, err))?;
        match a.key.as_ref() {
            b"begin" => {
                if let Ok((_, time)) = super::utils::parse_timestamp(a.value.as_ref()) {
                    word.start_time = time;
                }
            }
            b"end" => {
                if let Ok((_, time)) = super::utils::parse_timestamp(a.value.as_ref()) {
                    word.end_time = time;
                }
            }
            _ => {}
        }
    }
    Ok(())
}
