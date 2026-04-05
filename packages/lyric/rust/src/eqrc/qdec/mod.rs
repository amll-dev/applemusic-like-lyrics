mod des;

pub struct TripleQDES {
    schdule: [[[u8; 6]; 16]; 3],
}

impl TripleQDES {
    pub fn new(key: &[u8], is_decrypt: bool) -> Self {
        let schdule = des::three_des_key_setup(
            key,
            if is_decrypt {
                des::DesMode::Decrypt
            } else {
                des::DesMode::Encrypt
            },
        );
        Self { schdule }
    }

    #[inline]
    pub fn crypt_inplace(&self, block: &mut [u8; 8]) {
        // debug_assert_eq!(block.len(), 8);
        // block.copy_from_slice(&des::three_des_crypt(block, &self.schdule));
        des::three_des_crypt(block, &self.schdule);
    }
}
