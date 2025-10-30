use std::{
    fmt::Debug,
    fs::File,
    sync::Arc,
    time::{Duration, Instant},
};

use super::fft_player::FFTPlayer;
use crate::{
    AudioPlayerEventReceiver, AudioPlayerEventSender, AudioPlayerMessageReceiver,
    AudioPlayerMessageSender, AudioThreadEvent, AudioThreadEventMessage, AudioThreadMessage,
    SongData,
    audio_quality::AudioQuality,
    ffmpeg_decoder::{FFmpegDecoder, FFmpegDecoderHandle},
    media_state::{MediaStateManager, MediaStateManagerBackend, MediaStateMessage},
};
use anyhow::{Context, anyhow};
use parking_lot::RwLock as ParkingLotRwLock;
use rodio::{OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock as TokioRwLock;
use tokio::{
    sync::mpsc::{UnboundedReceiver, UnboundedSender},
    task::JoinHandle,
};
use tracing::{info, warn};

pub struct AudioPlayer {
    evt_sender: AudioPlayerEventSender,
    evt_receiver: AudioPlayerEventReceiver,
    msg_sender: AudioPlayerMessageSender,
    msg_receiver: AudioPlayerMessageReceiver,
    sink: Arc<Sink>,
    current_decoder_handle: Option<FFmpegDecoderHandle>,
    stream_handle: OutputStream,
    volume: f64,
    playlist: Vec<SongData>,
    playlist_inited: bool,
    current_play_index: usize,
    current_song: Option<SongData>,
    current_audio_info: Arc<TokioRwLock<AudioInfo>>,
    current_position: Arc<TokioRwLock<f64>>,

    current_audio_quality: Arc<TokioRwLock<AudioQuality>>,
    play_pos_sx: UnboundedSender<(bool, f64)>,
    tasks: Vec<JoinHandle<()>>,
    media_state_manager: Option<Arc<MediaStateManager>>,
    media_state_rx: Option<UnboundedReceiver<MediaStateMessage>>,
    fft_player: Arc<ParkingLotRwLock<FFTPlayer>>,

    fft_broadcast_task: Option<JoinHandle<()>>,
    target_channels: u16,
    target_sample_rate: u32,
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInfo {
    pub name: String,
    pub artist: String,
    pub album: String,
    pub lyric: String,
    pub cover_media_type: String,
    pub cover: Option<Vec<u8>>,
    pub comment: String,
    pub duration: f64,
    pub position: f64,
}

impl Debug for AudioInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AudioInfo")
            .field("name", &self.name)
            .field("artist", &self.artist)
            .field("album", &self.album)
            .field("lyric", &self.lyric)
            .field("cover_media_type", &self.cover_media_type)
            .field("cover", &self.cover.as_ref().map(|x| x.len()))
            .field("comment", &self.comment)
            .field("duration", &self.duration)
            .field("position", &self.position)
            .finish()
    }
}

pub type CustomSongLoaderReturn =
    Box<dyn futures::Future<Output = anyhow::Result<Box<dyn Source<Item = f32> + Send>>> + Send>;
pub type CustomSongLoaderFn = Box<dyn Fn(String) -> CustomSongLoaderReturn + Send + Sync>;
pub type LocalSongLoaderReturn = Box<dyn futures::Future<Output = anyhow::Result<File>> + Send>;
pub type LocalSongLoaderFn = Box<dyn Fn(String) -> LocalSongLoaderReturn + Send + Sync>;

pub struct AudioPlayerConfig {}

