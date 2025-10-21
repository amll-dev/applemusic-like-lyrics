use std::fs::File;
use std::sync::{Arc, RwLock as StdRwLock};
use std::time::Duration;

use crate::fft_player::FFTPlayer;
use anyhow::Context;
use rodio::Source;
use rodio::source::SeekError;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{Decoder, DecoderOptions};
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::units::{Time, TimeBase};

pub struct SymphoniaDecoder {
    reader: Box<dyn FormatReader>,
    decoder: Box<dyn Decoder>,
    current_frame: Vec<f32>,
    current_frame_pos: usize,
    sample_rate: u32,
    channels: u16,
    time_base: TimeBase,
    n_frames: Option<u64>,
    fft_player: Arc<StdRwLock<FFTPlayer>>,
}

impl SymphoniaDecoder {
    pub fn new(file_path: &str, fft_player: Arc<StdRwLock<FFTPlayer>>) -> anyhow::Result<Self> {
        let src = File::open(file_path)?;
        let mss = MediaSourceStream::new(Box::new(src), Default::default());

        let format_opts = FormatOptions {
            prebuild_seek_index: true,
            ..Default::default()
        };
        let metadata_opts: MetadataOptions = Default::default();

        let probed = symphonia::default::get_probe().format(
            &symphonia::core::probe::Hint::new(),
            mss,
            &format_opts,
            &metadata_opts,
        )?;

        let track = probed
            .format
            .default_track()
            .context("No default track")?
            .clone();
        let n_frames = track.codec_params.n_frames;
        let time_base = track.codec_params.time_base.context("No time base")?;
        let sample_rate = track.codec_params.sample_rate.context("No sample rate")?;
        let channels = track.codec_params.channels.context("No channels")?.count() as u16;

        let decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &DecoderOptions { verify: true })?;

        Ok(Self {
            reader: probed.format,
            decoder,
            current_frame: Vec::new(),
            current_frame_pos: 0,
            sample_rate,
            channels,
            time_base,
            n_frames,
            fft_player,
        })
    }
}

impl Iterator for SymphoniaDecoder {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current_frame_pos < self.current_frame.len() {
            let sample = self.current_frame[self.current_frame_pos];
            self.current_frame_pos += 1;
            return Some(sample);
        }

        loop {
            match self.reader.next_packet() {
                Ok(packet) => match self.decoder.decode(&packet) {
                    Ok(decoded) => {
                        self.fft_player.write().unwrap().push_data(&decoded);

                        let mut sample_buf =
                            SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
                        sample_buf.copy_interleaved_ref(decoded);

                        self.current_frame = sample_buf.samples().to_vec();
                        self.current_frame_pos = 1;
                        return self.current_frame.get(0).copied();
                    }
                    Err(_) => continue,
                },
                Err(_) => return None,
            }
        }
    }
}

impl Source for SymphoniaDecoder {
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
        if let Some(n_frames) = self.n_frames {
            let time = self.time_base.calc_time(n_frames);
            return Some(Duration::from_secs(time.seconds) + Duration::from_secs_f64(time.frac));
        }
        None
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let seek_to = SeekTo::Time {
            time: Time::from(pos.as_secs_f64()),
            track_id: None,
        };
        match self.reader.seek(SeekMode::Accurate, seek_to) {
            Ok(_) => {
                self.current_frame_pos = self.current_frame.len();
                self.decoder.reset();
                Ok(())
            }
            Err(_) => Err(SeekError::NotSupported {
                underlying_source: "SymphoniaDecoder",
            }),
        }
    }
}
