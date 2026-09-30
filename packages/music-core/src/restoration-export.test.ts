import { describe, expect, it } from "vitest";
import {
  buildRestorationExportTracks,
  buildRestorationZip,
  renderLogicImportGuide,
  renderReaperProject,
  renderRestorationMarkersCsv,
  renderRestorationManifest,
  type RestorationDawManifest,
} from "./restoration-export.js";
import type { StoredRestorationArtifact } from "./restoration-engine/ingest-runtime.js";

function artifact(input:Partial<StoredRestorationArtifact> & {id:string;role?:string;kind?:StoredRestorationArtifact["kind"]}):StoredRestorationArtifact{
  return {
    id:input.id,
    kind:input.kind ?? "derived",
    contentHash:input.contentHash ?? "a".repeat(64),
    sampleRate:input.sampleRate ?? 48000,
    channels:input.channels ?? 2,
    sampleCount:input.sampleCount ?? 240000,
    parentArtifactId:input.parentArtifactId,
    createdAt:input.createdAt ?? "2026-09-30T00:00:00.000Z",
    ownerUserId:input.ownerUserId ?? "user-1",
    caseId:input.caseId ?? "case-1",
    storageUri:input.storageUri ?? "memory://"+input.id,
    mimeType:input.mimeType ?? "audio/wav",
    sizeBytes:input.sizeBytes ?? 1000,
    role:input.role,
    runtimeReceiptId:input.runtimeReceiptId,
  };
}

describe("restoration DAW export",()=>{
  it("orders source and stems deterministically",()=>{
    const tracks=buildRestorationExportTracks([
      artifact({id:"bass-1",role:"bass"}),
      artifact({id:"source-1",kind:"source"}),
      artifact({id:"vocals-1",role:"vocals"}),
      artifact({id:"drums-1",role:"drums"}),
    ]);
    expect(tracks.map(track=>track.role)).toEqual(["source-mix","vocals","drums","bass"]);
    expect(tracks.every(track=>track.fileName.endsWith(".wav"))).toBe(true);
    const mixed=buildRestorationExportTracks([
      artifact({id:"source-mp3",kind:"source",mimeType:"audio/mpeg"}),
      artifact({id:"stem-flac",role:"other",mimeType:"audio/flac"}),
    ]);
    expect(mixed.map(track=>track.fileName.split(".").at(-1))).toEqual(["mp3","flac"]);
    expect(tracks[0]?.durationSeconds).toBe(5);
  });

  it("builds a self-contained deterministic ZIP with safe entry names",()=>{
    const zip=buildRestorationZip([
      {path:"stems/Vocals.wav",data:new Uint8Array([1,2,3,4])},
      {path:"restoration-manifest.json",data:"{\"ok\":true}\n"},
      {path:"project.rpp",data:"<REAPER_PROJECT 0.1\n>\n"},
    ]);
    const view=new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
    expect(view.getUint32(0,true)).toBe(0x04034b50);
    expect(view.getUint32(zip.byteLength-22,true)).toBe(0x06054b50);
    const decoded=new TextDecoder().decode(zip);
    expect(decoded).toContain("stems/Vocals.wav");
    expect(decoded).toContain("restoration-manifest.json");
    expect(decoded).toContain("project.rpp");
    expect(()=>buildRestorationZip([{path:"../escape.wav",data:"x"}])).toThrow("ZIP entry path");
    expect(()=>buildRestorationZip([
      {path:"same.txt",data:"a"},
      {path:"same.txt",data:"b"},
    ])).toThrow("Duplicate");
  });

  it("renders aligned Reaper tracks and marker positions",()=>{
    const tracks=buildRestorationExportTracks([
      artifact({id:"source-1",kind:"source"}),
      artifact({id:"vocals-1",role:"vocals"}),
    ]);
    const manifest:RestorationDawManifest={
      version:1,
      caseId:"case-1",
      title:"Archive Repair",
      createdAt:"2026-09-30T00:00:00.000Z",
      sourceArtifactId:"source-1",
      currentVersionId:"case-1:v2",
      tracks,
      markers:[{
        id:"damage-1",
        label:"Clipped vocal",
        kind:"damage",
        sample:48000,
        sampleRate:48000,
        confidence:0.93,
      }],
      restorationHistory:[],
      notes:[],
    };
    const rpp=renderReaperProject(manifest);
    expect(rpp).toContain("MARKER 1 1.000000000");
    expect(rpp).toContain('FILE "stems/');
    expect(rpp.match(/POSITION 0\.00000000000000/g)?.length).toBe(2);
    const csv=renderRestorationMarkersCsv(manifest.markers);
    expect(csv).toContain('"1.000000"');
    expect(renderLogicImportGuide(manifest)).toContain("Source sample rate: 48000 Hz");
    expect(JSON.parse(renderRestorationManifest(manifest)).caseId).toBe("case-1");
  });
});