impl AudioPlayer {
    pub fn new(_config: AudioPlayerConfig, handle: OutputStream) -> Self {
        let (evt_sender, evt_receiver) = tokio::sync::mpsc::unbounded_channel();
        let (msg_sender, msg_receiver) = tokio::sync::mpsc::unbounded_channel();
        let sink = Arc::new(Sink::connect_new(&handle.mixer()));

        sink.pause();

        let stream_config = handle.config();
        let target_channels = stream_config.channel_count();
        let target_sample_rate = stream_config.sample_rate();

        info!("音频输出设备 声道数:{target_channels}, 采样率:{target_sample_rate}");

        let current_audio_info = Arc::new(TokioRwLock::new(AudioInfo::default()));
        let current_position = Arc::new(TokioRwLock::new(0.0));
        let current_audio_quality = Arc::new(TokioRwLock::new(AudioQuality::default()));
        let fft_player = Arc::new(ParkingLotRwLock::new(FFTPlayer::new()));

        let mut tasks = Vec::new();

        let (media_state_manager, media_state_rx) = match MediaStateManager::new() {
            Ok((manager, ms_rx)) => (Some(Arc::new(manager)), Some(ms_rx)),
            Err(err) => {
                tracing::warn!("初始化媒体状态管理器时出错：{err:?}");
                (None, None)
            }
        };

        let position_writer = current_position.clone();
        let audio_info_reader = current_audio_info.clone();
        let emitter_pos = AudioPlayerEventEmitter::new(evt_sender.clone());
        let (play_pos_sx, mut play_pos_rx) = tokio::sync::mpsc::unbounded_channel::<(bool, f64)>();
        let media_state_manager_clone = media_state_manager.clone();

        tasks.push(tokio::task::spawn(async move {
            let mut time_it = tokio::time::interval(Duration::from_secs(1));
            let mut ui_time_it = tokio::time::interval(Duration::from_millis(16));

            let mut is_playing = false;
            let mut base_time = 0.0;
            let mut inst = Instant::now();

            loop {
                if let Ok((new_is_playing, new_base_time)) = play_pos_rx.try_recv() {
                    is_playing = new_is_playing;
                    base_time = new_base_time;
                    inst = Instant::now();
                    *position_writer.write().await = base_time;
                    if is_playing
                        && let Some(manager) = &media_state_manager_clone
                        && let Err(e) = manager.set_position(base_time)
                    {
                        tracing::warn!("更新 SMTC 进度失败: {e:?}");
                    }
                }

                tokio::select! {
                    _ = ui_time_it.tick() => {
                        if is_playing {
                            let duration = audio_info_reader.read().await.duration;
                            if duration > 0.0 {
                                let current_pos = (base_time + inst.elapsed().as_secs_f64()).min(duration);
                                *position_writer.write().await = current_pos;

                                let _ = emitter_pos
                                    .emit(AudioThreadEvent::PlayPosition {
                                        position: current_pos,
                                    })
                                    .await;
                            }
                        }
                    }
                    _ = time_it.tick() => {
                        if is_playing
                            && let Some(manager) = &media_state_manager_clone {
                                let current_pos = *position_writer.read().await;
                                if let Err(e) = manager.set_position(current_pos) {
                                    tracing::warn!("更新 SMTC 进度失败: {e:?}");
                                }
                            }
                    }
                }
            }
        }));

        let fft_player_clone = fft_player.clone();
        let emitter_clone = AudioPlayerEventEmitter::new(evt_sender.clone());
        let fft_broadcast_task = Some(tokio::task::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(50));
            let mut fft_buffer = vec![0.0; 128];

            loop {
                interval.tick().await;

                let data_to_send: Option<Vec<f32>> = {
                    if let Some(mut player) = fft_player_clone.try_write() {
                        if player.has_data() && player.read(&mut fft_buffer) {
                            Some(fft_buffer.clone())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                };

                if let Some(data) = data_to_send {
                    let _ = emitter_clone.emit(AudioThreadEvent::FFTData { data }).await;
                }
            }
        }));

