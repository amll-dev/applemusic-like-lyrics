use std::collections::VecDeque;
use std::sync::{Arc, RwLock as StdRwLock};
use std::time::Duration;

use crate::fft_player::FFTPlayer;
use ffmpeg_next as ffmpeg;
use ffmpeg_next::ChannelLayout;
use rodio::Source;
use rodio::source::SeekError;
use tracing::error;

pub struct FFmpegDecoder {
    audio_stream_index: usize,
    decoder: ffmpeg::decoder::Audio,
    input_ctx: ffmpeg::format::context::Input,
    resampler: ffmpeg::software::resampling::Context,
    fft_resampler: Option<ffmpeg::software::resampling::Context>,
    resampled_frame: ffmpeg::frame::Audio,
    fft_output_frame: ffmpeg::frame::Audio,
    sample_rate: u32,
    channels: u16,
    sample_buffer: VecDeque<f32>,
    fft_player: Arc<StdRwLock<FFTPlayer>>,
}

impl FFmpegDecoder {
    pub fn new(
        input_ctx: ffmpeg::format::context::Input,
        decoder: ffmpeg::decoder::Audio,
        fft_player: Arc<StdRwLock<FFTPlayer>>,
        audio_stream_index: usize,
    ) -> anyhow::Result<Self> {
        let source_format = decoder.format();
        let source_channel_layout = decoder.channel_layout();
        let source_rate = decoder.rate();

        let target_format = ffmpeg::format::Sample::F32(ffmpeg::format::sample::Type::Planar);
        let target_channel_layout = ChannelLayout::STEREO;
        let target_sample_rate = 44100;

        let resampler = ffmpeg::software::resampling::context::Context::get(
            source_format,
            source_channel_layout,
            source_rate,
            target_format,
            target_channel_layout,
            target_sample_rate,
        )?;

        let resampled_frame = ffmpeg::frame::Audio::new(target_format, 0, target_channel_layout);

        let mut fft_output_frame = ffmpeg::frame::Audio::empty();
        fft_output_frame.set_format(ffmpeg::format::Sample::F32(
            ffmpeg::format::sample::Type::Planar,
        ));
        fft_output_frame.set_channel_layout(ChannelLayout::MONO);
        fft_output_frame.set_rate(44100);

        Ok(Self {
            audio_stream_index,
            decoder,
            input_ctx,
            resampler,
            fft_resampler: None,
            resampled_frame,
            fft_output_frame,
            sample_rate: target_sample_rate,
            channels: target_channel_layout.channels() as u16,
            sample_buffer: VecDeque::with_capacity(4096),
            fft_player,
        })
    }

    fn fill_buffer(&mut self) -> Result<bool, ffmpeg::Error> {
        let mut decoded = ffmpeg::frame::Audio::empty();

        while self.decoder.receive_frame(&mut decoded).is_err() {
            match self.input_ctx.packets().next() {
                Some((stream, packet)) => {
                    if stream.index() == self.audio_stream_index {
                        self.decoder.send_packet(&packet)?;
                    }
                }
                None => {
                    self.decoder.send_eof()?;
                    return match self.decoder.receive_frame(&mut decoded) {
                        Ok(_) => Ok(true),
                        Err(ffmpeg::Error::Eof) => Ok(false),
                        Err(err) => Err(err),
                    };
                }
            }
        }

        if self.fft_resampler.is_none() {
            self.fft_resampler = Some(ffmpeg::software::resampling::context::Context::get(
                decoded.format(),
                decoded.channel_layout(),
                decoded.rate(),
                self.fft_output_frame.format(),
                self.fft_output_frame.channel_layout(),
                self.fft_output_frame.rate(),
            )?);
        }

        if let Some(resampler) = self.fft_resampler.as_mut() {
            self.fft_output_frame.set_samples(decoded.samples());
            if resampler.run(&decoded, &mut self.fft_output_frame).is_ok() {
                let data = self.fft_output_frame.plane::<f32>(0);
                self.fft_player.write().unwrap().push_samples(data);
            }
        }

        self.resampled_frame.set_samples(decoded.samples());
        self.resampler.run(&decoded, &mut self.resampled_frame)?;

        let left_channel = self.resampled_frame.plane::<f32>(0);
        let right_channel = self.resampled_frame.plane::<f32>(1);

        for i in 0..self.resampled_frame.samples() {
            self.sample_buffer.push_back(left_channel[i]);
            self.sample_buffer.push_back(right_channel[i]);
        }

        Ok(true)
    }
}

impl Iterator for FFmpegDecoder {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(sample) = self.sample_buffer.pop_front() {
            return Some(sample);
        }

        match self.fill_buffer() {
            Ok(true) => self.sample_buffer.pop_front(),
            Ok(false) => None,
            Err(e) => {
                error!("音频解码错误: {e}");
                None
            }
        }
    }
}

impl Source for FFmpegDecoder {
    fn current_span_len(&self) -> Option<usize> {
        None
    }

    fn channels(&self) -> u16 {
        self.channels
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        let duration_micros = self.input_ctx.duration();
        if duration_micros > 0 {
            Some(Duration::from_micros(duration_micros as u64))
        } else {
            None
        }
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let seek_ts = (pos.as_secs_f64() * ffmpeg::ffi::AV_TIME_BASE as f64) as i64;
        match self.input_ctx.seek(seek_ts, ..) {
            Ok(_) => {
                self.decoder.flush();
                self.sample_buffer.clear();
                Ok(())
            }
            Err(e) => {
                error!("跳转错误: {e}");
                Err(SeekError::NotSupported {
                    underlying_source: "FFmpegDecoder",
                })
            }
        }
    }
}
