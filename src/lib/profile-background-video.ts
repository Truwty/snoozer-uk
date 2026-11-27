export const profileBackgroundVideoIncoming = "profile-background-incoming";
export const profileBackgroundVideoFinal = "profile-background-videos";
export const profileBackgroundVideoMaxBytes = 50 * 1024 * 1024;

export const profileBackgroundVideoFormats = {
  mp4: { contentType: "video/mp4", label: "MP4" },
  webm: { contentType: "video/webm", label: "WebM" },
} as const;

export type ProfileBackgroundVideoExtension = keyof typeof profileBackgroundVideoFormats;

const videoMimeAliases: Record<ProfileBackgroundVideoExtension, readonly string[]> = {
  mp4: ["video/mp4", "video/x-m4v", "application/mp4"],
  webm: ["video/webm", "audio/webm"],
};

const videoExtensionAliases: Record<string, ProfileBackgroundVideoExtension> = {
  mp4: "mp4", m4v: "mp4",
  webm: "webm",
};

export function profileBackgroundVideoExtension(value: string, fileName?: string): ProfileBackgroundVideoExtension | null {
  const mime = value.split(";")[0].trim().toLowerCase();
  for (const [extension, aliases] of Object.entries(videoMimeAliases) as [ProfileBackgroundVideoExtension, readonly string[]][]) {
    if (aliases.includes(mime)) return extension;
  }
  const suffix = fileName?.toLowerCase().split(".").pop() ?? "";
  const byFileName = videoExtensionAliases[suffix];
  if (!byFileName) return null;
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") return byFileName;
  return videoMimeAliases[byFileName].includes(mime) ? byFileName : null;
}

export function validProfileBackgroundVideoBytes(bytes: Uint8Array, extension: ProfileBackgroundVideoExtension) {
  if (bytes.length < 12 || bytes.length > profileBackgroundVideoMaxBytes) return false;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  switch (extension) {
    case "mp4":
      return ascii(4, 8) === "ftyp";
    case "webm":
      return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
}
