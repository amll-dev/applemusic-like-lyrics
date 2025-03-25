#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use std::io::Cursor;

use quick_xml::{Writer, events::*};

use super::TTMLLyric;

pub fn stringify_ttml(lyric: &TTMLLyric) -> Result<String, quick_xml::Error> {
    // let mut writer =
    //     Writer::new_with_indent(Cursor::new(Vec::<u8>::with_capacity(64 * 1024)), b' ', 4);
    let mut writer = Writer::new(Cursor::new(Vec::<u8>::with_capacity(64 * 1024)));

    writer.write_event(Event::Start(BytesStart::new("tt").with_attributes([
        ("xmlns", "http://www.w3.org/ns/ttml"),
        ("xmlns:ttm", "http://www.w3.org/ns/ttml#metadata"),
        ("xmlns:amll", "http://www.example.com/ns/amll"),
        ("xmlns:itunes", "http://music.apple.com/lyric-ttml-internal"),
    ])))?;

    {
        writer.write_event(Event::Start(BytesStart::new("head")))?;
        {
            writer.write_event(Event::Start(BytesStart::new("metadata")))?;
            {
                let has_duet = lyric.lines.iter().any(|line| line.is_duet);
                writer.write_event(Event::Empty(
                    BytesStart::new("ttm:agent")
                        .with_attributes([("type", "person"), ("xml:id", "v1")]),
                ))?;
                if has_duet {
                    writer.write_event(Event::Empty(
                        BytesStart::new("ttm:agent")
                            .with_attributes([("type", "other"), ("xml:id", "v2")]),
                    ))?;
                }
                for (meta_key, meta_values) in lyric.metadata.iter() {
                    for meta_value in meta_values {
                        writer.write_event(Event::Empty(
                            BytesStart::new("amll:meta").with_attributes([
                                ("key", meta_key.as_ref()),
                                ("value", meta_value.as_ref()),
                            ]),
                        ))?;
                    }
                }
            }
            writer.write_event(Event::End(BytesEnd::new("metadata")))?;
        }
        writer.write_event(Event::End(BytesEnd::new("head")))?;

        let guess_duration = lyric
            .lines
            .last()
            .map(|line| {
                line.end_time
                    .max(line.words.last().map(|x| x.end_time).unwrap_or_default())
            })
            .unwrap_or_default();
        let guess_duration_ts = ms_to_timestamp(guess_duration);
        writer.write_event(Event::Start(
            BytesStart::new("body").with_attributes([("dur", guess_duration_ts.as_str())]),
        ))?;
        {
            writer.write_event(Event::Start(BytesStart::new("div")))?;
            {
                let mut line_it = lyric.lines.iter().peekable();
                let mut line_i = 0;
                while let Some(line) = line_it.next() {
                    if line
                        .words
                        .iter()
                        .map(|x| x.word.trim().len())
                        .sum::<usize>()
                        == 0
                    {
                        continue;
                    }
                    let begin_ts = ms_to_timestamp(line.start_time);
                    let end_ts = ms_to_timestamp(line.end_time);
                    line_i += 1;
                    writer.write_event(Event::Start(BytesStart::new("p").with_attributes([
                        ("begin", begin_ts.as_str()),
                        ("end", end_ts.as_str()),
                        ("ttm:agent", if line.is_duet { "v2" } else { "v1" }),
                        ("itunes:key", &format!("L{line_i}")),
                    ])))?;

                    for word in &line.words {
                        let begin_ts = ms_to_timestamp(word.start_time);
                        let end_ts = ms_to_timestamp(word.end_time);
                        if word.word.trim().is_empty() {
                            writer.write_event(Event::Text(BytesText::new(word.word.as_ref())))?;
                        } else {
                            writer.write_event(Event::Start(
                                BytesStart::new("span").with_attributes([
                                    ("begin", begin_ts.as_str()),
                                    ("end", end_ts.as_str()),
                                ]),
                            ))?;
                            writer.write_event(Event::Text(BytesText::new(word.word.as_ref())))?;
                            writer.write_event(Event::End(BytesEnd::new("span")))?;
                        }
                    }

                    if let Some(next_line) = line_it.peek() {
                        if next_line.is_bg {
                            let begin_ts = ms_to_timestamp(next_line.start_time);
                            let end_ts = ms_to_timestamp(next_line.end_time);
                            writer.write_event(Event::Start(
                                BytesStart::new("span").with_attributes([
                                    ("ttm:role", "x-bg"),
                                    ("begin", begin_ts.as_str()),
                                    ("end", end_ts.as_str()),
                                ]),
                            ))?;

                            for word in &next_line.words {
                                let begin_ts = ms_to_timestamp(word.start_time);
                                let end_ts = ms_to_timestamp(word.end_time);
                                if word.word.trim().is_empty() {
                                    writer.write_event(Event::Text(BytesText::new(
                                        word.word.as_ref(),
                                    )))?;
                                } else {
                                    writer.write_event(Event::Start(
                                        BytesStart::new("span").with_attributes([
                                            ("begin", begin_ts.as_str()),
                                            ("end", end_ts.as_str()),
                                        ]),
                                    ))?;
                                    writer.write_event(Event::Text(BytesText::new(
                                        word.word.as_ref(),
                                    )))?;
                                    writer.write_event(Event::End(BytesEnd::new("span")))?;
                                }
                            }

                            if !next_line.translated_lyric.is_empty() {
                                writer.write_event(Event::Start(
                                    BytesStart::new("span").with_attributes([
                                        ("ttm:role", "x-translation"),
                                        ("xml:lang", "zh-CN"),
                                    ]),
                                ))?;
                                writer.write_event(Event::Text(BytesText::new(
                                    &next_line.translated_lyric,
                                )))?;
                                writer.write_event(Event::End(BytesEnd::new("span")))?;
                            }

                            if !next_line.roman_lyric.is_empty() {
                                writer.write_event(Event::Start(
                                    BytesStart::new("span")
                                        .with_attributes([("ttm:role", "x-roman")]),
                                ))?;
                                writer.write_event(Event::Text(BytesText::new(
                                    &next_line.roman_lyric,
                                )))?;
                                writer.write_event(Event::End(BytesEnd::new("span")))?;
                            }

                            writer.write_event(Event::End(BytesEnd::new("span")))?;

                            line_it.next();
                        }

                        if !line.translated_lyric.is_empty() {
                            writer.write_event(Event::Start(
                                BytesStart::new("span").with_attributes([
                                    ("ttm:role", "x-translation"),
                                    ("xml:lang", "zh-CN"),
                                ]),
                            ))?;
                            writer
                                .write_event(Event::Text(BytesText::new(&line.translated_lyric)))?;
                            writer.write_event(Event::End(BytesEnd::new("span")))?;
                        }

                        if !line.roman_lyric.is_empty() {
                            writer.write_event(Event::Start(
                                BytesStart::new("span").with_attributes([("ttm:role", "x-roman")]),
                            ))?;
                            writer.write_event(Event::Text(BytesText::new(&line.roman_lyric)))?;
                            writer.write_event(Event::End(BytesEnd::new("span")))?;
                        }
                    }
                    writer.write_event(Event::End(BytesEnd::new("p")))?;
                }
            }
            writer.write_event(Event::End(BytesEnd::new("div")))?;
        }
        writer.write_event(Event::End(BytesEnd::new("body")))?;
    }

    writer.write_event(Event::End(BytesEnd::new("tt")))?;
    writer.write_event(Event::Eof)?;

    Ok(String::from_utf8(writer.into_inner().into_inner()).unwrap())
}

