import sharp from "sharp";
import { expect, it } from "vitest";
import { encodeAvatar, maxAvatarBytes } from "../src/lib/avatar";

it("encodes a raster into a bounded square WebP with metadata stripped", async () => {
  const image = await sharp({ create: { width: 30, height: 60, channels: 3, background: "green" } })
    .jpeg().withMetadata({ orientation: 2 }).toBuffer();
  const result = await sharp(await encodeAvatar(image)).metadata();
  expect(result).toMatchObject({ format: "webp", width: 256, height: 256 });
  expect(result.exif).toBeUndefined();
});

it("rejects malformed and oversized inputs and SVG payloads", async () => {
  await expect(encodeAvatar(Buffer.from("fake image"))).rejects.toThrow();
  await expect(encodeAvatar(Buffer.alloc(maxAvatarBytes + 1))).rejects.toThrow("Invalid file size");
  await expect(encodeAvatar(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')))
    .rejects.toThrow("Unsupported image format");
});
