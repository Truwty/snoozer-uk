export const profileBackgroundVideoIncoming = "profile-background-incoming";
export const profileBackgroundVideoFinal = "profile-background-videos";
export const profileBackgroundVideoMaxBytes = 50 * 1024 * 1024;

export const profileBackgroundVideoFormats = {
  mp4: { contentType: "video/mp4", label: "MP4" },
  webm: { contentType: "video/webm", label: "WebM" },
} as const;

export type ProfileBackgroundVideoExtension = keyof typeof profileBackgroundVideoFormats;

export function profileBackgroundVideoExtension(value: string): ProfileBackgroundVideoExtension | null {
  if (value === "video/mp4") return "mp4";
  if (value === "video/webm") return "webm";
  return null;
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
