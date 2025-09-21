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
use ws_protocol::{v1, v2};

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

    pub fn reopen(&mut self, addr: String, channel: Channel<v2::Payload>) {
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

    pub async fn broadcast_payload(&mut self, payload: v2::Payload) {
        let mut conns = self.connections.write().await;

        let v2_msg = serde_json::to_string(&payload)
            .ok()
            .map(|s| Message::Text(s.into()));

        let v1_msg = if let Ok(v1_body) = v1::Body::try_from(payload.clone()) {
            v1::to_body(&v1_body)
                .ok()
                .map(|d| Message::Binary(d.into()))
        } else {
            None
        };

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
        channel: Channel<v2::Payload>,
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
                    if let Ok(v2_message) = serde_json::from_str::<v2::MessageV2>(text) {
                        if v2_message.payload == v2::Payload::Initialize {
                            info!("已识别为 HybridV2 协议");
                            ProtocolType::HybridV2
                        } else {
                            warn!("收到了一个非 Initialize 的 V2 消息，断开。");
                            return Ok(());
                        }
                    } else {
                        warn!("发送了无法识别的文本消息，断开。");
                        return Ok(());
                    }
                }
                Message::Binary(_) => {
                    info!("已识别为 BinaryV1 协议");
                    if let Err(e) = Self::process_v1_message(first_message, &channel).await {
                        error!("处理 V1 协议的消息时失败: {e:?}");
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
                    ProtocolType::BinaryV1 => Self::process_v1_message(message, &channel).await,
                    ProtocolType::HybridV2 => Self::process_v2_message(message, &channel).await,
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
        channel: &Channel<v2::Payload>,
    ) -> anyhow::Result<()> {
        if let Message::Binary(data) = message {
            let v1_body = v1::parse_body(&data)?;
            channel.send(v1_body.into())?;
        }
        Ok(())
    }

    async fn process_v2_message(
        message: Message,
        channel: &Channel<v2::Payload>,
    ) -> anyhow::Result<()> {
        let payload = match message {
            Message::Text(text) => serde_json::from_str::<v2::MessageV2>(&text)?.payload,
            Message::Binary(data) => v2::parse_binary_v2(&data)?.into(),
            _ => return Ok(()),
        };
        channel.send(payload)?;
        Ok(())
    }
}
