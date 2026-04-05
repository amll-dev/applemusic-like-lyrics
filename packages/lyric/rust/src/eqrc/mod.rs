//! 针对加密的 QRC （此处定义为 Encrypted QRC (EQRC)）格式的解密模块
//!
//! 参考自 <https://github.com/WXRIW/Lyricify-Lyrics-Helper/blob/07d495c3b36ef24dbe5bc29c261e77bd16ff15d0/Lyricify.Lyrics.Helper/Decrypter/Qrc/Helper.cs#L49>
use std::sync::LazyLock;

pub(super) mod qdec;

const DEC_KEY: &[u8; 24] = b"!@#)(*$%123ZXC!@!@#)(NHL";

static CIPHER: LazyLock<qdec::TripleQDES> = LazyLock::new(|| qdec::TripleQDES::new(DEC_KEY, true));

fn decode_hex(s: &str) -> Vec<u8> {
    if s.len() % 2 == 0 {
        (0..s.len())
            .step_by(2)
            .filter_map(|i| s.get(i..i + 2).map(|sub| u8::from_str_radix(sub, 16).ok()))
            .flatten()
            .collect()
    } else {
        vec![]
    }
}

pub fn decrypt_qrc_raw(data: &mut [u8]) -> String {
    for chunk in data.chunks_exact_mut(8) {
        let chunk = chunk.try_into().unwrap();
        CIPHER.crypt_inplace(chunk);
    }

    // 考虑到 WASM 环境不适合用 rayon 并行处理，暂时注释掉并行处理的代码，理论上启用后能将解密速度提升至少3倍
    // use rayon::prelude::*;
    // data.par_chunks_exact(8)
    //     .for_each(|chunk| {
    //         let mut chunk = chunk.try_into().unwrap();
    //         CIPHER.crypt_inplace(&mut chunk);
    //     });

    let decompressed = miniz_oxide::inflate::decompress_to_vec_zlib(data).unwrap_or_default();

    String::from_utf8_lossy(&decompressed).to_string()
}

pub fn decrypt_qrc_hex(hex_data: &str) -> String {
    let mut hex_data = decode_hex(hex_data);
    decrypt_qrc_raw(&mut hex_data)
}