#[cfg(all(target_arch = "wasm32", feature = "serde"))]
#[wasm_bindgen(js_name = "stringifyTTML", skip_typescript)]
pub fn stringify_ttml_js(lrc: JsValue) -> String {
    let lyric: TTMLLyric = serde_wasm_bindgen::from_value(lrc).unwrap();
    stringify_ttml(&lyric).unwrap()
}

#[test]
fn test_write_ttml() {
    const TEST_TTML: &str = include_str!("../../test/test.ttml");
    let ttml = super::parse_ttml(TEST_TTML.as_bytes()).unwrap();
    let ttml_str = stringify_ttml(&ttml).unwrap();
    println!("ttml_str: {}", ttml_str);
    let ttml = super::parse_ttml(ttml_str.as_bytes()).unwrap();
    let new_ttml_str = stringify_ttml(&ttml).unwrap();
    println!("new_ttml_str: {}", new_ttml_str);
    assert_eq!(ttml_str, new_ttml_str);
}

// TODO: 优化性能
fn ms_to_timestamp(time_ms: u64) -> String {
    let time = time_ms;
    if time == 0 {
        return "00:00.000".to_string();
    } else if time == u64::MAX {
        return "99:99.999".to_string();
    }
    let ms = time % 1000;
    let time = time / 1000;
    let s = time % 60;
    let time = time / 60;
    let m = time % 60;
    let h = time / 60;

    if h > 0 {
        format!("{h}:{m:02}:{s:02}.{ms:03}")
    } else if m > 0 {
        format!("{m}:{s:02}.{ms:03}")
    } else {
        format!("{s}.{ms:03}")
    }
}
