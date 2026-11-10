import { z } from "zod";
import { galleryItem } from "./gallery";

export const mediaFolderLimit = 12;
export const mediaFolderName = z.string().trim().min(1).refine((value) =>
  Array.from(value).length <= 60 && !/[\p{Cc}]/u.test(value) && value.toLowerCase() !== "unfiled");

const folder = z.object({ id: z.uuid(), name: z.string().min(1).max(120) });
const libraryItem = galleryItem.extend({ folder: z.uuid().nullable(), in_draft: z.boolean() });

export const mediaLibrary = z.object({
  scope: z.uuid(),
  revision: z.number().int().nonnegative().max(2147483647),
  folders: z.array(folder).max(mediaFolderLimit),
  items: z.array(libraryItem).max(48),
});

export const folderEdit = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), name: mediaFolderName }),
  z.object({ operation: z.literal("rename"), id: z.uuid(), name: mediaFolderName }),
  z.object({ operation: z.literal("delete"), id: z.uuid() }),
  z.object({ operation: z.literal("move"), id: z.uuid(), folder: z.uuid().nullable() }),
]);
export type FolderEdit = z.input<typeof folderEdit>;
export type MediaLibrary = z.infer<typeof mediaLibrary>;
