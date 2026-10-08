import { describe, expect, it } from "vitest";
import { initializeMusicDawSession } from "./music-daw-session.js";
import { buildMusicDawDryBounceKit } from "./music-daw-dry-kit.js";
const asset={id:"original",sha256:"a".repeat(64),kind:"source",mimeType:"audio/wav",
  sampleRate:48000,sampleCount:48000};
const sources=[{artifactId:"original",fileName:"Original-source.wav",sha256:asset.sha256,
  sampleRate:48000,sampleCount:48000}];
const doc=()=>({...initializeMusicDawSession("case",[asset],"2026-10-07T18:00:00Z"),revision:3});
describe("DAW dry bounce kit full source/track mapping",()=>{
  it("retains exact revision, clips and hash-bound relative WAV path",()=>{
    const kit=buildMusicDawDryBounceKit(doc(),[asset],sources);
    expect(JSON.parse(kit.sessionJson).revision).toBe(3);
    expect(JSON.parse(kit.assetsJson)).toEqual([{
      id:"original",sha256:asset.sha256,localPath:"Original-source.wav",
      sampleRate:48000,sampleCount:48000,
    }]);
    expect(kit.warnings).toEqual([]);
  });
  it("rejects a renamed asset, replaced audio or unsafe ZIP path",()=>{
    expect(()=>buildMusicDawDryBounceKit(doc(),[asset],[{...sources[0]!,sha256:"c".repeat(64)}]))
      .toThrow("SOURCE_MAPPING");
    expect(()=>buildMusicDawDryBounceKit(doc(),[asset],[{...sources[0]!,fileName:"../private.wav"}]))
      .toThrow("SOURCE_MAPPING");
    expect(()=>buildMusicDawDryBounceKit({...doc(),revision:0},[asset],sources))
      .toThrow("SAVED_REVISION");
  });
  it("warns of non-WAV media and active DSP rather than claiming a mastered bounce",()=>{
    const mp3={...asset,mimeType:"audio/mpeg"};
    const d=initializeMusicDawSession("case",[mp3],"2026-10-07T18:00:00Z");
    d.revision=1;
    d.tracks[0]!.eq.midDb=2;
    const kit=buildMusicDawDryBounceKit(d,[mp3],sources);
    expect(kit.warnings).toHaveLength(2);
    expect(kit.warnings[0]).toMatch(/Non-WAV/);
    expect(kit.warnings[1]).toMatch(/Active DSP/);
  });
});
