import { parseBlob, selectCover } from "music-metadata";

export async function extractCoverBlob(file: File): Promise<Blob | null> {
	const metadata = await parseBlob(file, { skipCovers: false });
	const cover = selectCover(metadata.common.picture);
	if (!cover) return null;

	const data = new Uint8Array(cover.data);
	return new Blob(
		[data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)],
		{
			type: cover.format,
		},
	);
}
