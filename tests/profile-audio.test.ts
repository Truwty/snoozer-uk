import {describe,expect,it} from "vitest";
import {profileAudioCanShuffle,profileAudioExtension,validProfileAudioBytes} from "../src/lib/profile-audio";

describe("profile audio validation",()=>{
  it("maps only the supported MIME types",()=>{
    expect(profileAudioExtension("audio/mpeg")).toBe("mp3");
    expect(profileAudioExtension("audio/mp4")).toBe("m4a");
    expect(profileAudioExtension("audio/ogg")).toBe("ogg");
    expect(profileAudioExtension("audio/wav")).toBe("wav");
    expect(profileAudioExtension("audio/aac")).toBe("aac");
    expect(profileAudioExtension("audio/flac")).toBe("flac");
    expect(profileAudioExtension("audio/webm")).toBeNull();
    expect(profileAudioExtension("audio/mp3")).toBe("mp3");
    expect(profileAudioExtension("audio/x-m4a")).toBe("m4a");
    expect(profileAudioExtension("audio/x-wav")).toBe("wav");
    expect(profileAudioExtension("audio/x-flac")).toBe("flac");
    expect(profileAudioExtension("application/octet-stream", "voice.mp3")).toBe("mp3");
    expect(profileAudioExtension("", "voice.m4a")).toBe("m4a");
    expect(profileAudioExtension("audio/webm", "voice.mp3")).toBeNull();
  });
  it("checks file signatures rather than trusting the extension",()=>{
    expect(validProfileAudioBytes(new TextEncoder().encode("ID3xxxxx"),"mp3")).toBe(true);
    expect(validProfileAudioBytes(new TextEncoder().encode("0000ftypM4A "), "m4a")).toBe(true);
    expect(validProfileAudioBytes(new TextEncoder().encode("OggSxxxx"),"ogg")).toBe(true);
    expect(validProfileAudioBytes(new TextEncoder().encode("RIFFxxxxWAVE"),"wav")).toBe(true);
    expect(validProfileAudioBytes(new Uint8Array([0xff,0xf1,0,0,0,0,0,0]),"aac")).toBe(true);
    expect(validProfileAudioBytes(new TextEncoder().encode("fLaCxxxx"),"flac")).toBe(true);
    expect(validProfileAudioBytes(new TextEncoder().encode("OggSxxxx"),"mp3")).toBe(false);
    expect(validProfileAudioBytes(new TextEncoder().encode("OggSxxxx"),"ogg")).toBe(true);
  });
});

describe("profile audio shuffle",()=>{
  it("requires at least two tracks",()=>{
    expect(profileAudioCanShuffle(0)).toBe(false);
    expect(profileAudioCanShuffle(1)).toBe(false);
    expect(profileAudioCanShuffle(2)).toBe(true);
    expect(profileAudioCanShuffle(3)).toBe(true);
    expect(profileAudioCanShuffle(1.5)).toBe(false);
  });
});
