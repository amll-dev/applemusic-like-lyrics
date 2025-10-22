use spectrum_analyzer::*;
use std::{collections::VecDeque, time::Instant};

/// 一个接收音频 PCM 数据并转换成频谱的伪播放结构
/// 该结构会将传入的音频数据转换为单通道音频数据，然后进行频谱分析
pub struct FFTPlayer {
    last_fft_time: Instant,
    result_buf: [f32; 2048],
    pcm_queue: VecDeque<f32>,
    freq_range: (f32, f32),
}

// numpy.interp()
#[allow(unused)]
fn vec_interp(src: &[f32], dst: &mut [f32]) {
    if src.is_empty() {
        dst.fill(0.0);
        return;
    }
    if dst.is_empty() {
        return;
    }
    if src.len() == dst.len() {
        dst.copy_from_slice(src);
        return;
    }
    let src_len = src.len();
    let dst_len = dst.len();
    let src_step = src_len as f32 / dst_len as f32;
    let mut src_idx = 0.0;
    for dst in dst.iter_mut() {
        let src_idx_int = src_idx as usize;
        let src_idx_frac = src_idx - src_idx_int as f32;
        let src_idx_next = src_idx + src_step;
        let src_idx_next_int = src_idx_next as usize;
        let src_idx_next_frac = src_idx_next - src_idx_next_int as f32;
        let src_idx_next_frac_inv = 1.0 - src_idx_next_frac;
        let src_idx_frac_inv = 1.0 - src_idx_frac;
        let v = if src_idx_next_int < src_len {
            src[src_idx_int] * src_idx_frac_inv * src_idx_next_frac_inv
                + src[src_idx_next_int] * src_idx_frac * src_idx_next_frac_inv
        } else {
            src[src_idx_int] * src_idx_frac_inv
        };
        *dst = v;
        src_idx += src_step;
    }
}

impl FFTPlayer {
    pub fn new() -> Self {
        Self {
            last_fft_time: Instant::now(),
            result_buf: [0.0; 2048],
            pcm_queue: VecDeque::with_capacity(4096),
            freq_range: (80.0, 2000.0),
        }
    }

    pub fn has_data(&self) -> bool {
        !self.pcm_queue.is_empty()
    }

    pub fn clear(&mut self) {
        self.pcm_queue.clear();
    }

    pub fn set_freq_range(&mut self, start_freq: f32, end_freq: f32) {
        self.freq_range = (start_freq, end_freq);
    }

    pub fn push_samples(&mut self, samples: &[f32]) {
        self.pcm_queue.extend(samples);
    }

    pub fn read(&mut self, buf: &mut [f32]) -> bool {
        if self.pcm_queue.len() < 2048 {
            self.last_fft_time = Instant::now();
            return false;
        }

        let (start_freq, end_freq) = self.freq_range;

        let mut fft_buf = [0.0; 2048];
        self.pcm_queue
            .iter()
            .take(2048)
            .enumerate()
            .for_each(|(i, v)| {
                fft_buf[i] = *v;
            });

        let fft_buf = windows::hamming_window(&fft_buf);

        match samples_fft_to_spectrum(
            &fft_buf,
            44100,
            FrequencyLimit::Range(start_freq, end_freq),
            Some(&scaling::divide_by_N_sqrt),
        ) {
            Ok(spec) => {
                let result_buf_len = self.result_buf.len() as f32;
                let freq_min = spec.min_fr().val();
                let freq_max = spec.max_fr().val();
                let freq_range = freq_max - freq_min;
                self.result_buf.iter_mut().enumerate().for_each(|(i, v)| {
                    let freq = i as f32 / result_buf_len * freq_range + freq_min;
                    let freq = freq.clamp(freq_min, freq_max);
                    *v += spec.freq_val_exact(freq).val();
                    *v /= 2.0;
                });
                vec_interp(&self.result_buf, buf);

                let elapsed = self.last_fft_time.elapsed();
                let elapsed_sec = elapsed.as_secs_f64();
                self.last_fft_time = Instant::now();

                let cut_len = (elapsed_sec * 44100.0) as usize;
                for _ in 0..cut_len {
                    self.pcm_queue.pop_front();
                }
                self.pcm_queue.truncate(2048 * 4);
                true
            }
            Err(e) => {
                eprintln!("FFT error: {:?}", e);
                false
            }
        }
    }
}
