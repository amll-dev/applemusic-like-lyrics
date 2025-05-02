use tungstenite::Bytes;

fn main() {
    let (mut ws, res) = tungstenite::connect("ws://localhost:11444").unwrap();

    let data: &[u8] = &[
        0x02, 0x00, // SetMusicInfo
        0x31, 0x00, // musicId: "1"
        0x32, 0x00, // musidName: "2"
        0x33, 0x00, // albumId: "3"
        0x34, 0x00, // albumName: "4"
        0x01, 0x00, 0x00, 0x00, // artists: size 1
        0x35, 0x00, // artist.id: "5"
        0x36, 0x00, // artist.name: "6"
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // duration: 7
    ];

    let _ = dbg!(ws_protocol::parse_body(&data));

    ws.send(tungstenite::Message::Binary(Bytes::copy_from_slice(data)))
        .unwrap();

    ws.close(None).unwrap();
}
