/*********************************************************************
* 警告 WARNING:    本 DES 实现和原 DES 实现不同！
*               仅可用作 QQ Music 的有关加解密操作！
* 本代码原始来自：https://github.com/B-Con/crypto-algorithms/blob/master/des.c
* 根据QQ情况改后：https://github.com/SuJiKiNen/LyricDecoder/blob/master/LyricDecoder/LyricDecoder/QQMusicDES/des.c
* 本改版也进过一定修改以适配 Rust WASM 构建编译
*********************************************************************/

/*********************************************************************
* WARNING:    This implementation of DES is WRONG!
*             Never use this in real cryptography!
*********************************************************************/

/*********************************************************************
* Filename:   des.rs
* Author:     Brad Conte (brad AT radconte.com)
*             Modified by wangqr
*             Rust port
* Copyright:
* Disclaimer: This code is presented "as is" without any guarantees.
* Details:    Implementation of the DES encryption algorithm used by
              QQ Music.
*********************************************************************/

use std::sync::LazyLock;

#[derive(Clone, Copy, PartialEq)]
pub enum DesMode {
    Encrypt = 0,
    Decrypt = 1,
}

// Macros converted to functions for better Rust practices
#[inline]
const fn bitnum(a: &[u8], b: usize, c: usize) -> u32 {
    let byte_idx = (b / 32 * 4) + 3 - (b % 32 / 8);
    let bit_in_byte = 7 - (b % 8);
    ((a[byte_idx] >> bit_in_byte) & 0x01) as (u32) << c
}

#[inline]
const fn bitnumintr(a: u32, b: usize, c: usize) -> u32 {
    ((a >> (31 - b)) & 0x00000001) << c
}

#[inline]
const fn bitnumintl(a: u32, b: usize, c: usize) -> u32 {
    ((a << b) & 0x80000000) >> c
}

#[inline]
const fn sboxbit(a: u8) -> usize {
    ((a & 0x20) | ((a & 0x1f) >> 1) | ((a & 0x01) << 4)) as usize
}

// S-Box constants - QQ Music modified version
static SBOX1: [u8; 64] = [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11,
    9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5,
    11, 3, 14, 10, 0, 6, 13,
];

static SBOX2: [u8; 64] = [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10,
    6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2,
    11, 6, 7, 12, 0, 5, 14, 9,
];

static SBOX3: [u8; 64] = [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14,
    12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7,
    4, 15, 14, 3, 11, 5, 2, 12,
];

static SBOX4: [u8; 64] = [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12,
    1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 10, 13, 8,
    9, 4, 5, 11, 12, 7, 2, 14,
];

static SBOX5: [u8; 64] = [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10,
    3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13,
    6, 15, 0, 9, 10, 4, 5, 3,
];

static SBOX6: [u8; 64] = [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14,
    0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10,
    11, 14, 1, 7, 6, 0, 8, 13,
];

static SBOX7: [u8; 64] = [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12,
    2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7,
    9, 5, 0, 15, 14, 2, 3, 12,
];

static SBOX8: [u8; 64] = [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11,
    0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13,
    15, 12, 9, 0, 3, 5, 6, 11,
];

// S-Box + P-Box combined lookup tables for performance optimization
fn generate_sp_tables() -> [[u32; 64]; 8] {
    let mut sp_tables = [[0u32; 64]; 8];
    let sboxes = [
        &SBOX1, &SBOX2, &SBOX3, &SBOX4, &SBOX5, &SBOX6, &SBOX7, &SBOX8,
    ];

    for s_box_idx in 0..8 {
        for s_box_input in 0..64 {
            let s_box_index = sboxbit(s_box_input as u8);
            let four_bit_output = sboxes[s_box_idx][s_box_index];

            // Place 4-bit S-box output in correct position (28-bit positions)
            let pre_p_box_val = (four_bit_output as u32) << (28 - (s_box_idx * 4));

            // Apply P-box permutation
            let mut post_p_box_val = 0u32;
            for (dest_bit, &source_bit) in P_BOX.iter().enumerate() {
                let dest_mask = 1u32 << (31 - dest_bit);
                let source_mask = 1u32 << (31 - source_bit);
                if (pre_p_box_val & source_mask) != 0 {
                    post_p_box_val |= dest_mask;
                }
            }

            sp_tables[s_box_idx][s_box_input] = post_p_box_val;
        }
    }
    sp_tables
}

// Key schedule constants
static KEY_RND_SHIFT: [usize; 16] = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

static KEY_PERM_C: [usize; 28] = [
    56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59,
    51, 43, 35,
];

static KEY_PERM_D: [usize; 28] = [
    62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4,
    27, 19, 11, 3,
];

