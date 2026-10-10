import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { planVerifiedOwnedAudioAdmission } from "./verified-audio-admission";
import type { ReviewedAudioReceipt } from "./verified-audio-admission";

const owner="11111111-1111-4111-8111-111111111111";
const id="22222222-2222-4222-8222-222222222222";
const now=Date.parse("2026-10-09T23:00:00Z");
const sampleBytes = new TextEncoder().encode("reviewed-owned-audio-original-bytes");
const sampleHash = createHash("sha256").update(sampleBytes).digest("hex");
const receipt: ReviewedAudioReceipt = {
  ownerUserId:owner,track:{id:"my-track",title:"Owned Music",artistIds:[]},
  storageBucket:"music-owned",storagePath:`${owner}/${id}.mp3`,
  storageObjectUrl:`https://db.example.test/storage/v1/object/authenticated/music-owned/${owner}/${id}.mp3`,
  contentSha256:sampleHash,byteCount:sampleBytes.length,mimeType:"audio/mpeg",
  actualBytesVerifiedAt:"2026-10-09T12:00:00Z",
  rightsEvidenceRef:"owner-contract:verified-123",
  rightsReviewedAt:"2026-10-09T12:30:00Z",rightsReviewedBy:"reviewer:music",
  operatorId:"operator:audio",
};
describe("operator review prepares but never executes owned media grants",()=>{
  it("creates a deterministic source+asset with separate byte and rights evidence",()=>{
    const plan=planVerifiedOwnedAudioAdmission(receipt,"https://db.example.test",sampleBytes,now);
    expect(plan.executed).toBe(false);
    expect(plan.source.authorized).toBe(true);
    expect(plan.asset.provenance?.playbackAuthorized).toBe(true);
    expect(plan.asset.provenance?.contentSha256).toBe(sampleHash);
    expect(plan.asset.provenance?.storagePath).toBe(receipt.storagePath);
  });
  it("distinguishes assets for two track identities sharing the same verified recording",()=>{
    const first=planVerifiedOwnedAudioAdmission(receipt,"https://db.example.test",sampleBytes,now);
    const second=planVerifiedOwnedAudioAdmission({
      ...receipt,track:{ ...receipt.track,id:"a-second-track" },
    },"https://db.example.test",sampleBytes,now);
    expect(first.source.id).toBe(second.source.id);
    expect(first.asset.id).not.toBe(second.asset.id);
    expect(first.asset.trackId).not.toBe(second.asset.trackId);
  });
  it("rejects forged owner paths, public URLs, altered bytes, and self-approval",()=>{
    for (const altered of [
      {storagePath:`${owner}/../bob/a.mp3`},
      {storageObjectUrl:"https://db.example.test/storage/v1/object/public/music-owned/song.mp3"},
      {storageObjectUrl:receipt.storageObjectUrl+"?token=leaked"},
      {contentSha256:"not-a-digest"},
      {rightsReviewedBy:owner},
      {operatorId:"reviewer:music"},
      {byteCount:0},
      {rightsEvidenceRef:""},
    ]) {
      expect(()=>planVerifiedOwnedAudioAdmission({...receipt,...altered},"https://db.example.test",sampleBytes,now)).toThrow();
    }
  });
  it("rejects media sources on an untrusted host even with a structurally private path",()=>{
    expect(()=>planVerifiedOwnedAudioAdmission({
      ...receipt,storageObjectUrl:receipt.storageObjectUrl.replace("db.example.test","attacker.example.test"),
    },"https://db.example.test",sampleBytes,now)).toThrow("origin mismatch");
  });
  it("requires an exact independently downloaded byte match",()=>{
    const altered = new Uint8Array(sampleBytes);
    altered[0] ^= 1;
    expect(()=>planVerifiedOwnedAudioAdmission(receipt,"https://db.example.test",altered,now))
      .toThrow("SHA-256 does not match");
    expect(()=>planVerifiedOwnedAudioAdmission(receipt,"https://db.example.test",new Uint8Array(0),now))
      .toThrow("byte count");
  });
  it("rejects future and stale independent verification",()=>{
    expect(()=>planVerifiedOwnedAudioAdmission({...receipt,rightsReviewedAt:"2026-10-10T12:00:00Z"},"https://db.example.test",sampleBytes,now)).toThrow();
    expect(()=>planVerifiedOwnedAudioAdmission({...receipt,actualBytesVerifiedAt:"2026-01-01T12:00:00Z"},"https://db.example.test",sampleBytes,now)).toThrow();
  });
});
