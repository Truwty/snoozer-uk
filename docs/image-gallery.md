# Studio image gallery

Open **Studio → Image gallery** to upload, reorder, or remove up to eight images. Give each image a short description for screen readers. The file can be a single JPEG, PNG or WebP up to 4 MiB and 16 megapixels. Publish from Studio when the gallery is ready. Removing an image from the draft leaves the current public page unchanged until the next publish.

Snoozer issues a signed write URL for a private staging path; the original file goes directly to Supabase Storage. The server validates the raster, applies orientation, strips metadata, resizes to fit within 1280 × 1280, and stores a WebP derivative up to 1 MiB in a separate private bucket. Only an upload that completes the expected-revision transaction becomes visible in the draft. A pending attempt can be retried or discarded. It expires after two hours; each profile can start up to 12 attempts per UTC day and retain up to 48 gallery items across drafts, staging and history.

Migration `20261110000900_image_gallery.sql` adds both private buckets and the gallery registry. The public route reads an asset only if it belongs to the profile’s current publication. The Studio route checks ownership and permits draft or retained history images. Restoring a publication restores its image order to the draft. Public responses are served as WebP with no shared cache so unpublishing takes effect on the next request. An image someone previously downloaded cannot be recalled.

The existing [cleanup command](avatar-cleanup.md) now processes both gallery buckets on profile deletion. It also collects gallery registry entries older than 24 hours when neither a draft nor retained publication references them, then removes aged orphan files through the Storage API. Files left by interrupted processing or late signed uploads are eligible for this sweep. Apply the migration before running the updated worker. A hosted schedule, aggregate free-tier capacity monitoring and videos remain open.

## Private folders

Open **Image gallery → Organise media folders** to filter the library, create or rename a folder, or move an image by choosing a destination and saving its location. The library includes current draft images and images kept by publish history. Pending, blocked and unreferenced images do not appear. Each profile can create 12 folders. Names are case-insensitively unique per profile, and **Unfiled** is reserved. Deleting a folder moves its images to Unfiled.

Migration `20261110001100_media_folders.sql` uses an owner-scoped reference and a folder revision separate from the profile draft. Moving or deleting a folder leaves published content, gallery order and storage cleanup rules unchanged. Folder names and IDs never appear on a public page. A folder cannot extend how long a removed image is retained.

## Operator takedowns

After migration `20261110001000_gallery_takedown.sql`, operators can run `npm run moderation:gallery -- <username> <image-id> <case-reference>` from an authorised environment. Set the intended project URL and service-role secret securely. The image ID is the UUID at the end of its media URL. Use an opaque case ID without personal information or report text.

The command blocks that image on the live page and in Studio and history. The database records the case ID, media scope, asset ID and timestamp. A repeat call leaves the original record in place. The snapshot itself is preserved, and restoring it skips blocked images. Blocking does not recall prior downloads or immediately erase the source derivative. A full moderation queue, per-operator attribution, notices and appeals remain open.