        Self {
            evt_sender,
            evt_receiver,
            msg_sender,
            msg_receiver,
            stream_handle: handle,
            sink,
            current_decoder_handle: None,
            volume: 1.0,
            playlist: Vec::new(),
            playlist_inited: false,
            current_play_index: 0,
            current_song: None,
            current_audio_info,
            current_position,
            current_audio_quality,
            play_pos_sx,
            tasks,
            media_state_manager,
            media_state_rx,
            fft_player,
            fft_broadcast_task,
            target_channels,
            target_sample_rate,
        }
    }

    pub fn handler(&self) -> AudioPlayerHandle {
        AudioPlayerHandle::new(self.msg_sender.clone())
    }

    fn emitter(&self) -> AudioPlayerEventEmitter {
        AudioPlayerEventEmitter::new(self.evt_sender.clone())
    }

    async fn update_media_manager_metadata(&self) -> anyhow::Result<()> {
        if let Some(manager) = self.media_state_manager.as_ref() {
            let audio_info = self.current_audio_info.read().await;
            manager.set_title(&audio_info.name)?;
            manager.set_artist(&audio_info.artist)?;
            manager.set_duration(audio_info.duration)?;
            if let Some(cover_data) = &audio_info.cover {
                manager.set_cover_image(cover_data)?;
            } else {
                manager.set_cover_image(&[] as &[u8])?;
            }
            manager.update()?;
        }
        Ok(())
    }

    async fn update_media_manager_playback_state(&self, is_playing: bool) -> anyhow::Result<()> {
        if let Some(manager) = self.media_state_manager.as_ref() {
            manager.set_playing(is_playing)?;
        }
        Ok(())
    }

    async fn sync_ui(&self) -> anyhow::Result<()> {
        let audio_info = self.current_audio_info.read().await.clone();
        let position = *self.current_position.read().await;
        let is_playing = !self.sink.is_paused();
        let quality = self.current_audio_quality.read().await.clone();

        let status_event = AudioThreadEvent::SyncStatus {
            music_id: self
                .current_song
                .as_ref()
                .map(|s| s.get_id())
                .unwrap_or_default(),
            is_playing,
            duration: audio_info.duration,
            position,
            music_info: audio_info,
            volume: self.volume,
            load_position: 0.0,
            playlist_inited: self.playlist_inited,
            playlist: self.playlist.clone(),
            current_play_index: self.current_play_index,
            quality,
        };
        self.emitter().emit(status_event).await
    }

    pub async fn run(
        mut self,
        on_event: impl Fn(AudioThreadEventMessage<AudioThreadEvent>) + Send + 'static,
    ) {
        let mut check_end_interval = tokio::time::interval(Duration::from_millis(50));

        loop {
            let media_state_fut = async {
                if let Some(rx) = self.media_state_rx.as_mut() {
                    rx.recv().await
                } else {
                    futures::future::pending().await
                }
            };

            tokio::select! {
                biased;
                msg = self.msg_receiver.recv() => {
                    if let Some(msg) = msg {
                        if let Some(AudioThreadMessage::Close) = &msg.data { break; }
                        if let Err(err) = self.process_message(msg).await {
                            warn!("处理音频线程消息时出错：{err:?}");
                        }
                    } else { break; }
                },
                msg = media_state_fut => {
                    if let Some(msg) = msg {
                        self.on_media_state_msg(msg).await;
                    }
                }
                evt = self.evt_receiver.recv() => {
                    if let Some(evt) = evt { on_event(evt); }
                    else { break; }
                }
                _ = check_end_interval.tick() => {
                    if self.sink.empty() && !self.sink.is_paused() && self.current_song.is_some() {
                        let _ = self.play_pos_sx.send((false, 0.0));
                        if let Err(e) = self.msg_sender.send(AudioThreadEventMessage::new(
                            "".into(),
                            Some(AudioThreadMessage::NextSongGapless),
                        )) {
                            warn!("自动播放下一首失败：{e:?}");
                        }
                    }
                }
            }
        }
    }

    pub async fn on_media_state_msg(&mut self, msg: MediaStateMessage) {
        let handler = self.handler();
        let result = match msg {
            MediaStateMessage::Play => {
                handler
                    .send_anonymous(AudioThreadMessage::ResumeAudio)
                    .await
            }
            MediaStateMessage::Pause => {
                handler.send_anonymous(AudioThreadMessage::PauseAudio).await
            }
            MediaStateMessage::PlayOrPause => {
                handler
                    .send_anonymous(AudioThreadMessage::ResumeOrPauseAudio)
                    .await
            }
            MediaStateMessage::Next => handler.send_anonymous(AudioThreadMessage::NextSong).await,
            MediaStateMessage::Previous => {
                handler.send_anonymous(AudioThreadMessage::PrevSong).await
            }
            MediaStateMessage::Seek(pos) => {
                handler
                    .send_anonymous(AudioThreadMessage::SeekAudio { position: pos })
                    .await
            }
        };
        if let Err(e) = result {
            warn!("发送媒体状态消息失败: {e:?}");
        }
    }

    pub async fn process_message(
        &mut self,
        msg: AudioThreadEventMessage<AudioThreadMessage>,
    ) -> anyhow::Result<()> {
        let emitter = self.emitter();
        if let Some(ref data) = msg.data {
            match data {
                AudioThreadMessage::ResumeAudio => {
                    self.sink.play();
                    let current_pos = *self.current_position.read().await;
                    let _ = self.play_pos_sx.send((true, current_pos));
                    self.update_media_manager_playback_state(true).await?;
                }
                AudioThreadMessage::PauseAudio => {
                    self.sink.pause();
                    let current_pos = *self.current_position.read().await;
                    let _ = self.play_pos_sx.send((false, current_pos));
                    self.update_media_manager_playback_state(false).await?;
                }
                AudioThreadMessage::ResumeOrPauseAudio => {
                    let is_paused = self.sink.is_paused();
                    if is_paused {
                        self.sink.play();
                    } else {
                        self.sink.pause();
                    }
                    let current_pos = *self.current_position.read().await;
                    let _ = self.play_pos_sx.send((is_paused, current_pos));
                    self.update_media_manager_playback_state(is_paused).await?;
                }
                AudioThreadMessage::SeekAudio { position } => {
                    if let Some(handle) = &self.current_decoder_handle {
                        let seek_pos = Duration::from_secs_f64(*position);

                        if handle.seek(seek_pos).is_err() {
                            warn!("发送跳转命令失败, 解码器可能已关闭");
                        } else {
                            let fft_player_clone = self.fft_player.clone();
                            tokio::task::spawn_blocking(move || {
                                fft_player_clone.write().clear();
                            })
                            .await?;
                            let _ = self.play_pos_sx.send((true, *position));
                            self.update_media_manager_playback_state(true).await?;
                        }
                    } else {
                        warn!("找不到解码器句柄, 无法执行跳转");
                    }
                }
                AudioThreadMessage::SetVolume { volume } => {
                    self.volume = volume.clamp(0.0, 1.0);
                    self.sink.set_volume(self.volume as f32);
                }
                AudioThreadMessage::NextSong => {
                    if self.playlist.is_empty() {
                        return emitter.ret_none(msg).await;
                    }
                    self.current_play_index = (self.current_play_index + 1) % self.playlist.len();
                    self.current_song = self.playlist.get(self.current_play_index).cloned();
                    self.start_playing_song(true).await?;
                }
                AudioThreadMessage::NextSongGapless => {
                    if self.playlist.is_empty() {
                        return emitter.ret_none(msg).await;
                    }
                    self.current_play_index = (self.current_play_index + 1) % self.playlist.len();
                    self.current_song = self.playlist.get(self.current_play_index).cloned();
                    self.start_playing_song(false).await?;
                }
                AudioThreadMessage::PrevSong => {
                    if self.playlist.is_empty() {
                        return emitter.ret_none(msg).await;
                    }
                    self.current_play_index = self
                        .current_play_index
                        .checked_sub(1)
                        .unwrap_or(self.playlist.len() - 1);
                    self.current_song = self.playlist.get(self.current_play_index).cloned();
                    self.start_playing_song(true).await?;
                }
                AudioThreadMessage::JumpToSong { song_index } => {
                    if let Some(song) = self.playlist.get(*song_index).cloned() {
                        self.current_play_index = *song_index;
                        self.current_song = Some(song);
                        self.start_playing_song(true).await?;
                    }
                }
                AudioThreadMessage::SetPlaylist { songs } => {
                    self.playlist = songs.clone();
                    self.playlist_inited = true;
                }
                AudioThreadMessage::SetFFTRange { from_freq, to_freq } => {
                    let fft_player_clone = self.fft_player.clone();
                    let (from_freq, to_freq) = (*from_freq, *to_freq);
                    tokio::task::spawn_blocking(move || {
                        fft_player_clone.write().set_freq_range(from_freq, to_freq);
                    })
                    .await?;
                }
                AudioThreadMessage::SetMediaControlsEnabled { enabled } => {
                    if let Some(manager) = self.media_state_manager.as_ref()
                        && let Err(e) = manager.set_enabled(*enabled)
                    {
                        warn!("设置媒体控制启用状态失败: {e:?}");
                    }
                }
                _ => {}
            }
        }
        self.sync_ui().await?;
        emitter.ret_none(msg).await?;
        Ok(())
    }

    async fn start_playing_song(&mut self, clear_sink: bool) -> anyhow::Result<()> {
        if clear_sink {
            self.sink.stop();

            let fft_player_clone = self.fft_player.clone();
            tokio::task::spawn_blocking(move || {
                fft_player_clone.write().clear();
            })
            .await?;

            self.sink = Arc::new(Sink::connect_new(&self.stream_handle.mixer()));
            self.sink.set_volume(self.volume as f32);
            self.current_decoder_handle = None;
        }

        let song_data = self.current_song.clone().context("没有当前歌曲可播放")?;
        let file_path = match song_data {
            SongData::Local { file_path, .. } => file_path,
            _ => return Err(anyhow!("当前实现仅支持本地文件")),
        };

        let target_channels = self.target_channels;
        let target_sample_rate = self.target_sample_rate;

        let fft_player_clone = self.fft_player.clone();
        let file_path_clone = file_path.clone();

        let source_result = tokio::task::spawn_blocking(move || {
            FFmpegDecoder::new(
                file_path_clone,
                fft_player_clone,
                target_channels,
                target_sample_rate,
            )
        })
        .await?;

        let (source, handle) = source_result?;
        self.current_decoder_handle = Some(handle);

        let info = source.audio_info();
        let quality = source.audio_quality();

        *self.current_audio_info.write().await = info;
        *self.current_audio_quality.write().await = quality;

        self.sink.append(source);
        self.update_media_manager_metadata().await?;

        let is_playing = !self.sink.is_paused();
        self.update_media_manager_playback_state(is_playing).await?;

        let _ = self.play_pos_sx.send((is_playing, 0.0));
        self.sync_ui().await?;

        Ok(())
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        for task in &self.tasks {
            task.abort();
        }
        if let Some(handle) = self.fft_broadcast_task.take() {
            handle.abort();
        }
    }
}

