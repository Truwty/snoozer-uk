export const profileAudioIncoming = "profile-audio-incoming";
export const profileAudioFinal = "profile-audio";
export const profileAudioMaxBytes = 15 * 1024 * 1024;

export const profileAudioFormats = {
  mp3: { contentType: "audio/mpeg", label: "MP3" },
  m4a: { contentType: "audio/mp4", label: "M4A" },
  ogg: { contentType: "audio/ogg", label: "OGG" },
  wav: { contentType: "audio/wav", label: "WAV" },
  aac: { contentType: "audio/aac", label: "AAC" },
  flac: { contentType: "audio/flac", label: "FLAC" },
} as const;

export type ProfileAudioExtension = keyof typeof profileAudioFormats;

const audioMimeAliases: Record<ProfileAudioExtension, readonly string[]> = {
  mp3: ["audio/mpeg", "audio/mp3", "audio/x-mp3", "audio/mpeg3"],
  m4a: ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/x-mp4"],
  ogg: ["audio/ogg", "application/ogg"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  aac: ["audio/aac", "audio/x-aac"],
  flac: ["audio/flac", "audio/x-flac"],
};

const audioExtensionAliases: Record<string, ProfileAudioExtension> = {
  mp3: "mp3", mpga: "mp3", mpeg: "mp3",
  m4a: "m4a", mp4: "m4a",
  ogg: "ogg", oga: "ogg",
  wav: "wav", wave: "wav",
  aac: "aac",
  flac: "flac",
};

export function profileAudioExtension(value: string, fileName?: string): ProfileAudioExtension | null {
  const mime = value.split(";")[0].trim().toLowerCase();
  for (const [extension, aliases] of Object.entries(audioMimeAliases) as [ProfileAudioExtension, readonly string[]][]) {
    if (aliases.includes(mime)) return extension;
  }

  const suffix = fileName?.toLowerCase().split(".").pop() ?? "";
  const byFileName = audioExtensionAliases[suffix];
  if (!byFileName) return null;
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") return byFileName;
  return audioMimeAliases[byFileName].includes(mime) ? byFileName : null;
}

export function validProfileAudioBytes(bytes: Uint8Array, extension: ProfileAudioExtension) {
  if (bytes.length < 8 || bytes.length > profileAudioMaxBytes) return false;
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  switch(extension){
    case "mp3":
      return ascii(0,3)==="ID3" || (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0);
    case "m4a":
      return ascii(4,8)==="ftyp";
    case "ogg":
      return ascii(0,4)==="OggS";
    case "wav":
      return ascii(0,4)==="RIFF" && ascii(8,12)==="WAVE";
    case "aac":
      return bytes[0]===0xff && (bytes[1]&0xf6)===0xf0;
    case "flac":
      return ascii(0,4)==="fLaC";
  }
}

export function profileAudioCanShuffle(trackCount: number) {
  return Number.isInteger(trackCount) && trackCount >= 2;
}
