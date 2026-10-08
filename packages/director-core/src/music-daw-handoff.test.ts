import { describe,it,expect } from "vitest";
import { createDawDirectorImportPlan,stageRegisteredDawDirectorAudio,
  type DawDirectorSourceReceipt } from "./music-daw-handoff.js";

const hash=(ch:string)=>ch.repeat(64);
const receipt=():DawDirectorSourceReceipt=>({
  schema:"jhadina-music-daw-edited-stems/v1",caseId:"music-case",revision:4,
  operationClass:"non-destructive-edited-stems-dry-bounce",
  masterOutputSha256:hash("a"),receiptSha256:hash("b"),
  sampleRate:48000,sampleCount:144000,channels:2,
  sourcesImmutable:true,pluginsExecuted:false,eqExecuted:false,
  compressionExecuted:false,restorationCertified:false,
  needsListeningReview:true,readbackNullQc:{passed:true,maxAbsoluteError:1e-6,residualRatio:2e-6},
  stems:[{artifactId:"stem-1",trackName:"Lead vocals",role:"vocal-reviewed.lead",
    fileName:"stems/track-01.wav",sourceSha256:hash("c"),
    outputSha256:hash("d"),sampleCount:144000}],
});
const registration=()=>[{artifactId:"stem-1",directorAssetId:"private-video-asset-1",
  registeredOutputSha256:hash("d"),sampleRate:48000,sampleCount:144000,
  channels:2 as const,audioBytesVerified:true as const,
  registrationReceiptId:"trusted-ingest:receipt-1"}];

describe("DAW -> Director soundtrack handoff",()=>{
  it("does not label owner-bounced stems as registered or restoration-certified",()=>{
    const plan=createDawDirectorImportPlan(receipt());
    expect(plan.registrationStatus).toBe("pending-owner-scoped-media-registration");
    expect(plan.restorationCertified).toBe(false);
    expect(plan.needsOwnerReview).toBe(true);
    expect(plan.sourceReceiptSha256).toBe(hash("b"));
  });
  it("stages a sample-exact audio timeline only after SHA-bound media registration",()=>{
    const result=stageRegisteredDawDirectorAudio({plan:createDawDirectorImportPlan(receipt()),
      registered:registration(),projectId:"director-project",fps:24,width:1920,height:1080});
    const clip=result.timelineDraft.tracks[0]?.clips[0];
    expect(result.requiresOwnerReview).toBe(true);
    expect(result.sourceRevision).toBe(4);
    expect(clip?.durationSeconds).toBe(3);
    expect(clip?.sourceInSeconds).toBe(0);
    expect(clip?.assetId).toBe("private-video-asset-1");
    expect(result.timelineDraft.tracks[0]?.role).toBe("music");
    expect(result.timelineDraft.versions).toEqual([]);
  });
  it("rejects bogus null QC, active native effects, source confusion and unregistered media",()=>{
    const bad=receipt();bad.pluginsExecuted=true as false;
    expect(()=>createDawDirectorImportPlan(bad)).toThrow("UNVERIFIED");
    const qc=receipt();qc.readbackNullQc.maxAbsoluteError=.2;
    expect(()=>createDawDirectorImportPlan(qc)).toThrow("UNVERIFIED");
    const plan=createDawDirectorImportPlan(receipt());
    const forged=registration();forged[0]!.registeredOutputSha256=hash("f");
    expect(()=>stageRegisteredDawDirectorAudio({plan,registered:forged,
      projectId:"x",fps:30,width:1920,height:1080})).toThrow("HASH_MISMATCH");
    expect(()=>stageRegisteredDawDirectorAudio({plan,registered:[],
      projectId:"x",fps:30,width:1920,height:1080})).toThrow("REGISTRATION_PLAN_INVALID");
  });
  it("rejects mismatched sample clocks, repeated tracks, and unsafe file names",()=>{
    const a=receipt();a.stems[0]!.sampleCount=144001;
    expect(()=>createDawDirectorImportPlan(a)).toThrow("SOURCE_BINDING");
    const b=receipt();b.stems[0]!.fileName="../escape.wav";
    expect(()=>createDawDirectorImportPlan(b)).toThrow("SOURCE_BINDING");
    const c=receipt();c.stems.push({...c.stems[0]!,fileName:"stems/track-02.wav"});
    expect(()=>createDawDirectorImportPlan(c)).toThrow("SOURCE_BINDING");
  });
});
