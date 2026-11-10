import sharp from "sharp";
import { galleryMaxBytes } from "./gallery";

export async function encodeGalleryImage(source: Uint8Array) {
  if (!source.byteLength || source.byteLength > galleryMaxBytes) throw new Error("Invalid file size.");
  const bytes = Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpeg && !webp) throw new Error("Unsupported image format.");
  // Some PNG decoders only report the first APNG frame.
  if (png) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const next = offset + 12 + bytes.readUInt32BE(offset);
      if (next > bytes.length) throw new Error("Truncated image.");
      if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("Animated PNG.");
      offset = next;
    }
  }
  const image = sharp(source, { limitInputPixels: 16_000_000, failOn: "warning", animated: false });
  const { format, pages } = await image.metadata();
  if (!format || !["jpeg", "png", "webp"].includes(format) || (pages ?? 1) > 1) {
    throw new Error("Unsupported image format.");
  }
  const resized = image.autoOrient().resize(1280, 1280, { fit: "inside", withoutEnlargement: true });
  for (const quality of [80, 62]) {
    const result = await resized.clone().webp({ quality }).toBuffer({ resolveWithObject: true });
    if (result.data.byteLength <= 1048576) return result;
  }
  throw new Error("Encoded image is too large.");
}
