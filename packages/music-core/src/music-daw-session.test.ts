import { describe, expect, it } from "vitest";
import { activeMusicDawClip, initializeMusicDawSession,
  musicDawClipGain, splitMusicDawClip, validateMusicDawSession,
  admitMusicDawPlugin, insertMusicDawPlugin, musicDawAutomationValue,
  moveMusicDawClip, duplicateMusicDawClip, trimMusicDawClipStart } from "./music-daw-session.js";
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
  it("interpolates actual absolute fader/pan automation and holds endpoints",()=>{
    const track=make().tracks[1]!;
    track.automation={gainDb:[{atSeconds:0,value:-12},{atSeconds:4,value:0}],
      pan:[{atSeconds:1,value:-1},{atSeconds:5,value:1}]};
    expect(musicDawAutomationValue(track,"gainDb",2)).toBe(-6);
    expect(musicDawAutomationValue(track,"gainDb",9)).toBe(0);
    expect(musicDawAutomationValue(track,"pan",3)).toBe(0);
    expect(musicDawAutomationValue(track,"pan",0)).toBe(-1);
    expect(validateMusicDawSession({...make(),tracks:[make().tracks[0]!,track]},"case",assets)).toBeTruthy();
  });
  it("rejects unsorted, duplicate and out-of-range automation",()=>{
    const track=make().tracks[0]!;
    track.automation={pan:[{atSeconds:3,value:0},{atSeconds:2,value:1}]};
    expect(()=>validateMusicDawSession({...make(),tracks:[track,make().tracks[1]!]},"case",assets))
      .toThrow("INTEGRITY");
    track.automation={gainDb:[{atSeconds:0,value:20}]};
    expect(()=>validateMusicDawSession({...make(),tracks:[track,make().tracks[1]!]},"case",assets))
      .toThrow("INTEGRITY");
  });
  it("moves a separated clip on exact sample grid without mutating source offset",()=>{
    const track=make().tracks[0]!;
    const shifted=moveMusicDawClip(track,track.clips[0]!.id,12.067,48000,.125);
    expect(shifted.clips[0]!.startSeconds).toBe(12.125);
    expect(shifted.clips[0]!.sourceOffsetSeconds).toBe(0);
    expect(shifted.clips[0]!.endSeconds).toBe(22.125);
    expect(track.clips[0]!.startSeconds).toBe(0);
    expect(validateMusicDawSession({...make(),tracks:[shifted,make().tracks[1]!] },
      "case",assets).tracks).toHaveLength(2);
  });
  it("duplicates an editable clip at a different time and blocks overlap",()=>{
    const track=make().tracks[0]!;
    const copied=duplicateMusicDawClip(track,track.clips[0]!.id,"take-b",10,48000);
    expect(copied.clips.map(x=>[x.id,x.startSeconds,x.sourceOffsetSeconds]))
      .toEqual([[track.clips[0]!.id,0,0],["take-b",10,0]]);
    expect(()=>duplicateMusicDawClip(track,track.clips[0]!.id,"take-b",5,48000))
      .toThrow("OVERLAP");
    expect(()=>duplicateMusicDawClip(copied,track.clips[0]!.id,"take-b",20,48000))
      .toThrow("ID");
  });
  it("slip-trims a clip start without shifting its remaining source samples",()=>{
    const track=make().tracks[0]!;
    const trimmed=trimMusicDawClipStart(track,track.clips[0]!.id,3.125,48000);
    expect(trimmed.clips[0]!.sourceOffsetSeconds).toBe(3.125);
    expect(trimmed.clips[0]!.endSeconds).toBe(10);
    expect(trimmed.clips[0]!.startSeconds).toBe(3.125);
    expect(()=>trimMusicDawClipStart(track,track.clips[0]!.id,-1,48000))
      .toThrow();
    expect(validateMusicDawSession({...make(),tracks:[trimmed,make().tracks[1]!] },
      "case",assets).revision).toBe(0);
  });
  it("rejects a clip moving over another clip or invalid sample clock",()=>{
    const track=duplicateMusicDawClip(make().tracks[0]!,"clip:original","second",11,48000);
    expect(()=>moveMusicDawClip(track,"second",5,48000)).toThrow("OVERLAP");
    expect(()=>moveMusicDawClip(track,"second",12,0)).toThrow("POSITION");
  });

});
