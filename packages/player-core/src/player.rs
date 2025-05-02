use std::{
    fmt::Debug,
    future::Future,
    io::ErrorKind,
    sync::Arc,
    time::{Duration, Instant},
};

use anyhow::Context;

use media_state::{MediaStateManager, MediaStateManagerBackend, MediaStateMessage};
use output::create_audio_output_thread;
use symphonia::core::io::{MediaSource, MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::{errors::Error as DecodeError, units::Time};
use tokio::{
    sync::{
        Mutex, RwLock,
        mpsc::{UnboundedReceiver, UnboundedSender, error::TryRecvError},
    },
    task::{AbortHandle, JoinHandle},
};
use tracing::*;
use utils::read_audio_info;

use crate::*;

use super::{
    AudioThreadMessage, SongData, audio_quality::AudioQuality, fft_player::FFTPlayer,
    output::AudioOutputSender,
};

#[derive(Debug, Default, Clone, PartialEq)]
struct AudioPlayerTaskData {
    pub current_song: Option<SongData>,
    pub audio_quality: AudioQuality,
}

struct AudioPlayerTaskContext {
    pub emitter: AudioPlayerEventEmitter,
    pub handler: AudioPlayerHandle,
    pub audio_tx: AudioOutputSender,
    pub play_rx: UnboundedReceiver<AudioThreadMessage>,
    pub fft_player: Arc<Mutex<FFTPlayer>>,
    pub fft_has_data_sx: UnboundedSender<()>,
    pub play_pos_sx: UnboundedSender<Option<(bool, f64)>>,
    pub current_audio_info: Arc<RwLock<AudioInfo>>,
    pub media_state_manager: Option<Arc<MediaStateManager>>,
    pub custom_song_loader: Option<Arc<CustomSongLoaderFn>>,
    pub custom_local_song_loader: Option<Arc<LocalSongLoaderFn>>,
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
    Box<dyn Future<Output = anyhow::Result<Box<dyn MediaSource>>> + Send>;
pub type CustomSongLoaderFn = Box<dyn Fn(String) -> CustomSongLoaderReturn + Send + Sync>;

pub type LocalSongLoaderReturn = Box<dyn Future<Output = anyhow::Result<std::fs::File>> + Send>;
pub type LocalSongLoaderFn = Box<dyn Fn(String) -> LocalSongLoaderReturn + Send + Sync>;

pub struct AudioPlayer {
    evt_sender: AudioPlayerEventSender,
    evt_receiver: AudioPlayerEventReceiver,
    msg_sender: AudioPlayerMessageSender,
    msg_receiver: AudioPlayerMessageReceiver,

    player: AudioOutputSender,
    volume: f64,
    is_playing: bool,

    playlist: Vec<SongData>,
    playlist_inited: bool,
    current_play_index: usize,
    current_song: Option<SongData>,
    current_audio_info: Arc<RwLock<AudioInfo>>,

    current_play_task_handle: Option<AbortHandle>,

    fft_player: Arc<Mutex<FFTPlayer>>,
    fft_has_data_sx: UnboundedSender<()>,
    play_pos_sx: UnboundedSender<Option<(bool, f64)>>,

    play_task_sx: UnboundedSender<AudioThreadMessage>,
    play_task_data: Arc<Mutex<AudioPlayerTaskData>>,

    fft_task: JoinHandle<()>,
    play_pos_task: JoinHandle<()>,

    custom_song_loader: Option<Arc<CustomSongLoaderFn>>,
    custom_local_song_loader: Option<Arc<LocalSongLoaderFn>>,
    media_state_manager: Option<Arc<MediaStateManager>>,
    media_state_rx: Option<UnboundedReceiver<MediaStateMessage>>,
}

pub struct AudioPlayerConfig {}

impl AudioPlayer {
    pub fn new(_config: AudioPlayerConfig) -> Self {
        #[cfg(feature = "ffmpeg-next")]
        {
            if let Err(err) = ffmpeg_next::init() {
                warn!("FFMPEG 初始化失败！");
                warn!("{err}");
            }
            info!("FFMPEG 初始化成功！");
            info!("AVCodec 版本：{}", ffmpeg_next::codec::version());
            info!("AVCodec 许可证：{}", ffmpeg_next::codec::license());
            info!("AVFormat 版本：{}", ffmpeg_next::format::version());
            info!("AVFormat 许可证：{}", ffmpeg_next::format::license());

            unsafe {
                info!("支持编解码器：");
                let mut ptr = core::ptr::null_mut();
                let mut codecs = String::with_capacity(2048);
                while let Some(codec) = ffmpeg_next::sys::av_codec_iterate(&mut ptr).as_ref() {
                    let name = core::ffi::CStr::from_ptr(codec.name);
                    codecs.push_str(name.to_string_lossy().as_ref());
                    codecs.push(' ');
                }
                info!("  {codecs}");
            }
        }

        let (evt_sender, evt_receiver) = tokio::sync::mpsc::unbounded_channel();
        let (msg_sender, msg_receiver) = tokio::sync::mpsc::unbounded_channel();
        let playlist = Vec::<SongData>::with_capacity(8192);
        let fft_player = Arc::new(Mutex::new(FFTPlayer::new()));
        let fft_player_clone = fft_player.clone();
        let (fft_has_data_sx, mut fft_rx) = tokio::sync::mpsc::unbounded_channel();
        let (play_pos_sx, mut play_pos_rx) = tokio::sync::mpsc::unbounded_channel();

        let player = create_audio_output_thread();

        let (media_state_manager, media_state_rx) = match MediaStateManager::new() {
            Ok((manager, ms_rx)) => {
                info!("已初始化媒体状态管理器");
                (Some(Arc::new(manager)), Some(ms_rx))
            }
            Err(err) => {
                warn!("初始化媒体状态管理器时出错：{err:?}");
                (None, None)
            }
        };

        // 用于给播放位置插值的任务
        let emt = AudioPlayerEventEmitter::new(evt_sender.clone());
        let play_pos_task = tokio::task::spawn(async move {
            let mut is_inited = false;
            let mut last_is_playing = false;
            let mut start_base_time = 0.0;
            let mut inst = Instant::now();
            let mut time_it = tokio::time::interval(Duration::from_secs_f64(1. / 10.));
            loop {
                let mut should_wait = false;
                match play_pos_rx.try_recv() {
                    Ok(Some((is_playing, pos))) => {
                        if !is_inited {
                            is_inited = true;
                            last_is_playing = is_playing;
                            start_base_time = pos;
                        }
                        if is_playing != last_is_playing {
                            last_is_playing = is_playing;
                            start_base_time = pos;
                            if last_is_playing {
                                inst = Instant::now();
                            } else {
                                let _ = emt
                                    .emit(AudioThreadEvent::PlayPosition { position: pos })
                                    .await;
                            }
                        } else if !is_playing {
                            start_base_time = pos;
                            inst = Instant::now();
                            let _ = emt
                                .emit(AudioThreadEvent::PlayPosition { position: pos })
                                .await;
                        }
                    }
                    Ok(None) => {
                        is_inited = false;
                    }
                    Err(TryRecvError::Disconnected) => {
                        break;
                    }
                    Err(TryRecvError::Empty) => {
                        should_wait = true;
                    }
                }
                if is_inited && last_is_playing {
                    let now = inst.elapsed().as_secs_f64();
                    let pos = start_base_time + now;
                    let _ = emt
                        .emit(AudioThreadEvent::PlayPosition { position: pos })
                        .await;
                }
                if should_wait {
                    time_it.tick().await;
                }
            }
        });

        // 用来计算音频频谱数据的任务
        let emt = AudioPlayerEventEmitter::new(evt_sender.clone());
        let fft_task = tokio::task::spawn(async move {
            let mut buf = [0.0; 64];
            let mut time_it = tokio::time::interval(Duration::from_secs_f64(1. / 30.));
            while fft_rx.recv().await.is_some() {
                while fft_player_clone.lock().await.has_data() {
                    if fft_player_clone.lock().await.read(&mut buf) {
                        let _ = emt
                            .emit(AudioThreadEvent::FFTData { data: buf.to_vec() })
                            .await;
                    }
                    time_it.tick().await;
                    let _ = fft_rx.try_recv();
                }
            }
        });

        Self {
            evt_sender,
            evt_receiver,
            msg_sender,
            msg_receiver,
            player,
            current_play_task_handle: None,
            volume: 0.5,
            playlist,
            playlist_inited: false,
            current_song: None,
            is_playing: false,
            current_audio_info: Arc::new(RwLock::new(AudioInfo::default())),
            fft_player,
            fft_has_data_sx,
            play_pos_sx,
            current_play_index: 0,
            play_task_sx: tokio::sync::mpsc::unbounded_channel().0, // Stub
            play_task_data: Arc::new(Mutex::new(AudioPlayerTaskData::default())),
            fft_task,
            play_pos_task,
            custom_song_loader: None,
            custom_local_song_loader: None,
            media_state_manager,
            media_state_rx,
        }
    }

    pub fn set_custom_song_loader(&mut self, loader: CustomSongLoaderFn) {
        self.custom_song_loader = Some(Arc::new(loader));
    }

    pub fn set_custom_local_song_loader(&mut self, loader: LocalSongLoaderFn) {
        self.custom_local_song_loader = Some(Arc::new(loader));
    }

    pub fn handler(&self) -> AudioPlayerHandle {
        AudioPlayerHandle::new(self.msg_sender.clone())
    }

    fn emitter(&self) -> AudioPlayerEventEmitter {
        AudioPlayerEventEmitter::new(self.evt_sender.clone())
    }

    pub async fn run(
        mut self,
        on_event: impl Fn(AudioThreadEventMessage<AudioThreadEvent>) + Send + 'static,
    ) {
        loop {
            if self.media_state_rx.is_some() {
                tokio::select! {
                    msg = self.msg_receiver.recv() => {
                        if let Some(msg) = msg {
                            if let Some(AudioThreadMessage::Close) = msg.data {
                                break;
                            }
                            if let Err(err) = self.process_message(msg).await {
                                warn!("处理音频线程消息时出错：{err:?}");
                            }
                        }
                    }
                    msg = self.media_state_rx.as_mut().unwrap().recv() => {
                        if let Some(msg) = msg {
                            self.on_media_state_msg(msg).await;
                        }
                    }
                    evt = self.evt_receiver.recv() => {
                        if let Some(evt) = evt {
                            on_event(evt);
                        }
                    }
                    else => {
                        break;
                    }
                }
            } else {
                tokio::select! {
                    msg = self.msg_receiver.recv() => {
                        if let Some(msg) = msg {
                            if let Some(AudioThreadMessage::Close) = msg.data {
                                break;
                            }
                            if let Err(err) = self.process_message(msg).await {
                                warn!("处理音频线程消息时出错：{err:?}");
                            }
                        }
                    }
                    evt = self.evt_receiver.recv() => {
                        if let Some(evt) = evt {
                            on_event(evt);
                        }
                    }
                    else => {
                        break;
                    }
                }
            }
        }
    }

    pub async fn on_media_state_msg(&mut self, msg: MediaStateMessage) {
        match msg {
            MediaStateMessage::Play => {
                let _ = self
                    .handler()
                    .send_anonymous(AudioThreadMessage::ResumeAudio)
                    .await;
            }
            MediaStateMessage::Pause => {
                let _ = self
                    .handler()
                    .send_anonymous(AudioThreadMessage::PauseAudio)
                    .await;
            }
            MediaStateMessage::PlayOrPause => {
                let _ = self
                    .handler()
                    .send_anonymous(AudioThreadMessage::ResumeOrPauseAudio)
                    .await;
            }
            MediaStateMessage::Next => {
                let _ = self
                    .handler()
                    .send_anonymous(AudioThreadMessage::NextSong)
                    .await;
            }
            MediaStateMessage::Previous => {
                let _ = self
                    .handler()
                    .send_anonymous(AudioThreadMessage::PrevSong)
                    .await;
            }
            MediaStateMessage::Seek(pos) => {
                let _ = self
                    .handler()
                    .send_anonymous(AudioThreadMessage::SeekAudio { position: pos })
                    .await;
            }
        }
    }

    pub async fn process_message(
        &mut self,
        msg: AudioThreadEventMessage<AudioThreadMessage>,
    ) -> anyhow::Result<()> {
        let emitter = self.emitter();
        if let Some(data) = &msg.data {
            match data {
                AudioThreadMessage::SeekAudio { position } => {
                    info!("正在跳转音乐到 {position}s");
                    let _ = self.play_task_sx.send(AudioThreadMessage::SeekAudio {
                        position: *position,
                    });
                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::ResumeAudio => {
                    self.is_playing = true;
                    info!("开始继续播放歌曲！");
                    let _ = self.play_task_sx.send(AudioThreadMessage::ResumeAudio);
                    if let Some(x) = &self.media_state_manager {
                        let _ = x.set_playing(true);
                    }
                    emitter
                        .emit(AudioThreadEvent::PlayStatus { is_playing: true })
                        .await?;
                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::PauseAudio => {
                    self.is_playing = false;
                    // 如果暂停播放设备的播放，恢复播放时会重新播放仍在播放环缓冲区的音频数据再次播放，会有不和谐感
                    // 所以只暂停将数据传递给播放设备，让播放设备将缓冲区的数据完全耗尽
                    // if self.player.stream().pause().is_err() {
                    //     self.player = super::output::init_audio_player("");
                    // }
                    info!("播放已暂停！");
                    if let Some(x) = &self.media_state_manager {
                        let _ = x.set_playing(false);
                    }
                    let _ = self.play_task_sx.send(AudioThreadMessage::PauseAudio);
                    emitter
                        .emit(AudioThreadEvent::PlayStatus { is_playing: false })
                        .await?;
                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::ResumeOrPauseAudio => {
                    self.is_playing = !self.is_playing;
                    if self.is_playing {
                        info!("开始继续播放歌曲！");
                        let _ = self.play_task_sx.send(AudioThreadMessage::ResumeAudio);
                        emitter
                            .emit(AudioThreadEvent::PlayStatus { is_playing: true })
                            .await?;
                    } else {
                        info!("播放已暂停！");
                        let _ = self.play_task_sx.send(AudioThreadMessage::PauseAudio);
                        emitter
                            .emit(AudioThreadEvent::PlayStatus { is_playing: false })
                            .await?;
                    }
                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::PrevSong => {
                    if self.playlist.is_empty() {
                        warn!("无法播放歌曲，尚未设置播放列表！");
                    } else {
                        if self.current_play_index == 0 {
                            self.current_play_index = self.playlist.len() - 1;
                        } else {
                            self.current_play_index -= 1;
                        }
                        self.current_song = self.playlist.get(self.current_play_index).cloned();

                        self.is_playing = true;
                        info!("播放上一首歌曲！");
                        self.recreate_play_task(true).await?;
                    }

                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::NextSong => {
                    self.is_playing = true;
                    if self.playlist.is_empty() {
                        warn!("无法播放歌曲，尚未设置播放列表！");
                    } else {
                        self.current_play_index =
                            (self.current_play_index + 1) % self.playlist.len();
                        self.current_song = self.playlist.get(self.current_play_index).cloned();
                        info!("播放下一首歌曲！");
                        self.recreate_play_task(true).await?;
                    }

                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::NextSongGapless => {
                    self.is_playing = true;
                    if self.playlist.is_empty() {
                        warn!("无法播放歌曲，尚未设置播放列表！");
                    } else {
                        self.current_play_index =
                            (self.current_play_index + 1) % self.playlist.len();
                        self.current_song = self.playlist.get(self.current_play_index).cloned();
                        info!("播放下一首歌曲！");
                        self.recreate_play_task(false).await?;
                    }

                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::JumpToSong { song_index, .. } => {
                    if self.playlist.is_empty() {
                        warn!("无法播放歌曲，尚未设置播放列表！");
                    } else {
                        self.is_playing = true;
                        self.current_play_index = *song_index;
                        self.current_song = self.playlist.get(self.current_play_index).cloned();
                        info!("播放第 {} 首歌曲！", *song_index + 1);
                        self.recreate_play_task(true).await?;
                    }

                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::SetPlaylist { songs, .. } => {
                    self.playlist_inited = true;
                    let last_playing_song = self.playlist.get(self.current_play_index).cloned();
                    songs.clone_into(&mut self.playlist);
                    info!("已设置播放列表，歌曲数量为 {}", songs.len());

                    let old_play_index = self.current_play_index;
                    if let Some(last_playing_song) = last_playing_song {
                        self.current_play_index = self
                            .playlist
                            .iter()
                            .enumerate()
                            .find(|x| x.1.get_id() == last_playing_song.get_id())
                            .map(|x| x.0)
                            .unwrap_or(0);
                    } else {
                        self.current_play_index = 0;
                    }
                    info!(
                        "已重定向当前播放位置 {old_play_index} 到 {}",
                        self.current_play_index
                    );

                    emitter.ret_none(msg).await?;
                    emitter
                        .emit(AudioThreadEvent::PlayListChanged {
                            playlist: self.playlist.clone(),
                            current_play_index: self.current_play_index,
                        })
                        .await?;
                }
                AudioThreadMessage::SyncStatus => {
                    let status = self.get_sync_status().await?;
                    emitter.ret(msg, status).await?;
                }
                AudioThreadMessage::SetVolume { volume, .. } => {
                    self.volume = volume.clamp(0., 1.);
                    let _ = self.player.set_volume(self.volume).await;
                    emitter
                        .emit(AudioThreadEvent::VolumeChanged {
                            volume: self.volume,
                        })
                        .await?;

                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::SetVolumeRelative { volume, .. } => {
                    self.volume += volume;
                    self.volume = self.volume.clamp(0., 1.);
                    let _ = self.player.set_volume(self.volume).await;
                    emitter
                        .emit(AudioThreadEvent::VolumeChanged {
                            volume: self.volume,
                        })
                        .await?;

                    emitter.ret_none(msg).await?;
                }
                AudioThreadMessage::SetFFTRange {
                    from_freq, to_freq, ..
                } => {
                    if *from_freq < *to_freq {
                        self.fft_player
                            .lock()
                            .await
                            .set_freq_range(*from_freq, *to_freq);
                    }
                    emitter.ret_none(msg).await?;
                }
                other => {
                    warn!("未知的音频线程消息：{other:?}");
                    emitter.ret_none(msg).await?;
                }
            }
        }
        Ok(())
    }

    async fn get_sync_status(&self) -> anyhow::Result<AudioThreadEvent> {
        let play_task_data = self.play_task_data.lock().await.clone();
        let audio_info = self.current_audio_info.read().await.clone();

        Ok(AudioThreadEvent::SyncStatus {
            music_id: self
                .current_song
                .as_ref()
                .map(|x| x.get_id())
                .unwrap_or_default(),
            is_playing: self.is_playing,
            duration: audio_info.duration,
            position: audio_info.position,
            music_info: audio_info,
            volume: self.volume,
            load_position: 0.,
            playlist_inited: self.playlist_inited,
            playlist: self.playlist.to_owned(),
            current_play_index: self.current_play_index,
            quality: play_task_data.audio_quality,
        })
    }

    pub async fn recreate_play_task(&mut self, clear_output_buffer: bool) -> anyhow::Result<()> {
        if let Some(task) = self.current_play_task_handle.take() {
            task.abort();
        }
        if clear_output_buffer {
            self.player.clear_buffer().await?;
            self.player.wait_empty().await;
        }
        if let Some(current_song) = self.current_song.clone() {
            let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
            self.play_task_sx = tx;
            let ctx = AudioPlayerTaskContext {
                emitter: self.emitter(),
                handler: self.handler(),
                audio_tx: self.player.clone(),
                play_rx: rx,
                fft_player: self.fft_player.clone(),
                fft_has_data_sx: self.fft_has_data_sx.clone(),
                play_pos_sx: self.play_pos_sx.clone(),
                current_audio_info: self.current_audio_info.clone(),
                media_state_manager: self.media_state_manager.clone(),
                custom_song_loader: self.custom_song_loader.clone(),
                custom_local_song_loader: self.custom_local_song_loader.clone(),
            };
            let task = tokio::spawn(Self::play_audio(ctx, current_song, self.current_play_index));
            self.current_play_task_handle = Some(task.abort_handle());
        } else {
            warn!("当前没有歌曲可以播放！");
        }
        Ok(())
    }

    async fn play_audio(
        ctx: AudioPlayerTaskContext,
        song_data: SongData,
        current_play_index: usize,
    ) -> anyhow::Result<()> {
        let emitter = ctx.emitter.clone();
        let handler = ctx.handler.clone();
        if let Err(err) = {
            let music_id = song_data.get_id();
            ctx.emitter
                .emit(AudioThreadEvent::LoadingAudio {
                    music_id: music_id.to_owned(),
                    current_play_index,
                })
                .await?;
            match song_data {
                SongData::Local { file_path, .. } => {
                    if let Some(loader) = ctx.custom_local_song_loader.as_ref() {
                        info!("正在通过自定义加载器播放本地音乐文件 {file_path}");
                        let loader_fut = Box::into_pin(loader(file_path));
                        let file = loader_fut.await?;
                        Self::play_media_stream(ctx, music_id, current_play_index, file).await
                    } else {
                        info!("正在播放本地音乐文件 {file_path}");
                        Self::play_audio_from_local(ctx, music_id, current_play_index, file_path)
                            .await
                    }
                }
                SongData::Custom { song_json_data, .. } => {
                    if let Some(loader) = ctx.custom_song_loader.as_ref() {
                        let source_fut = Box::into_pin(loader(song_json_data));
                        let source = source_fut.await?;

                        struct BoxedMediaSource(Box<dyn MediaSource + 'static>);

                        impl std::io::Read for BoxedMediaSource {
                            fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                                self.0.read(buf)
                            }
                        }

                        impl std::io::Seek for BoxedMediaSource {
                            fn seek(&mut self, pos: std::io::SeekFrom) -> std::io::Result<u64> {
                                self.0.seek(pos)
                            }
                        }

                        impl MediaSource for BoxedMediaSource {
                            fn is_seekable(&self) -> bool {
                                self.0.is_seekable()
                            }

                            fn byte_len(&self) -> Option<u64> {
                                self.0.byte_len()
                            }
                        }

                        Self::play_media_stream(
                            ctx,
                            music_id,
                            current_play_index,
                            BoxedMediaSource(source),
                        )
                        .await
                    } else {
                        Err(anyhow::anyhow!(
                            "传入了自定义音乐源但未设置自定义音乐加载器"
                        ))
                    }
                }
            }
        } {
            error!("播放音频文件时出错：{err:?}");
            emitter
                .emit(AudioThreadEvent::LoadError {
                    error: format!("{err:?}"),
                })
                .await?;
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        handler
            .send_anonymous(AudioThreadMessage::NextSongGapless)
            .await?;

        Ok(())
    }

    async fn play_audio_from_local(
        ctx: AudioPlayerTaskContext,
        music_id: String,
        current_play_index: usize,
        file_path: impl AsRef<std::path::Path> + std::fmt::Debug + Send + Sync + 'static,
    ) -> anyhow::Result<()> {
        info!("正在打开本地音频文件：{file_path:?}");

        #[cfg(feature = "ffmpeg-next")]
        {
            Self::play_media_stream_ffmpeg(ctx, music_id, current_play_index, file_path).await?;
        }

        #[cfg(not(feature = "ffmpeg-next"))]
        {
            let source = std::fs::File::open(file_path.as_ref()).context("无法打开本地音频文件")?;
            Self::play_media_stream(ctx, music_id, current_play_index, source).await?;
        }

        Ok(())
    }

    #[cfg(feature = "ffmpeg-next")]
    #[allow(clippy::too_many_arguments)]
    async fn play_media_stream_ffmpeg(
        mut ctx: AudioPlayerTaskContext,
        music_id: String,
        current_play_index: usize,
        file_path: impl AsRef<std::path::Path> + std::fmt::Debug + Send + Sync + 'static,
    ) -> anyhow::Result<()> {
        use symphonia::core::audio::{AsAudioBufferRef, AudioBuffer, Signal, SignalSpec};

        let new_audio_info = crate::utils::read_audio_info_ffmpeg(&file_path);

        info!("音频元数据信息：{new_audio_info:#?}");

        let mut ictx =
            ffmpeg_next::format::input(&file_path).context("无法通过 FFMPEG 打开音频流")?;

        let (audio_stream_index, audio_time_base, mut dec) = {
            let audio_stream = ictx
                .streams()
                .best(ffmpeg_next::media::Type::Audio)
                .context("无法在媒体文件中找到合适的音频流")?;
            let codec = ffmpeg_next::codec::Context::from_parameters(audio_stream.parameters())
                .context("从参数创建音频解码器失败")?;
            let dec = codec.decoder().audio().context("创建音频解码器失败")?;
            (audio_stream.index(), audio_stream.time_base(), dec)
        };

        dec.set_packet_time_base(audio_time_base);
        let audio_time_base = f64::from(audio_time_base);
        let mut frame = ffmpeg_next::frame::Audio::empty();

        let mut current_audio_info = ctx.current_audio_info.write().await;
        *current_audio_info = new_audio_info.clone();
        drop(current_audio_info);

        // TODO: 解析音质信息
        let audio_quality = AudioQuality::default();
        if let Some(x) = &ctx.media_state_manager {
            let _ = x.set_title(&new_audio_info.name);
            let _ = x.set_artist(&new_audio_info.artist);
            if let Some(cover) = &new_audio_info.cover {
                let _ = x.set_cover_image(cover);
            } else {
                let _ = x.set_cover_image([]);
            }
            let _ = x.set_playing(true);
            let _ = x.set_duration(new_audio_info.duration);
            let _ = x.set_position(0.0);
            let _ = x.update();
        }
        ctx.emitter
            .emit(AudioThreadEvent::LoadAudio {
                music_id: music_id.clone(),
                music_info: new_audio_info,
                quality: audio_quality.to_owned(),
                current_play_index,
            })
            .await?;
        ctx.emitter
            .emit(AudioThreadEvent::PlayStatus { is_playing: true })
            .await?;

        let mut is_playing = true;
        let mut last_play_pos = 0.0;
        ctx.play_pos_sx.send(Some((false, last_play_pos))).unwrap();
        'decode_loop: for (st, p) in ictx.packets() {
            if is_playing {
                // TODO: 合并冗余代码
                if let Some(x) = &ctx.media_state_manager {
                    let _ = x.set_position(last_play_pos);
                    let _ = x.update();
                }
                'recv_loop: loop {
                    match ctx.play_rx.try_recv() {
                        Ok(msg) => match msg {
                            AudioThreadMessage::SeekAudio { position, .. } => {
                                // let _ = ictx.seek((position / audio_time_base) as _, ..);
                                ctx.play_pos_sx.send(Some((false, position))).unwrap();
                                ctx.current_audio_info.write().await.position = position;
                            }
                            AudioThreadMessage::PauseAudio { .. } => {
                                is_playing = false;
                                ctx.play_pos_sx.send(Some((false, last_play_pos))).unwrap();
                                continue 'decode_loop;
                            }
                            _ => {}
                        },
                        Err(TryRecvError::Disconnected) => {
                            anyhow::bail!("已断开音频线程通道");
                        }
                        Err(TryRecvError::Empty) => break 'recv_loop,
                    }
                }

                if st.index() == audio_stream_index {
                    use ffmpeg_next::util::format::Sample;
                    if let Err(err) = dec.send_packet(&p) {
                        warn!("解码音频数据包失败，正在尝试跳过：{err}");
                        continue;
                    }
                    if let Err(err) = dec.receive_frame(&mut frame) {
                        warn!("接收音频数据包失败: {err}");
                        continue;
                    }

                    // AudioBuffer::new(10, SignalSpec::new(rate, channels));
                    let format = frame.format();
                    let timestamp = frame
                        .timestamp()
                        .map(|x| x as f64 * f64::from(audio_time_base))
                        .unwrap_or_default();

                    last_play_pos = timestamp;
                    ctx.current_audio_info.write().await.position = timestamp;
                    ctx.play_pos_sx.send(Some((true, timestamp))).unwrap();

                    fn make_audio_buf<
                        T: symphonia::core::sample::Sample + ffmpeg_next::frame::audio::Sample,
                    >(
                        frame: &ffmpeg_next::frame::Audio,
                        t: ffmpeg_next::format::sample::Type,
                    ) -> anyhow::Result<AudioBuffer<T>> {
                        use ffmpeg_next::format::sample::Type;
                        let channel_layout = {
                            let channel_layout = frame.channel_layout();
                            if channel_layout == ffmpeg_next::ChannelLayout::MONO {
                                symphonia::core::audio::Layout::Mono
                            } else if channel_layout == ffmpeg_next::ChannelLayout::STEREO {
                                symphonia::core::audio::Layout::Stereo
                            } else if channel_layout == ffmpeg_next::ChannelLayout::_2POINT1 {
                                symphonia::core::audio::Layout::TwoPointOne
                            } else if channel_layout == ffmpeg_next::ChannelLayout::_5POINT1 {
                                symphonia::core::audio::Layout::FivePointOne
                            } else {
                                anyhow::bail!("不支持的声道数据包 {channel_layout:?}")
                            }
                        };
                        let nb_chan = frame.channels() as usize;
                        let samples_per_channel = frame.samples();
                        let mut abuf = AudioBuffer::<T>::new(
                            samples_per_channel as u64,
                            SignalSpec::new_with_layout(frame.rate(), channel_layout),
                        );
                        debug_assert_eq!(abuf.capacity(), samples_per_channel);
                        abuf.render_reserved(Some(samples_per_channel));
                        match t {
                            Type::Packed => {
                                let data = unsafe {
                                    let data = frame.data(0);
                                    std::slice::from_raw_parts(
                                        data.as_ptr() as *const T,
                                        data.len() / std::mem::size_of::<T>(),
                                    )
                                };
                                for i in 0..nb_chan {
                                    let chan = abuf.chan_mut(i);
                                    for (si, s) in chan.iter_mut().enumerate() {
                                        *s = data[si * nb_chan + i];
                                    }
                                }
                            }
                            Type::Planar => {
                                for i in 0..nb_chan {
                                    let chan = abuf.chan_mut(i);
                                    chan.copy_from_slice(frame.plane(i));
                                }
                            }
                        }
                        Ok(abuf)
                    }

                    // TODO: 根据实际情况启用或禁用频谱数据，节省通道带宽
                    match format {
                        Sample::U8(t) => {
                            let abuf = make_audio_buf::<u8>(&frame, t)?;
                            let abuf = abuf.as_audio_buffer_ref();
                            ctx.fft_player.lock().await.push_data(&abuf);
                            ctx.audio_tx.write_ref(abuf).await
                        }
                        Sample::I16(t) => {
                            let abuf = make_audio_buf::<i16>(&frame, t)?;
                            let abuf = abuf.as_audio_buffer_ref();
                            ctx.fft_player.lock().await.push_data(&abuf);
                            ctx.audio_tx.write_ref(abuf).await
                        }
                        Sample::I32(t) => {
                            let abuf = make_audio_buf::<i32>(&frame, t)?;
                            let abuf = abuf.as_audio_buffer_ref();
                            ctx.fft_player.lock().await.push_data(&abuf);
                            ctx.audio_tx.write_ref(abuf).await
                        }
                        Sample::I64(_) => {
                            warn!("不支持 I64 采样类型");
                            Ok(())
                        }
                        Sample::F32(t) => {
                            let abuf = make_audio_buf::<f32>(&frame, t)?;
                            let abuf = abuf.as_audio_buffer_ref();
                            ctx.fft_player.lock().await.push_data(&abuf);
                            ctx.audio_tx.write_ref(abuf).await
                        }
                        Sample::F64(t) => {
                            let abuf = make_audio_buf::<f64>(&frame, t)?;
                            let abuf = abuf.as_audio_buffer_ref();
                            ctx.fft_player.lock().await.push_data(&abuf);
                            ctx.audio_tx.write_ref(abuf).await
                        }
                        _ => Ok(()),
                    }
                    .context("将音频包写入音频输出时发生错误")?;
                    let _ = ctx.fft_has_data_sx.send(());
                }
            } else if let Some(msg) = ctx.play_rx.recv().await {
                // TODO: 合并冗余代码
                match msg {
                    AudioThreadMessage::SeekAudio { position, .. } => {
                        // let _ = ictx.seek((position / audio_time_base) as _, ..);
                        ctx.play_pos_sx.send(Some((false, position))).unwrap();
                        ctx.current_audio_info.write().await.position = position;
                    }
                    AudioThreadMessage::ResumeAudio { .. } => {
                        is_playing = true;
                    }
                    _ => {}
                }
            }
        }

        // Ok(())
        // }
        // )
        // .await??;

        ctx.emitter
            .emit(AudioThreadEvent::AudioPlayFinished { music_id })
            .await?;

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    async fn play_media_stream(
        mut ctx: AudioPlayerTaskContext,
        music_id: String,
        current_play_index: usize,
        source: impl MediaSource + 'static,
    ) -> anyhow::Result<()> {
        let handle = tokio::runtime::Handle::current();
        let source_stream = handle
            .spawn_blocking(|| {
                MediaSourceStream::new(Box::new(source), MediaSourceStreamOptions::default())
            })
            .await?;
        let codecs = symphonia::default::get_codecs();
        let probe = symphonia::default::get_probe();
        let mut format_result = handle
            .spawn_blocking(|| {
                probe.format(
                    &Default::default(),
                    source_stream,
                    &Default::default(),
                    &Default::default(),
                )
            })
            .await?
            .context("无法解码正在加载的音频数据信息")?;

        let mut new_audio_info = read_audio_info(&mut format_result);

        if format_result.format.tracks().len() > 1 {
            warn!(
                "音频文件包含 {} 个音轨，选择默认音轨进行播放",
                format_result.format.tracks().len()
            );
        }

        let track = format_result
            .format
            .default_track()
            .context("无法解码正在加载的音频的默认音轨")?;
        let timebase = track.codec_params.time_base.unwrap_or_default();
        let mut decoder = codecs
            .make(&track.codec_params, &Default::default())
            .context("无法为当前音频文件选择解码器")?;
        let duration = timebase.calc_time(track.codec_params.n_frames.unwrap_or_default());
        let play_duration = duration.seconds as f64 + duration.frac;
        new_audio_info.duration = play_duration;
        new_audio_info.position = 0.0;

        let mut current_audio_info = ctx.current_audio_info.write().await;
        *current_audio_info = new_audio_info.clone();
        drop(current_audio_info);

        let audio_quality = AudioQuality::from_codec_and_track(codecs, track);
        if let Some(x) = &ctx.media_state_manager {
            let _ = x.set_title(&new_audio_info.name);
            let _ = x.set_artist(&new_audio_info.artist);
            if let Some(cover) = &new_audio_info.cover {
                let _ = x.set_cover_image(cover);
            } else {
                let _ = x.set_cover_image([]);
            }
            let _ = x.set_playing(true);
            let _ = x.set_duration(play_duration);
            let _ = x.set_position(0.0);
            let _ = x.update();
        }
        info!("音频文件的信息：{new_audio_info:#?}");
        ctx.emitter
            .emit(AudioThreadEvent::LoadAudio {
                music_id: music_id.clone(),
                music_info: new_audio_info,
                quality: audio_quality.to_owned(),
                current_play_index,
            })
            .await?;
        ctx.emitter
            .emit(AudioThreadEvent::PlayStatus { is_playing: true })
            .await?;

        info!("开始播放音频数据，时长为 {play_duration} 秒，音质为 {audio_quality:?}");

        format_result.format.seek(
            symphonia::core::formats::SeekMode::Accurate,
            symphonia::core::formats::SeekTo::Time {
                time: Default::default(),
                track_id: None,
            },
        )?;
        let format_result = Arc::new(tokio::sync::Mutex::new(format_result));

        let mut is_playing = true;
        let mut last_play_pos = 0.0;
        ctx.play_pos_sx.send(Some((false, last_play_pos))).unwrap();
        let play_result = 'play_loop: loop {
            if is_playing {
                if let Some(x) = &ctx.media_state_manager {
                    let _ = x.set_position(last_play_pos);
                    let _ = x.update();
                }
                'recv_loop: loop {
                    match ctx.play_rx.try_recv() {
                        Ok(msg) => match msg {
                            AudioThreadMessage::SeekAudio { position, .. } => {
                                let format_result = Arc::clone(&format_result);
                                handle
                                    .spawn_blocking(move || {
                                        format_result.blocking_lock().format.seek(
                                            symphonia::core::formats::SeekMode::Coarse,
                                            symphonia::core::formats::SeekTo::Time {
                                                time: Time::new(position as _, position.fract()),
                                                track_id: None,
                                            },
                                        )
                                    })
                                    .await??;
                                ctx.play_pos_sx.send(Some((false, position))).unwrap();
                                ctx.current_audio_info.write().await.position = position;
                            }
                            AudioThreadMessage::PauseAudio { .. } => {
                                is_playing = false;
                                ctx.play_pos_sx.send(Some((false, last_play_pos))).unwrap();
                                continue 'play_loop;
                            }
                            _ => {}
                        },
                        Err(TryRecvError::Disconnected) => {
                            break 'play_loop Err(anyhow::anyhow!("已断开音频线程通道"));
                        }
                        Err(TryRecvError::Empty) => break 'recv_loop,
                    }
                }
                let format_result = Arc::clone(&format_result);
                let packet = match handle
                    .spawn_blocking(move || format_result.blocking_lock().format.next_packet())
                    .await?
                {
                    Ok(packet) => packet,
                    Err(DecodeError::IoError(err)) => match err.kind() {
                        ErrorKind::UnexpectedEof if err.to_string() == "end of stream" => {
                            info!("音频流已播放完毕");
                            break 'play_loop Ok(());
                        }
                        ErrorKind::WouldBlock => continue,
                        _ => {
                            break 'play_loop Err(anyhow::anyhow!("读取数据块发生 IO 错误: {err}"));
                        }
                    },
                    Err(err) => {
                        break 'play_loop Err(anyhow::anyhow!("读取数据块发生其他错误: {err}"));
                    }
                };
                match decoder.decode(&packet) {
                    Ok(buf) => {
                        let time = timebase.calc_time(packet.ts);
                        let play_position = time.seconds as f64 + time.frac;
                        last_play_pos = play_position;
                        ctx.current_audio_info.write().await.position = play_position;

                        // TODO: 根据实际情况启用或禁用频谱数据，节省通道带宽
                        ctx.play_pos_sx.send(Some((true, play_position))).unwrap();
                        ctx.fft_player.lock().await.push_data(&buf);
                        let _ = ctx.fft_has_data_sx.send(());

                        ctx.audio_tx.write_ref(buf).await?;
                    }
                    Err(symphonia::core::errors::Error::DecodeError(err)) => {
                        warn!("解码数据块出错，跳过当前块: {}", err);
                    }
                    Err(err) => break Err(anyhow::anyhow!("解码出现其他错误: {err}")),
                }
            } else if let Some(msg) = ctx.play_rx.recv().await {
                match msg {
                    AudioThreadMessage::SeekAudio { position, .. } => {
                        let format_result = Arc::clone(&format_result);
                        handle
                            .spawn_blocking(move || {
                                format_result.blocking_lock().format.seek(
                                    symphonia::core::formats::SeekMode::Coarse,
                                    symphonia::core::formats::SeekTo::Time {
                                        time: Time::new(position as _, position.fract()),
                                        track_id: None,
                                    },
                                )
                            })
                            .await??;
                        ctx.play_pos_sx.send(Some((false, position))).unwrap();
                        ctx.current_audio_info.write().await.position = position;
                    }
                    AudioThreadMessage::ResumeAudio { .. } => {
                        is_playing = true;
                    }
                    _ => {}
                }
            }
        };

        if let Err(err) = play_result {
            error!("播放音频出错: {err:?}");
            ctx.emitter
                .emit(AudioThreadEvent::PlayError {
                    error: err.to_string(),
                })
                .await?;
        }

        ctx.emitter
            .emit(AudioThreadEvent::AudioPlayFinished { music_id })
            .await?;

        Ok(())
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        if let Some(task) = self.current_play_task_handle.take() {
            task.abort();
        }
        self.fft_task.abort();
        self.play_pos_task.abort();
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

    pub fn send_blocking(
        &self,
        msg: AudioThreadEventMessage<AudioThreadMessage>,
    ) -> anyhow::Result<()> {
        self.msg_sender.send(msg)?;
        Ok(())
    }

    pub async fn send_anonymous(&self, msg: AudioThreadMessage) -> anyhow::Result<()> {
        self.msg_sender.send(AudioThreadEventMessage {
            callback_id: "".into(),
            data: Some(msg),
        })?;
        Ok(())
    }

    pub fn send_anonymous_blocking(&self, msg: AudioThreadMessage) -> anyhow::Result<()> {
        self.msg_sender.send(AudioThreadEventMessage {
            callback_id: "".into(),
            data: Some(msg),
        })?;
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
        self.evt_sender.send(AudioThreadEventMessage {
            callback_id: "".into(),
            data: Some(msg),
        })?;
        Ok(())
    }

    pub async fn ret(
        &self,
        req: AudioThreadEventMessage<AudioThreadMessage>,
        res: AudioThreadEvent,
    ) -> anyhow::Result<()> {
        self.evt_sender.send(req.to(res))?;
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