static KEY_COMPRESSION: [usize; 48] = [
    13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26, 19, 12, 1, 40, 51,
    30, 36, 46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31,
];

// P-box permutation table (0-based indexing)
static P_BOX: [usize; 32] = [
    15, 6, 19, 20, 28, 11, 27, 16, 0, 14, 22, 25, 4, 17, 30, 9, 1, 7, 23, 13, 31, 26, 2, 8, 18, 12,
    29, 5, 21, 10, 3, 24,
];

// Pre-computed S-Box + P-Box lookup tables
static SP_TABLES: LazyLock<[[u32; 64]; 8]> = LazyLock::new(generate_sp_tables);

// Initial Permutation
fn ip(input: &[u8]) -> [u32; 2] {
    let state0 = bitnum(input, 57, 31)
        | bitnum(input, 49, 30)
        | bitnum(input, 41, 29)
        | bitnum(input, 33, 28)
        | bitnum(input, 25, 27)
        | bitnum(input, 17, 26)
        | bitnum(input, 9, 25)
        | bitnum(input, 1, 24)
        | bitnum(input, 59, 23)
        | bitnum(input, 51, 22)
        | bitnum(input, 43, 21)
        | bitnum(input, 35, 20)
        | bitnum(input, 27, 19)
        | bitnum(input, 19, 18)
        | bitnum(input, 11, 17)
        | bitnum(input, 3, 16)
        | bitnum(input, 61, 15)
        | bitnum(input, 53, 14)
        | bitnum(input, 45, 13)
        | bitnum(input, 37, 12)
        | bitnum(input, 29, 11)
        | bitnum(input, 21, 10)
        | bitnum(input, 13, 9)
        | bitnum(input, 5, 8)
        | bitnum(input, 63, 7)
        | bitnum(input, 55, 6)
        | bitnum(input, 47, 5)
        | bitnum(input, 39, 4)
        | bitnum(input, 31, 3)
        | bitnum(input, 23, 2)
        | bitnum(input, 15, 1)
        | bitnum(input, 7, 0);

    let state1 = bitnum(input, 56, 31)
        | bitnum(input, 48, 30)
        | bitnum(input, 40, 29)
        | bitnum(input, 32, 28)
        | bitnum(input, 24, 27)
        | bitnum(input, 16, 26)
        | bitnum(input, 8, 25)
        | bitnum(input, 0, 24)
        | bitnum(input, 58, 23)
        | bitnum(input, 50, 22)
        | bitnum(input, 42, 21)
        | bitnum(input, 34, 20)
        | bitnum(input, 26, 19)
        | bitnum(input, 18, 18)
        | bitnum(input, 10, 17)
        | bitnum(input, 2, 16)
        | bitnum(input, 60, 15)
        | bitnum(input, 52, 14)
        | bitnum(input, 44, 13)
        | bitnum(input, 36, 12)
        | bitnum(input, 28, 11)
        | bitnum(input, 20, 10)
        | bitnum(input, 12, 9)
        | bitnum(input, 4, 8)
        | bitnum(input, 62, 7)
        | bitnum(input, 54, 6)
        | bitnum(input, 46, 5)
        | bitnum(input, 38, 4)
        | bitnum(input, 30, 3)
        | bitnum(input, 22, 2)
        | bitnum(input, 14, 1)
        | bitnum(input, 6, 0);

    [state0, state1]
}

