import { describe, expect, it } from "vitest";
import { activeMusicDawClip, initializeMusicDawSession,
  musicDawClipGain, splitMusicDawClip, validateMusicDawSession,
  admitMusicDawPlugin, insertMusicDawPlugin } from "./music-daw-session.js";
const source={id:"original",sha256:"a".repeat(64),kind:"source",mimeType:"audio/wav",sampleRate:48000,sampleCount:480000};
const stem={...source,id:"kick",sha256:"b".repeat(64),kind:"derived",role:"drums.kick"};
const assets=[source,stem];
const make=()=>initializeMusicDawSession("case",assets,"2026-10-07T12:00:00.000Z");
describe("portable non-destructive DAW edit contracts",()=>{
  it("sets exact initial 0dB / centered pan and avoids doubling source/stems",()=>{
    const x=make();
    expect(x.tracks.map(t=>[t.gainDb,t.pan,t.mute])).toEqual([[0,0,false],[0,0,true]]);
    expect(validateMusicDawSession(x,"case",assets)).toBe(x);
  });
  it("splits a sampled clip preserving source time and never re-encodes audio",()=>{
    const track=make().tracks[0]!;
    const split=splitMusicDawClip(track,track.clips[0]!.id,4);
    expect(split.clips.map(c=>[c.startSeconds,c.endSeconds,c.sourceOffsetSeconds]))
      .toEqual([[0,4,0],[4,10,4]]);
    expect(activeMusicDawClip(split,5)?.sourceOffsetSeconds).toBe(4);
    expect(musicDawClipGain(split.clips[0]!,8)).toBe(0);
    expect(validateMusicDawSession({...make(),tracks:[split,make().tracks[1]!] },"case",assets).tracks).toHaveLength(2);
  });
  it("rejects foreign source hash, forged clock, clipped gain and clip overlap",()=>{
    const x=make();x.tracks[0]!.sourceSha256="c".repeat(64);
    expect(()=>validateMusicDawSession(x,"case",assets)).toThrow("INTEGRITY");
    const y=make();y.tracks[0]!.durationSeconds=123;
    expect(()=>validateMusicDawSession(y,"case",assets)).toThrow("INTEGRITY");
    const z=make();z.tracks[0]!.gainDb=50;
    expect(()=>validateMusicDawSession(z,"case",assets)).toThrow("INTEGRITY");
    const q=make();q.tracks[0]!.clips.push({...q.tracks[0]!.clips[0]!,id:"overlap",startSeconds:2});
    expect(()=>validateMusicDawSession(q,"case",assets)).toThrow("OVERLAPPING");
  });
  it("offers native VST3/AU slots without claiming browser execution",()=>{
    const original = make().tracks[1]!;
    const vst = insertMusicDawPlugin(original,{
      id:"vst-slot",pluginId:"vendor.test.synth",name:"External Synth",format:"vst3",
    });
    expect(vst.pluginRack?.[0]?.hostStatus).toBe("needs-native-host");
    expect(admitMusicDawPlugin(vst.pluginRack![0]!,"phone-web").executableHere).toBe(false);
    expect(admitMusicDawPlugin(vst.pluginRack![0]!,"laptop-browser").executableHere).toBe(false);
    expect(validateMusicDawSession({...make(),tracks:[make().tracks[0]!,vst]},"case",assets).revision).toBe(0);
    expect(admitMusicDawPlugin({
      ...vst.pluginRack![0]!,hostStatus:"native-validated", installedPluginId:"signed-installed-1",
    },"desktop-companion",{
      approved:true,reachable:true,platform:"macos",formats:["au","vst3"],
      receiptId:"local-scanner-proof",installedPluginIds:["signed-installed-1"],
    }).route).toBe("trusted-companion");
  });
  it("inserts playable Web Audio rack effects and rejects unknown native binding",()=>{
    const stem = insertMusicDawPlugin(make().tracks[1]!,{
      id:"echo-1",pluginId:"jhadina.web.delay",name:"Stereo Delay",format:"web-audio",
    });
    expect(admitMusicDawPlugin(stem.pluginRack![0]!,"phone-web").executableHere).toBe(true);
    const forged={...stem,pluginRack:[{...stem.pluginRack![0]!,format:"vst3" as const,
      hostStatus:"native-validated" as const,installedPluginId:"../../unsafe.vst3"}]};
    expect(()=>validateMusicDawSession({...make(),tracks:[make().tracks[0]!,forged]},"case",assets)).toThrow("INTEGRITY");
  });
});
