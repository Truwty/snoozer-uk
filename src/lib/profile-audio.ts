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

export function profileAudioExtension(value: string): ProfileAudioExtension | null {
  return Object.entries(profileAudioFormats).find(([,format])=>format.contentType===value)?.[0] as ProfileAudioExtension | undefined ?? null;
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