// Inverse Initial Permutation
const fn inv_ip(state: [u32; 2], output: &mut [u8]) {
    output[3] = (bitnumintr(state[1], 7, 7)
        | bitnumintr(state[0], 7, 6)
        | bitnumintr(state[1], 15, 5)
        | bitnumintr(state[0], 15, 4)
        | bitnumintr(state[1], 23, 3)
        | bitnumintr(state[0], 23, 2)
        | bitnumintr(state[1], 31, 1)
        | bitnumintr(state[0], 31, 0)) as u8;

    output[2] = (bitnumintr(state[1], 6, 7)
        | bitnumintr(state[0], 6, 6)
        | bitnumintr(state[1], 14, 5)
        | bitnumintr(state[0], 14, 4)
        | bitnumintr(state[1], 22, 3)
        | bitnumintr(state[0], 22, 2)
        | bitnumintr(state[1], 30, 1)
        | bitnumintr(state[0], 30, 0)) as u8;

    output[1] = (bitnumintr(state[1], 5, 7)
        | bitnumintr(state[0], 5, 6)
        | bitnumintr(state[1], 13, 5)
        | bitnumintr(state[0], 13, 4)
        | bitnumintr(state[1], 21, 3)
        | bitnumintr(state[0], 21, 2)
        | bitnumintr(state[1], 29, 1)
        | bitnumintr(state[0], 29, 0)) as u8;

    output[0] = (bitnumintr(state[1], 4, 7)
        | bitnumintr(state[0], 4, 6)
        | bitnumintr(state[1], 12, 5)
        | bitnumintr(state[0], 12, 4)
        | bitnumintr(state[1], 20, 3)
        | bitnumintr(state[0], 20, 2)
        | bitnumintr(state[1], 28, 1)
        | bitnumintr(state[0], 28, 0)) as u8;

    output[7] = (bitnumintr(state[1], 3, 7)
        | bitnumintr(state[0], 3, 6)
        | bitnumintr(state[1], 11, 5)
        | bitnumintr(state[0], 11, 4)
        | bitnumintr(state[1], 19, 3)
        | bitnumintr(state[0], 19, 2)
        | bitnumintr(state[1], 27, 1)
        | bitnumintr(state[0], 27, 0)) as u8;

    output[6] = (bitnumintr(state[1], 2, 7)
        | bitnumintr(state[0], 2, 6)
        | bitnumintr(state[1], 10, 5)
        | bitnumintr(state[0], 10, 4)
        | bitnumintr(state[1], 18, 3)
        | bitnumintr(state[0], 18, 2)
        | bitnumintr(state[1], 26, 1)
        | bitnumintr(state[0], 26, 0)) as u8;

    output[5] = (bitnumintr(state[1], 1, 7)
        | bitnumintr(state[0], 1, 6)
        | bitnumintr(state[1], 9, 5)
        | bitnumintr(state[0], 9, 4)
        | bitnumintr(state[1], 17, 3)
        | bitnumintr(state[0], 17, 2)
        | bitnumintr(state[1], 25, 1)
        | bitnumintr(state[0], 25, 0)) as u8;

    output[4] = (bitnumintr(state[1], 0, 7)
        | bitnumintr(state[0], 0, 6)
        | bitnumintr(state[1], 8, 5)
        | bitnumintr(state[0], 8, 4)
        | bitnumintr(state[1], 16, 3)
        | bitnumintr(state[0], 16, 2)
        | bitnumintr(state[1], 24, 1)
        | bitnumintr(state[0], 24, 0)) as u8;
}

// F function - optimized with S-P lookup tables
fn f(state: u32, key: &[u8]) -> u32 {
    // Expansion Permutation
    let t1 = bitnumintl(state, 31, 0)
        | ((state & 0xf0000000) >> 1)
        | bitnumintl(state, 4, 5)
        | bitnumintl(state, 3, 6)
        | ((state & 0x0f000000) >> 3)
        | bitnumintl(state, 8, 11)
        | bitnumintl(state, 7, 12)
        | ((state & 0x00f00000) >> 5)
        | bitnumintl(state, 12, 17)
        | bitnumintl(state, 11, 18)
        | ((state & 0x000f0000) >> 7)
        | bitnumintl(state, 16, 23);

    let t2 = bitnumintl(state, 15, 0)
        | ((state & 0x0000f000) << 15)
        | bitnumintl(state, 20, 5)
        | bitnumintl(state, 19, 6)
        | ((state & 0x00000f00) << 13)
        | bitnumintl(state, 24, 11)
        | bitnumintl(state, 23, 12)
        | ((state & 0x000000f0) << 11)
        | bitnumintl(state, 28, 17)
        | bitnumintl(state, 27, 18)
        | ((state & 0x0000000f) << 9)
        | bitnumintl(state, 0, 23);

    let mut lrgstate = [
        ((t1 >> 24) & 0x000000ff) as u8,
        ((t1 >> 16) & 0x000000ff) as u8,
        ((t1 >> 8) & 0x000000ff) as u8,
        ((t2 >> 24) & 0x000000ff) as u8,
        ((t2 >> 16) & 0x000000ff) as u8,
        ((t2 >> 8) & 0x000000ff) as u8,
    ];

    // Key XOR
    lrgstate
        .iter_mut()
        .zip(key.iter())
        .for_each(|(state_byte, &key_byte)| {
            *state_byte ^= key_byte;
        });

    // Use S-P lookup tables for better performance
    SP_TABLES[0][(lrgstate[0] >> 2) as usize]
        | SP_TABLES[1][(((lrgstate[0] & 0x03) << 4) | (lrgstate[1] >> 4)) as usize]
        | SP_TABLES[2][(((lrgstate[1] & 0x0f) << 2) | (lrgstate[2] >> 6)) as usize]
        | SP_TABLES[3][(lrgstate[2] & 0x3f) as usize]
        | SP_TABLES[4][(lrgstate[3] >> 2) as usize]
        | SP_TABLES[5][(((lrgstate[3] & 0x03) << 4) | (lrgstate[4] >> 4)) as usize]
        | SP_TABLES[6][(((lrgstate[4] & 0x0f) << 2) | (lrgstate[5] >> 6)) as usize]
        | SP_TABLES[7][(lrgstate[5] & 0x3f) as usize]
}

