use crate::AudioInfo;
use ffmpeg_next as ffmpeg;

pub fn read_audio_info(input_ctx: &mut ffmpeg::format::context::Input) -> AudioInfo {
    let mut new_audio_info = AudioInfo::default();

    let metadata = input_ctx.metadata();
    if let Some(title) = metadata.get("title") {
        new_audio_info.name = title.to_string();
    }
    if let Some(artist) = metadata.get("artist") {
        new_audio_info.artist = artist.to_string();
    }
    if let Some(album) = metadata.get("album") {
        new_audio_info.album = album.to_string();
    }
    if let Some(lyrics) = metadata.get("lyrics") {
        new_audio_info.lyric = lyrics.to_string();
    }
    if let Some(comment) = metadata.get("comment") {
        new_audio_info.comment = comment.to_string();
    }

    'outer: for (stream, packet) in input_ctx.packets() {
        if stream
            .disposition()
            .contains(ffmpeg::format::stream::Disposition::ATTACHED_PIC)
        {
            if let Some(data) = packet.data() {
                new_audio_info.cover = Some(data.to_vec());
                let codec_name = ffmpeg::codec::decoder::find(stream.parameters().id())
                    .map(|d| d.name().to_string())
                    .unwrap_or("unknown".to_string());
                new_audio_info.cover_media_type = format!("image/{}", codec_name.to_lowercase());
                break 'outer;
            }
        }
    }

    input_ctx.seek(0, ..).ok();

    new_audio_info
}
