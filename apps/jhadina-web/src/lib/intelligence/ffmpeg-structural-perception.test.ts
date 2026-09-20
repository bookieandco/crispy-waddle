import { describe, expect, it } from "vitest";
import {
  CompositeMediaExtractionBackend,
  FfmpegStructuralPerceptionBackend,
} from "./ffmpeg-structural-perception";

const video:any = {
  assetId:"a1",actorId:"u1",modality:"video",
  assetRef:"supabase://jhadina-intake-private/trusted/u1/x/v.mp4",
  mediaType:"video/mp4",privacyClass:"sensitive",
};

describe("FfmpegStructuralPerceptionBackend", () => {
  it("turns decoded frames and audio windows into timing evidence without semantic claims", async () => {
    const backend = new FfmpegStructuralPerceptionBackend(
      { async signedReadUrl() { return "https://signed.test/v.mp4"; } },
      {
        async *decodeFrames() {
          yield { assetId:"a1",timestampSeconds:0,frameRef:"frame:0" };
          yield { assetId:"a1",timestampSeconds:1,frameRef:"frame:1" };
        },
        async *decodeAudio() {
          yield { assetId:"a1",startSeconds:0,endSeconds:2,audioRef:"audio:0" };
        },
      },
      { maxFrames: 2, maxAudioWindows: 1 },
    );
    const out = await backend.extract(video);
    expect(out.observations.map((item) => item.kind)).toEqual([
      "video.frame.sample", "video.frame.sample", "video.audio.window",
    ]);
    expect(out.observations.some((item) => item.summary.includes("boxer"))).toBe(false);
  });

  it("composes structural and semantic backends", async () => {
    const composite = new CompositeMediaExtractionBackend([
      { async extract() { return { observations:[{kind:"video.frame.sample",summary:"frame"}], uncertainty:["structural"] }; } },
      { async extract() { return { observations:[{kind:"video.scene",summary:"scene"}], uncertainty:["semantic"] }; } },
    ]);
    const out = await composite.extract(video);
    expect(out.observations).toHaveLength(2);
    expect(out.uncertainty).toEqual(["structural","semantic"]);
  });
});
