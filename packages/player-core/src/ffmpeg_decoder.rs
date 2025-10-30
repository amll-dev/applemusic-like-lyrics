use std::collections::VecDeque;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
    mpsc::{self, Receiver, Sender, SyncSender},
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::{
    audio_quality::AudioQuality, fft_player::FFTPlayer, player::AudioInfo, utils::read_audio_info,
};
use anyhow::Context;
use ffmpeg_next as ffmpeg;
use ffmpeg_next::{ChannelLayout, format};
use parking_lot::{Condvar, Mutex, RwLock};
use rodio::Source;
use rodio::source::SeekError;
use tracing::{error, warn};

const FRAME_BUFFER_CAPACITY: usize = 64;
const FFT_TARGET_RATE: u32 = 44100;

struct AudioChunk {
    player_samples: Vec<f32>,
    fft_samples: Vec<f32>,
}

struct Shared {
    buffer: Mutex<VecDeque<AudioChunk>>,
    is_eof: AtomicBool,
    is_stopping: AtomicBool,
    condvar: Condvar,
}

pub enum ControlMessage {
    Seek(Duration),
}

struct DecoderMetadata {
    total_duration: Option<Duration>,
    audio_info: AudioInfo,
    audio_quality: AudioQuality,
}

pub struct FFmpegDecoder {
    shared: Arc<Shared>,
    decoder_thread: Option<JoinHandle<()>>,
    control_tx: Sender<ControlMessage>,
    sample_rate: u32,
    channels: u16,
    total_duration: Option<Duration>,
    audio_info: AudioInfo,
    audio_quality: AudioQuality,
    local_buffer: VecDeque<f32>,
    fft_player: Arc<RwLock<FFTPlayer>>,
}

struct DecoderInitData {
    input_ctx: ffmpeg::format::context::Input,
    decoder: ffmpeg::decoder::Audio,
    audio_stream_index: usize,
    resampler: Option<ffmpeg::software::resampling::context::Context>,
    fft_resampler: Option<ffmpeg::software::resampling::context::Context>,
    total_duration: Option<Duration>,
    audio_info: AudioInfo,
    audio_quality: AudioQuality,
}

#[derive(Clone)]
pub struct FFmpegDecoderHandle {
    control_tx: Sender<ControlMessage>,
}

impl FFmpegDecoderHandle {
    pub fn seek(&self, pos: Duration) -> Result<(), mpsc::SendError<ControlMessage>> {
        self.control_tx.send(ControlMessage::Seek(pos))
    }
}

impl FFmpegDecoder {
    pub fn new(
        path: String,
        fft_player: Arc<RwLock<FFTPlayer>>,
        target_channels: u16,
        target_sample_rate: u32,
    ) -> anyhow::Result<(Self, FFmpegDecoderHandle)> {
        let shared = Arc::new(Shared {
            buffer: Mutex::new(VecDeque::with_capacity(FRAME_BUFFER_CAPACITY)),
            is_eof: AtomicBool::new(false),
            is_stopping: AtomicBool::new(false),
            condvar: Condvar::new(),
        });

        let (control_tx, control_rx) = mpsc::channel();
        let (init_tx, init_rx) = mpsc::sync_channel(1);

        let decoder_thread = {
            let shared = shared.clone();
            thread::spawn(move || {
                decoder_thread_entry(
                    path,
                    target_channels,
                    target_sample_rate,
                    shared,
                    control_rx,
                    init_tx,
                );
            })
        };

        let metadata = init_rx.recv()??;

        let handle = FFmpegDecoderHandle {
            control_tx: control_tx.clone(),
        };

        let decoder = Self {
            shared,
            decoder_thread: Some(decoder_thread),
            control_tx,
            sample_rate: target_sample_rate,
            channels: target_channels,
            total_duration: metadata.total_duration,
            audio_info: metadata.audio_info,
            audio_quality: metadata.audio_quality,
            local_buffer: VecDeque::new(),
            fft_player,
        };

        Ok((decoder, handle))
    }

    pub fn audio_info(&self) -> AudioInfo {
        self.audio_info.clone()
    }

    pub fn audio_quality(&self) -> AudioQuality {
        self.audio_quality.clone()
    }
}

fn decoder_thread_entry(
    path: String,
    target_channels: u16,
    target_sample_rate: u32,
    shared: Arc<Shared>,
    control_rx: Receiver<ControlMessage>,
    init_tx: SyncSender<anyhow::Result<DecoderMetadata>>,
) {
    let init_result = setup_decoder_resources(&path, target_channels, target_sample_rate);

    let mut init_data = match init_result {
        Ok(data) => {
            let metadata = DecoderMetadata {
                total_duration: data.total_duration,
                audio_info: data.audio_info.clone(),
                audio_quality: data.audio_quality.clone(),
            };
            if init_tx.send(Ok(metadata)).is_err() {
                return;
            }
            data
        }
        Err(e) => {
            let _ = init_tx.send(Err(e));
            return;
        }
    };

    run_decoding_loop(&mut init_data, shared, &control_rx);
}

