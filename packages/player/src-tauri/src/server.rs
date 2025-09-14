use std::collections::HashMap;
use std::{net::SocketAddr, sync::Arc, time::Duration};

use futures::prelude::*;
use futures::stream::SplitSink;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock as TokioRwLock;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{WebSocketStream, accept_async};
use tracing::*;
use ws_protocol::JsonBody;

type Connections = Arc<TokioRwLock<HashMap<SocketAddr, ConnectionInfo>>>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProtocolType {
    Unknown,
    BinaryV1,
    HybridV2,
}

struct ConnectionInfo {
    sink: SplitSink<WebSocketStream<TcpStream>, Message>,
    protocol: ProtocolType,
}

pub struct AMLLWebSocketServer {
    app: AppHandle,
    server_handle: Option<JoinHandle<()>>,
    connections: Connections,
}

impl AMLLWebSocketServer {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            server_handle: None,
            connections: Arc::new(TokioRwLock::new(HashMap::with_capacity(8))),
        }
    }

    pub async fn close(&mut self) {
        if let Some(task) = self.server_handle.take() {
            task.abort();
        }
        let mut conns = self.connections.write().await;
        for (addr, conn_sink) in conns.iter_mut() {
            if let Err(e) = conn_sink.sink.close().await {
                warn!("断开和 {} 的 WebSocket 连接失败:{:?}", addr, e);
            }
        }
        conns.clear();
        info!("WebSocket 服务器已关闭");
    }

    pub fn reopen(&mut self, addr: String, channel: Channel<ws_protocol::Body>) {
        if let Some(task) = self.server_handle.take() {
            task.abort();
        }
        if addr.is_empty() {
            info!("WebSocket 服务器已关闭");
            return;
        }
        let app = self.app.clone();
        let connections = self.connections.clone();

        self.server_handle = Some(tokio::spawn(async move {
            loop {
                info!("正在开启 WebSocket 服务器到 {addr}");
                match TcpListener::bind(&addr).await {
                    Ok(listener) => {
                        info!("已开启 WebSocket 服务器到 {addr}");
                        while let Ok((stream, _)) = listener.accept().await {
                            tokio::spawn(Self::accept_conn(
                                stream,
                                app.clone(),
                                connections.clone(),
                                channel.clone(),
                            ));
                        }
                        warn!("WebSocket 监听器失效，正在尝试重启...");
                    }
                    Err(err) => {
                        error!("WebSocket 服务器 {addr} 开启失败: {err:?}");
                    }
                }
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }));
    }

    pub async fn get_connections(&self) -> Vec<SocketAddr> {
        self.connections.read().await.keys().copied().collect()
    }

    pub async fn boardcast_message(&mut self, data: ws_protocol::Body) {
        let mut conns = self.connections.write().await;

        let v1_msg = ws_protocol::to_body(&data)
            .ok()
            .map(|d| Message::Binary(d.into()));

        let mut v2_msg: Option<Message> = None;
        match data.clone() {
            ws_protocol::Body::OnAudioData { .. }
            | ws_protocol::Body::SetMusicAlbumCoverImageData { .. } => {
                warn!("不应该发送音频和封面二进制数据");
                return;
            }
            body => {
                if let Ok(json_body) = Self::convert_body_to_jsonbody(body)
                    && let Ok(json_str) = serde_json::to_string(&json_body)
                {
                    v2_msg = Some(Message::Text(json_str.into()));
                }
            }
        }

        let mut disconnected_addrs = Vec::new();

        for (addr, conn_info) in conns.iter_mut() {
            let msg_to_send = match conn_info.protocol {
                ProtocolType::BinaryV1 => v1_msg.as_ref(),
                ProtocolType::HybridV2 => v2_msg.as_ref(),
                _ => None,
            };

            if let Some(msg) = msg_to_send {
                if msg.is_empty() {
                    continue;
                }
                if let Err(err) = conn_info.sink.send(msg.clone()).await {
                    warn!("WebSocket 客户端 {addr} 发送失败: {err:?}");
                    disconnected_addrs.push(*addr);
                }
            }
        }

        for addr in disconnected_addrs {
            conns.remove(&addr);
        }
    }

    async fn accept_conn(
        stream: TcpStream,
        app: AppHandle,
        conns: Connections,
        channel: Channel<ws_protocol::Body>,
    ) -> anyhow::Result<()> {
        let addr = stream.peer_addr()?;
        let addr_str = addr.to_string();
        info!("已接受套接字连接: {addr}");

        let wss = accept_async(stream).await?;
        info!("已连接 WebSocket 客户端: {addr}");
        app.emit("on-ws-protocol-client-connected", &addr_str)?;

        let (write_sink, mut read_stream) = wss.split();

        let mut temp_sink = Some(write_sink);

        if let Some(Ok(first_message)) = read_stream.next().await {
            let protocol_type = match first_message {
                Message::Text(ref text) => {
                    if let Ok(JsonBody::InitializeV2) = serde_json::from_str(text) {
                        info!("已识别为 HybridV2 协议");
                        ProtocolType::HybridV2
                    } else {
                        warn!("发送了无法识别的文本消息，断开。");
                        return Ok(());
                    }
                }
                Message::Binary(_) => {
                    info!("已识别为 BinaryV1 协议");
                    if let Err(e) = Self::process_v1_message(first_message, &addr, &channel).await {
                        error!("处理消息失败: {e:?}");
                        return Ok(());
                    }
                    ProtocolType::BinaryV1
                }
                _ => ProtocolType::Unknown,
            };

            if protocol_type != ProtocolType::Unknown
                && let Some(sink) = temp_sink.take()
            {
                conns.write().await.insert(
                    addr,
                    ConnectionInfo {
                        sink,
                        protocol: protocol_type,
                    },
                );
            }
        }

        while let Some(Ok(message)) = read_stream.next().await {
            let conns_read = conns.read().await;
            if let Some(conn_info) = conns_read.get(&addr) {
                let process_result = match conn_info.protocol {
                    ProtocolType::BinaryV1 => {
                        Self::process_v1_message(message, &addr, &channel).await
                    }
                    ProtocolType::HybridV2 => {
                        Self::process_v2_message(message, &addr, &channel).await
                    }
                    _ => Ok(()),
                };
                if let Err(e) = process_result {
                    error!("处理消息失败: {e:?}");
                    break;
                }
            }
        }

        info!("已断开 WebSocket 客户端: {addr}");
        app.emit("on-ws-protocol-client-disconnected", &addr_str)?;
        conns.write().await.remove(&addr);
        Ok(())
    }

    async fn process_v1_message(
        message: Message,
        _addr: &SocketAddr,
        channel: &Channel<ws_protocol::Body>,
    ) -> anyhow::Result<()> {
        if let Message::Binary(data) = message {
            let body = ws_protocol::parse_body(&data)?;
            if let Err(e) = channel.send(body) {
                return Err(anyhow::anyhow!("发送失败: {e:?}"));
            }
        }
        Ok(())
    }

    async fn process_v2_message(
        message: Message,
        _addr: &SocketAddr,
        channel: &Channel<ws_protocol::Body>,
    ) -> anyhow::Result<()> {
        let body = match message {
            Message::Text(text) => {
                let json_body: JsonBody = serde_json::from_str(&text)?;
                Self::convert_jsonbody_to_body(json_body)?
            }
            Message::Binary(data) => ws_protocol::parse_body(&data)?,
            _ => return Ok(()),
        };
        if let Err(e) = channel.send(body) {
            return Err(anyhow::anyhow!("发送失败: {e:?}"));
        }

        Ok(())
    }

    fn convert_jsonbody_to_body(json_body: JsonBody) -> anyhow::Result<ws_protocol::Body> {
        Ok(match json_body {
            JsonBody::Ping => ws_protocol::Body::Ping,
            JsonBody::Pong => ws_protocol::Body::Pong,
            JsonBody::Pause => ws_protocol::Body::Pause,
            JsonBody::Resume => ws_protocol::Body::Resume,
            JsonBody::ForwardSong => ws_protocol::Body::ForwardSong,
            JsonBody::BackwardSong => ws_protocol::Body::BackwardSong,
            JsonBody::SetVolume { volume } => ws_protocol::Body::SetVolume { volume },
            JsonBody::SeekPlayProgress { progress } => {
                ws_protocol::Body::SeekPlayProgress { progress }
            }
            JsonBody::SetMusicInfo {
                music_id,
                music_name,
                album_id,
                album_name,
                artists,
                duration,
            } => ws_protocol::Body::SetMusicInfo {
                music_id: music_id.into(),
                music_name: music_name.into(),
                album_id: album_id.into(),
                album_name: album_name.into(),
                artists,
                duration,
            },
            JsonBody::SetMusicAlbumCoverImageURI { img_url } => {
                ws_protocol::Body::SetMusicAlbumCoverImageURI {
                    img_url: img_url.into(),
                }
            }
            JsonBody::OnPlayProgress { progress } => ws_protocol::Body::OnPlayProgress { progress },
            JsonBody::OnVolumeChanged { volume } => ws_protocol::Body::OnVolumeChanged { volume },
            JsonBody::OnPaused => ws_protocol::Body::OnPaused,
            JsonBody::OnResumed => ws_protocol::Body::OnResumed,
            JsonBody::SetLyric { data } => ws_protocol::Body::SetLyric { data },
            JsonBody::SetLyricFromTTML { data } => {
                ws_protocol::Body::SetLyricFromTTML { data: data.into() }
            }
            JsonBody::InitializeV2 => {
                return Err(anyhow::anyhow!("收到意外的 InitializeV2 消息"));
            }
        })
    }

    fn convert_body_to_jsonbody(body: ws_protocol::Body) -> anyhow::Result<JsonBody> {
        Ok(match body {
            ws_protocol::Body::Ping => JsonBody::Ping,
            ws_protocol::Body::Pong => JsonBody::Pong,
            ws_protocol::Body::SetMusicInfo {
                music_id,
                music_name,
                album_id,
                album_name,
                artists,
                duration,
                ..
            } => JsonBody::SetMusicInfo {
                music_id: music_id.to_string(),
                music_name: music_name.to_string(),
                album_id: album_id.to_string(),
                album_name: album_name.to_string(),
                artists,
                duration,
            },
            ws_protocol::Body::SetMusicAlbumCoverImageURI { img_url } => {
                JsonBody::SetMusicAlbumCoverImageURI {
                    img_url: img_url.to_string(),
                }
            }
            ws_protocol::Body::OnPlayProgress { progress } => JsonBody::OnPlayProgress { progress },
            ws_protocol::Body::OnVolumeChanged { volume } => JsonBody::OnVolumeChanged { volume },
            ws_protocol::Body::OnPaused => JsonBody::OnPaused,
            ws_protocol::Body::OnResumed => JsonBody::OnResumed,
            ws_protocol::Body::SetLyric { data, .. } => JsonBody::SetLyric { data },
            ws_protocol::Body::SetLyricFromTTML { data } => JsonBody::SetLyricFromTTML {
                data: data.to_string(),
            },
            ws_protocol::Body::Pause => JsonBody::Pause,
            ws_protocol::Body::Resume => JsonBody::Resume,
            ws_protocol::Body::ForwardSong => JsonBody::ForwardSong,
            ws_protocol::Body::BackwardSong => JsonBody::BackwardSong,
            ws_protocol::Body::SetVolume { volume } => JsonBody::SetVolume { volume },
            ws_protocol::Body::SeekPlayProgress { progress } => {
                JsonBody::SeekPlayProgress { progress }
            }
            ws_protocol::Body::OnAudioData { .. }
            | ws_protocol::Body::SetMusicAlbumCoverImageData { .. } => {
                return Err(anyhow::anyhow!("不应该将二进制消息转换为JSON"));
            }
        })
    }
}
