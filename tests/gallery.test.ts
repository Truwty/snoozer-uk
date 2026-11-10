import sharp from "sharp";
import { expect, it } from "vitest";
import { encodeGalleryImage } from "../src/lib/gallery-codec";

it("resizes an image without distortion and strips source metadata", async () => {
  const source = await sharp({ create: { width: 1600, height: 800, channels: 3, background: "navy" } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const result = await encodeGalleryImage(source);
  const metadata = await sharp(result.data).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 640, height: 1280 });
  expect(metadata.exif).toBeUndefined();
});

it("rejects disguised or animated content and overlarge images", async () => {
  const animatedPngHeader = Buffer.from("89504e470d0a1a0a000000006163544c00000000", "hex");
  await expect(encodeGalleryImage(animatedPngHeader)).rejects.toThrow("Animated PNG");
  await expect(encodeGalleryImage(Buffer.from("<svg/>"))).rejects.toThrow("Unsupported");
  const large = await sharp({ create: { width: 4100, height: 4100, channels: 3, background: "navy" } }).png().toBuffer();
  await expect(encodeGalleryImage(large)).rejects.toThrow(/pixel limit/i);
});