fn setup_decoder_resources(
    path: &str,
    target_channels: u16,
    target_sample_rate: u32,
) -> anyhow::Result<DecoderInitData> {
    let mut input_ctx = format::input(&path).with_context(|| format!("打开 {path} 文件失败"))?;
    let mut audio_info = read_audio_info(&mut input_ctx);

    let stream = input_ctx
        .streams()
        .best(ffmpeg::media::Type::Audio)
        .context("找不到音频流")?;
    let audio_stream_index = stream.index();

    let time_base = stream.time_base();
    let duration = stream.duration();
    if duration > 0 {
        audio_info.duration = duration as f64 * time_base.0 as f64 / time_base.1 as f64;
    }

    let decoder_ctx = ffmpeg::codec::context::Context::from_parameters(stream.parameters())?;
    let decoder = decoder_ctx.decoder().audio()?;
    let audio_quality = AudioQuality::from_ffmpeg_decoder(&decoder);

    let source_format = decoder.format();
    let source_channel_layout = decoder.channel_layout();
    let source_rate = decoder.rate();

    let target_format = ffmpeg::format::Sample::F32(ffmpeg::format::sample::Type::Planar);
    let target_channel_layout = ChannelLayout::default(target_channels as i32);

    let resampler = create_resampler(
        source_format,
        source_channel_layout,
        source_rate,
        target_format,
        target_channel_layout,
        target_sample_rate,
    )?;

    let fft_resampler = create_resampler(
        source_format,
        source_channel_layout,
        source_rate,
        ffmpeg::format::Sample::F32(ffmpeg::format::sample::Type::Planar),
        ChannelLayout::MONO,
        FFT_TARGET_RATE,
    )?;

    let total_duration = if input_ctx.duration() > 0 {
        Some(Duration::from_micros(input_ctx.duration() as u64))
    } else {
        None
    };

    Ok(DecoderInitData {
        input_ctx,
        decoder,
        audio_stream_index,
        resampler,
        fft_resampler,
        total_duration,
        audio_info,
        audio_quality,
    })
}

fn run_decoding_loop(
    data: &mut DecoderInitData,
    shared: Arc<Shared>,
    control_rx: &Receiver<ControlMessage>,
) {
    let mut player_scratch_buf = Vec::new();
    let mut fft_scratch_buf = Vec::new();

    'main_loop: loop {
        if let Ok(msg) = control_rx.try_recv() {
            match msg {
                ControlMessage::Seek(pos) => {
                    let seek_ts = (pos.as_secs_f64() * ffmpeg::ffi::AV_TIME_BASE as f64) as i64;
                    if data.input_ctx.seek(seek_ts, ..).is_ok() {
                        data.decoder.flush();
                        let mut buffer = shared.buffer.lock();
                        buffer.clear();
                        shared.is_eof.store(false, Ordering::SeqCst);
                        shared.condvar.notify_all();
                    } else {
                        error!("跳转失败");
                    }
                    continue 'main_loop;
                }
            }
        }

        {
            let mut buffer = shared.buffer.lock();
            while buffer.len() >= FRAME_BUFFER_CAPACITY
                && !shared.is_stopping.load(Ordering::Acquire)
            {
                shared.condvar.wait(&mut buffer);
            }

            if shared.is_stopping.load(Ordering::Acquire) {
                break 'main_loop;
            }
        }

        let mut decoded = ffmpeg::frame::Audio::empty();
        match data.decoder.receive_frame(&mut decoded) {
            Ok(_) => {}
            Err(ffmpeg::Error::Eof) => {
                shared.is_eof.store(true, Ordering::Release);
                shared.condvar.notify_all();
                break 'main_loop;
            }
            Err(ffmpeg::Error::Other {
                errno: ffmpeg::ffi::EAGAIN,
            }) => {
                match data.input_ctx.packets().next() {
                    Some((stream, packet)) if stream.index() == data.audio_stream_index => {
                        if data.decoder.send_packet(&packet).is_err() {
                            error!("向解码器发送数据包失败");
                            break 'main_loop;
                        }
                    }
                    None => {
                        if data.decoder.send_eof().is_err() {
                            error!("向解码器发送 EOF 失败");
                        }
                    }
                    _ => {}
                }
                continue 'main_loop;
            }
            Err(e) => {
                error!("receive_frame 错误: {e}");
                break 'main_loop;
            }
        }
        player_scratch_buf.clear();
        fft_scratch_buf.clear();

        resample_frame(
            data,
            &decoded,
            &mut player_scratch_buf,
            &mut fft_scratch_buf,
        );

        let chunk = AudioChunk {
            player_samples: std::mem::take(&mut player_scratch_buf),
            fft_samples: std::mem::take(&mut fft_scratch_buf),
        };

        let mut buffer = shared.buffer.lock();
        buffer.push_back(chunk);
        shared.condvar.notify_one();
    }
    shared.is_eof.store(true, Ordering::Release);
    shared.condvar.notify_all();
}