// Key setup
pub fn des_key_setup(key: &[u8], mode: DesMode) -> [[u8; 6]; 16] {
    // Permutated Choice #1
    let mut c = KEY_PERM_C
        .iter()
        .enumerate()
        .fold(0u32, |acc, (i, &perm)| acc | bitnum(key, perm, 31 - i));

    let mut d = KEY_PERM_D
        .iter()
        .enumerate()
        .fold(0u32, |acc, (i, &perm)| acc | bitnum(key, perm, 31 - i));

    let mut schedule = [[0u8; 6]; 16];

    // Generate the 16 subkeys
    for (i, &shift) in KEY_RND_SHIFT.iter().enumerate() {
        c = ((c << shift) | (c >> (28 - shift))) & 0xfffffff0;
        d = ((d << shift) | (d >> (28 - shift))) & 0xfffffff0;

        let to_gen = match mode {
            DesMode::Decrypt => 15 - i,
            DesMode::Encrypt => i,
        };

        // Initialize the array
        schedule[to_gen] = [0; 6];

        // Generate subkey - process first 24 compression values for c register
        KEY_COMPRESSION
            .iter()
            .take(24)
            .enumerate()
            .for_each(|(j, &comp)| {
                schedule[to_gen][j / 8] |= bitnumintr(c, comp, 7 - (j % 8)) as u8;
            });

        // Process remaining 24 compression values for d register
        KEY_COMPRESSION
            .iter()
            .skip(24)
            .enumerate()
            .for_each(|(j, &comp)| {
                schedule[to_gen][(j + 24) / 8] |=
                    bitnumintr(d, comp - 27, 7 - ((j + 24) % 8)) as u8;
            });
    }

    schedule
}

// DES encryption/decryption
pub fn des_crypt(input: &[u8], key_schedule: &[[u8; 6]; 16]) -> [u8; 8] {
    let mut state = ip(input);

    // Process rounds 0-14 with state swap
    key_schedule.iter().take(15).for_each(|key| {
        let temp = state[1];
        state[1] = f(state[1], key) ^ state[0];
        state[0] = temp;
    });

    // Final round without swap
    state[0] ^= f(state[1], &key_schedule[15]);

    let mut output = [0u8; 8];
    inv_ip(state, &mut output);
    output
}

// Triple DES key setup
pub fn three_des_key_setup(key: &[u8], mode: DesMode) -> [[[u8; 6]; 16]; 3] {
    match mode {
        DesMode::Encrypt => [
            des_key_setup(key.get(0..8).unwrap(), DesMode::Encrypt),
            des_key_setup(key.get(8..16).unwrap(), DesMode::Decrypt),
            des_key_setup(key.get(16..24).unwrap(), DesMode::Encrypt),
        ],
        DesMode::Decrypt => [
            des_key_setup(key.get(16..24).unwrap(), DesMode::Decrypt),
            des_key_setup(key.get(8..16).unwrap(), DesMode::Encrypt),
            des_key_setup(key.get(0..8).unwrap(), DesMode::Decrypt),
        ],
    }
}

// Triple DES encryption/decryption - in-place update
pub fn three_des_crypt(input: &mut [u8; 8], key_schedule: &[[[u8; 6]; 16]; 3]) {
    *input = des_crypt(input, &key_schedule[0]);
    *input = des_crypt(input, &key_schedule[1]);
    *input = des_crypt(input, &key_schedule[2]);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_des_encrypt_decrypt() {
        let key = [0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF];
        let plaintext = [0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF];

        let encrypt_schedule = des_key_setup(&key, DesMode::Encrypt);
        let decrypt_schedule = des_key_setup(&key, DesMode::Decrypt);

        let ciphertext = des_crypt(&plaintext, &encrypt_schedule);
        let decrypted = des_crypt(&ciphertext, &decrypt_schedule);

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_three_des() {
        let key = [
            0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54,
            0x32, 0x10, 0x89, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67,
        ];
        let plaintext = [0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF];

        let encrypt_schedule = three_des_key_setup(&key, DesMode::Encrypt);
        let decrypt_schedule = three_des_key_setup(&key, DesMode::Decrypt);

        let mut ciphertext = plaintext;
        three_des_crypt(&mut ciphertext, &encrypt_schedule);

        let mut decrypted = ciphertext;
        three_des_crypt(&mut decrypted, &decrypt_schedule);

        assert_eq!(plaintext, decrypted);
    }
}
