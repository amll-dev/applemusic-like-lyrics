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

type Connections =
    Arc<TokioRwLock<HashMap<SocketAddr, SplitSink<WebSocketStream<TcpStream>, Message>>>>;

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
            if let Err(e) = conn_sink.close().await {
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
        let msg = match ws_protocol::to_body(&data) {
            Ok(binary_data) => Message::Binary(binary_data.into()),
            Err(e) => {
                error!("读取消息失败: {:?}", e);
                return;
            }
        };

        let mut disconnected_addrs = Vec::new();

        for (addr, conn) in conns.iter_mut() {
            if let Err(err) = conn.send(msg.clone()).await {
                warn!("WebSocket 客户端 {addr} 发送失败: {err:?}");
                disconnected_addrs.push(*addr);
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

        let (write, mut read) = wss.split();

        conns.write().await.insert(addr, write);

        while let Some(Ok(data)) = read.next().await {
            if data.is_binary() {
                // trace!("WebSocket 客户端 {addr} 发送原始数据: {data:?}");

                let data = data.into_data();
                if let Ok(body) = ws_protocol::parse_body(&data) {
                    // match &body {
                    //     Body::OnAudioData { .. } => {}
                    //     _ => {
                    //         trace!("WebSocket 客户端 {addr} 解析到原始数据: {body:?}");
                    //     }
                    // }
                    // app.emit("on-ws-protocol-client-body", body)?;
                    if let Err(e) = channel.send(body) {
                        error!("向前端发送消息失败，可能前端已关闭。错误: {e:?}");
                        break;
                    }
                }
            }
        }

        info!("已断开 WebSocket 客户端: {addr}");
        app.emit("on-ws-protocol-client-disconnected", &addr_str)?;
        conns.write().await.remove(&addr);
        Ok(())
    }
}