fn resample_frame(
    data: &mut DecoderInitData,
    decoded: &ffmpeg::frame::Audio,
    player_buf: &mut Vec<f32>,
    fft_buf: &mut Vec<f32>,
) {
    {
        if let Some(resampler_ctx) = &mut data.resampler {
            let target_rate = resampler_ctx.output().rate;
            let target_layout = resampler_ctx.output().channel_layout;
            let target_format = resampler_ctx.output().format;

            let output_samples = (decoded.samples() as f64 * target_rate as f64
                / decoded.rate() as f64)
                .ceil() as usize;

            let mut resampled_frame =
                ffmpeg::frame::Audio::new(target_format, output_samples, target_layout);

            if resampler_ctx.run(decoded, &mut resampled_frame).is_ok() {
                let samples_written = resampled_frame.samples();
                interleave_planar_frame(player_buf, &resampled_frame, samples_written);
            } else {
                error!("resampler.run() 失败");
            }
        } else {
            interleave_planar_frame(player_buf, decoded, decoded.samples());
        }
    }

    {
        if let Some(fft_resampler_ctx) = &mut data.fft_resampler {
            let fft_output_samples = (decoded.samples() as f64 * FFT_TARGET_RATE as f64
                / decoded.rate() as f64)
                .ceil() as usize;

            let mut fft_frame = ffmpeg::frame::Audio::new(
                ffmpeg::format::Sample::F32(ffmpeg::format::sample::Type::Planar),
                fft_output_samples,
                ChannelLayout::MONO,
            );

            if fft_resampler_ctx.run(decoded, &mut fft_frame).is_ok() {
                let samples_written = fft_frame.samples();
                if samples_written > 0 {
                    fft_buf.extend_from_slice(&fft_frame.plane::<f32>(0)[..samples_written]);
                }
            } else {
                error!("fft_resampler.run() 失败");
            }
        } else {
            let samples_written = decoded.samples();
            if samples_written > 0 {
                fft_buf.extend_from_slice(&decoded.plane::<f32>(0)[..samples_written]);
            }
        }
    }
}

fn create_resampler(
    source_format: ffmpeg::format::Sample,
    source_channel_layout: ChannelLayout,
    source_rate: u32,
    target_format: ffmpeg::format::Sample,
    target_channel_layout: ChannelLayout,
    target_rate: u32,
) -> anyhow::Result<Option<ffmpeg::software::resampling::context::Context>> {
    if source_format != target_format
        || source_channel_layout != target_channel_layout
        || source_rate != target_rate
    {
        let resampler = ffmpeg::software::resampling::context::Context::get(
            source_format,
            source_channel_layout,
            source_rate,
            target_format,
            target_channel_layout,
            target_rate,
        )?;
        Ok(Some(resampler))
    } else {
        Ok(None)
    }
}

fn interleave_planar_frame(
    sample_buffer: &mut Vec<f32>,
    frame: &ffmpeg::frame::Audio,
    samples_written: usize,
) {
    if samples_written == 0 {
        return;
    }
    let left_plane = &frame.plane::<f32>(0)[..samples_written];

    if frame.channels() >= 2 {
        let right_plane = &frame.plane::<f32>(1)[..samples_written];
        let interleaved_samples = left_plane
            .iter()
            .zip(right_plane.iter())
            .flat_map(|(&l, &r)| [l, r]);
        sample_buffer.extend(interleaved_samples);
    } else {
        sample_buffer.extend(left_plane.iter().cloned());
    }
}

impl Iterator for FFmpegDecoder {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(sample) = self.local_buffer.pop_front() {
            return Some(sample);
        }

        let mut shared_buffer_lock = self.shared.buffer.lock();

        while shared_buffer_lock.is_empty() {
            if self.shared.is_eof.load(Ordering::Acquire)
                || self.shared.is_stopping.load(Ordering::Acquire)
            {
                return None;
            }
            self.shared.condvar.wait(&mut shared_buffer_lock);
        }

        let chunk = shared_buffer_lock.pop_front().unwrap();

        self.shared.condvar.notify_one();
        drop(shared_buffer_lock);

        if !chunk.fft_samples.is_empty() {
            if let Some(mut player) = self.fft_player.try_write() {
                player.push_samples(&chunk.fft_samples);
            }
        }

        self.local_buffer.extend(chunk.player_samples);

        self.local_buffer.pop_front()
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
        self.total_duration
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        if self.control_tx.send(ControlMessage::Seek(pos)).is_err() {
            warn!("无法发送跳转命令，解码器线程可能已 panic");
            return Err(SeekError::NotSupported {
                underlying_source: "FFmpegDecoder",
            });
        }
        self.local_buffer.clear();
        Ok(())
    }
}

impl Drop for FFmpegDecoder {
    fn drop(&mut self) {
        self.shared.is_stopping.store(true, Ordering::Release);
        self.shared.condvar.notify_all();
        if let Some(handle) = self.decoder_thread.take() {
            if let Err(e) = handle.join() {
                error!("解码器线程 panic: {e:?}");
            }
        }
    }
}