#[derive(Debug, Clone)]
pub struct AudioPlayerHandle {
    msg_sender: AudioPlayerMessageSender,
}
impl AudioPlayerHandle {
    pub(crate) fn new(msg_sender: AudioPlayerMessageSender) -> Self {
        Self { msg_sender }
    }
    pub async fn send(
        &self,
        msg: AudioThreadEventMessage<AudioThreadMessage>,
    ) -> anyhow::Result<()> {
        self.msg_sender.send(msg)?;
        Ok(())
    }
    pub async fn send_anonymous(&self, msg: AudioThreadMessage) -> anyhow::Result<()> {
        self.msg_sender
            .send(AudioThreadEventMessage::new("".into(), Some(msg)))?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub(crate) struct AudioPlayerEventEmitter {
    evt_sender: AudioPlayerEventSender,
}
impl AudioPlayerEventEmitter {
    pub(crate) fn new(evt_sender: AudioPlayerEventSender) -> Self {
        Self { evt_sender }
    }
    pub async fn emit(&self, msg: AudioThreadEvent) -> anyhow::Result<()> {
        self.evt_sender
            .send(AudioThreadEventMessage::new("".into(), Some(msg)))?;
        Ok(())
    }
    pub async fn ret_none(
        &self,
        req: AudioThreadEventMessage<AudioThreadMessage>,
    ) -> anyhow::Result<()> {
        self.evt_sender.send(req.to_none())?;
        Ok(())
    }
}
