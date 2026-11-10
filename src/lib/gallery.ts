import { z } from "zod";

export const galleryLimit = 8;
export const galleryMaxBytes = 4 * 1024 * 1024;
export const galleryTypes = ["image/jpeg", "image/png", "image/webp"];
export const galleryIncoming = "gallery-incoming";
export const galleryImages = "gallery-images";
export const galleryAlt = z.string().trim().min(1).refine((value) => Array.from(value).length <= 180);
export const galleryItem = z.object({
  id: z.uuid(),
  alt: galleryAlt,
  width: z.number().int().min(1).max(1280),
  height: z.number().int().min(1).max(1280),
});
export const pendingGalleryItem = galleryItem.pick({ id: true, alt: true });
export type GalleryItem = z.infer<typeof galleryItem>;
