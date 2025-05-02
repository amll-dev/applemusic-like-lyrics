use std::{collections::HashSet, net::SocketAddr, sync::Arc};
use std::{sync::RwLock as StdRwLock, time::Duration};

use async_std::net::{TcpListener, TcpStream};
use async_std::sync::RwLock as AsyncRwLock;
use async_std::task::{JoinHandle, block_on};
use async_tungstenite::WebSocketStream;
use async_tungstenite::tungstenite::Message;
use futures::prelude::*;
use futures::stream::SplitSink;
use tauri::{AppHandle, Emitter};
use tracing::*;
use ws_protocol::Body;

type Connections = Arc<AsyncRwLock<Vec<SplitSink<WebSocketStream<TcpStream>, Message>>>>;
type ConnectionAddrs = Arc<StdRwLock<HashSet<SocketAddr>>>;
pub struct AMLLWebSocketServer {
    app: AppHandle,
    server_handle: Option<JoinHandle<()>>,
    connections: Connections,
    connection_addrs: ConnectionAddrs,
}

impl AMLLWebSocketServer {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            server_handle: None,
            connections: Arc::new(AsyncRwLock::new(Vec::with_capacity(8))),
            connection_addrs: Arc::new(StdRwLock::new(HashSet::with_capacity(8))),
        }
    }
    pub fn reopen(&mut self, addr: String) {
        if let Some(task) = self.server_handle.take() {
            block_on(task.cancel());
        }
        if addr.is_empty() {
            info!("WebSocket 服务器已关闭");
            return;
        }
        let app = self.app.clone();
        let connections = self.connections.clone();
        let conn_addrs = self.connection_addrs.clone();
        self.server_handle = Some(async_std::task::spawn(async move {
            loop {
                info!("正在开启 WebSocket 服务器到 {addr}");
                let listener = TcpListener::bind(&addr).await;
                match listener {
                    Ok(listener) => {
                        info!("已开启 WebSocket 服务器到 {addr}");
                        while let Ok((stream, _)) = listener.accept().await {
                            async_std::task::spawn(Self::accept_conn(
                                stream,
                                app.clone(),
                                connections.clone(),
                                conn_addrs.clone(),
                            ));
                        }
                        break;
                    }
                    Err(err) => match err.kind() {
                        _ => {
                            info!("WebSocket 服务器 {addr} 开启失败: {err:?}");
                        }
                    },
                }
                async_std::task::sleep(Duration::from_secs(1)).await;
            }
        }));
    }

    pub fn get_connections(&self) -> Vec<SocketAddr> {
        let conns = self
            .connection_addrs
            .read()
            .unwrap()
            .iter()
            .copied()
            .collect();
        conns
    }

    pub async fn boardcast_message(&mut self, data: ws_protocol::Body) {
        let mut conns = self.connections.write().await;
        let mut i = 0;
        while i < conns.len() {
            if let Err(err) = conns[i]
                .send(Message::Binary(ws_protocol::to_body(&data).unwrap()))
                .await
            {
                warn!("WebSocket 客户端 {:?} 发送失败: {err:?}", conns[i]);
                let _ = conns.remove(i);
            } else {
                i += 1;
            }
        }
    }

    async fn accept_conn(
        stream: TcpStream,
        app: AppHandle,
        conns: Connections,
        conn_addrs: ConnectionAddrs,
    ) -> anyhow::Result<()> {
        let addr = stream.peer_addr()?;
        let addr_str = addr.to_string();
        info!("已接受套接字连接: {addr}");

        let wss = async_tungstenite::accept_async(stream).await?;
        info!("已连接 WebSocket 客户端: {addr}");
        app.emit("on-ws-protocol-client-connected", &addr_str)?;
        conn_addrs.write().unwrap().insert(addr.to_owned());

        let (write, read) = wss.split();

        conns.write().await.push(write);

        let mut read = read.try_filter(|x| future::ready(x.is_binary()));

        while let Some(Ok(data)) = read.next().await {
            let data = data.into_data();
            trace!("WebSocket 客户端 {addr} 发送原始数据: {data:?}");
            if let Ok(body) = ws_protocol::parse_body(&data) {
                match &body {
                    Body::OnAudioData { .. } => {}
                    _ => {
                        trace!("WebSocket 客户端 {addr} 解析到原始数据: {body:?}");
                    }
                }
                app.emit("on-ws-protocol-client-body", body)?;
            }
        }

        info!("已断开 WebSocket 客户端: {addr}");
        app.emit("on-ws-protocol-client-disconnected", &addr_str)?;
        conn_addrs.write().unwrap().remove(&addr);
        Ok(())
    }
}
