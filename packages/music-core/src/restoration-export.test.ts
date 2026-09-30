import { describe, expect, it } from "vitest";
import {
  buildRestorationExportTracks,
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
    expect(tracks[0]?.durationSeconds).toBe(5);
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
