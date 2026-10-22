import { describe, expect, it } from "vitest";
import { localMusicFileError, localMusicTitle, LOCAL_MUSIC_MAX_BYTES } from "./local-music-rules";

describe("Private browser music file admission", () => {
  it("accepts audio recordings and rejects disguised or oversized files", () => {
    expect(localMusicFileError({ name: "My Song.mp3", type: "audio/mpeg", size: 1024 })).toBeNull();
    expect(localMusicFileError({ name: "Track.m4a", type: "", size: 1024 })).toBeNull();
    expect(localMusicFileError({ name: "not-an-audio.mp3.exe", type: "audio/mpeg", size: 1024 })).not.toBeNull();
    expect(localMusicFileError({ name: "fake.mp3", type: "text/html", size: 1024 })).not.toBeNull();
    expect(localMusicFileError({ name: "huge.wav", type: "audio/wav", size: LOCAL_MUSIC_MAX_BYTES + 1 })).not.toBeNull();
    expect(localMusicFileError({ name: "empty.mp3", type: "audio/mpeg", size: 0 })).not.toBeNull();
  });
  it("keeps human-readable titles without changing original file names", () => {
    expect(localMusicTitle("Party_Nites.m4a")).toBe("Party Nites");
    expect(localMusicTitle("Mix_01.flac")).toBe("Mix 01");
  });
});
