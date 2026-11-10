import sharp from "sharp";

export const maxAvatarBytes = 2 * 1024 * 1024;
export const avatarTypes = ["image/jpeg", "image/png", "image/webp"];

export async function encodeAvatar(source: Uint8Array) {
  if (!source.byteLength || source.byteLength > maxAvatarBytes) throw new Error("Invalid file size.");
  const image = sharp(source, { limitInputPixels: 16_000_000, failOn: "warning", animated: false });
  const { format, pages } = await image.metadata();
  if (!format || !["jpeg", "png", "webp"].includes(format) || (pages ?? 1) > 1) {
    throw new Error("Unsupported image format.");
  }
  const encoded = await image.autoOrient().resize(256, 256, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  if (encoded.byteLength > 262144) throw new Error("Encoded avatar is too large.");
  return encoded;
}
