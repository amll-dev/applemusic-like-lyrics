use binrw::{BinRead, BinResult, BinWrite, Endian, binrw};
use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, Write};

#[derive(Clone, Eq, PartialEq, Default, Debug, Serialize, Deserialize)]
pub struct NullString(pub String);

impl AsRef<str> for NullString {
    fn as_ref(&self) -> &str {
        &self.0
    }
}
impl std::ops::Deref for NullString {
    type Target = String;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl From<&str> for NullString {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}
impl From<String> for NullString {
    fn from(s: String) -> Self {
        Self(s)
    }
}
impl From<NullString> for String {
    fn from(value: NullString) -> Self {
        value.0
    }
}

impl BinRead for NullString {
    type Args<'a> = ();

    fn read_options<R: Read + Seek>(
        reader: &mut R,
        _endian: Endian,
        _args: Self::Args<'_>,
    ) -> BinResult<Self> {
        let mut bytes = Vec::new();
        loop {
            let byte: u8 = BinRead::read_options(reader, Endian::Little, ())?;
            if byte == 0 {
                break;
            }
            bytes.push(byte);
        }

        let cow = String::from_utf8_lossy(&bytes);

        // cow 被分配了新的内存，意味着有替换发生
        if let std::borrow::Cow::Owned(_) = cow {
            #[cfg(feature = "tracing")]
            tracing::warn!("A non-UTF8 byte sequence was found when parsing NullString");
        }

        Ok(Self(cow.into_owned()))
    }
}

impl BinWrite for NullString {
    type Args<'a> = ();

    fn write_options<W: Write + Seek>(
        &self,
        writer: &mut W,
        _endian: Endian,
        _args: Self::Args<'_>,
    ) -> BinResult<()> {
        writer.write_all(self.0.as_bytes())?;
        writer.write_all(&[0u8])?;
        Ok(())
    }
}

#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: NullString,
    pub name: NullString,
}

#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LyricWord {
    pub start_time: u64,
    pub end_time: u64,
    pub word: NullString,
    // 为了确保向后兼容性，故意在二进制协议中忽略了这个字段，若要传输它，请使用v2协议
    #[brw(ignore)]
    #[serde(default)]
    pub roman_word: NullString,
}

#[binrw]
#[brw(little)]
#[derive(Deserialize, Serialize, PartialEq, Eq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub start_time: u64,
    pub end_time: u64,
    #[bw(try_calc = u32::try_from(words.len()))]
    size: u32,
    #[br(count = size)]
    pub words: Vec<LyricWord>,
    #[serde(default)]
    pub translated_lyric: NullString,
    #[serde(default)]
    pub roman_lyric: NullString,
    #[serde(skip)]
    #[bw(calc = u8::from(*is_bg) | (u8::from(*is_duet) << 1))]
    flag: u8,
    #[serde(default, rename = "isBG")]
    #[br(calc = flag & 0b01 != 0)]
    #[bw(ignore)]
    pub is_bg: bool,
    #[serde(default)]
    #[br(calc = flag & 0b10 != 0)]
    #[bw(ignore)]
    pub is_duet: bool,
}
