import type { GalleryItem } from "./gallery";

const mebibyte = 1024 * 1024;
export const galleryAdvisoryBudget = 12 * mebibyte;

export function estimateGalleryMemory(images: readonly Pick<GalleryItem, "width" | "height">[]) {
  // Four bytes per pixel estimates one decoded RGBA surface per image.
  return images.reduce((total, image) => total + image.width * image.height * 4, 0);
}

export function galleryMemoryWarning(images: Parameters<typeof estimateGalleryMemory>[0]) {
  const bytes = estimateGalleryMemory(images);
  return bytes > galleryAdvisoryBudget ? (bytes / mebibyte).toFixed(1) : null;
}
