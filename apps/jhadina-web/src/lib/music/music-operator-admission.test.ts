import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { commitReviewedMusicAdmission } from "./music-operator-admission";
import type { ReviewedAudioReceipt } from "./verified-audio-admission";

const owner = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const bytes = new TextEncoder().encode("verified audio bytes from private bucket");
const digest = createHash("sha256").update(bytes).digest("hex");
const receipt: ReviewedAudioReceipt = {
  ownerUserId: owner, track: { id:"track-1",title:"Song",artistIds:[] },
  storageBucket:"music-owned", storagePath: `${owner}/${fileId}.mp3`,
  storageObjectUrl: `https://media.example.test/storage/v1/object/authenticated/music-owned/${owner}/${fileId}.mp3`,
  contentSha256:digest,byteCount:bytes.length,mimeType:"audio/mpeg",
  actualBytesVerifiedAt:new Date().toISOString(),
  rightsEvidenceRef:"reviewed-owner-contract-100",
  rightsReviewedAt:new Date().toISOString(),
  rightsReviewedBy:"rights-reviewer-1",operatorId:"independent-operator-2",
};
function fakeDB(observed = bytes) {
  const rpc = vi.fn(async (_name: string, params: { _asset: { id: string; trackId: string } }) => ({
    data:{admitted:true,assetId:params._asset.id,trackId:params._asset.trackId},error:null,
  }));
  const download = vi.fn(async () => ({
    data:{arrayBuffer:async()=>observed.buffer.slice(observed.byteOffset,observed.byteOffset+observed.byteLength)},
    error:null,
  }));
  const db = { storage:{from:()=>({download})},rpc } as unknown as SupabaseClient;
  return { db,rpc,download };
}
const input = { receipt, trustedStorageOrigin:"https://media.example.test",operatorIdentity:receipt.operatorId,admissionEnabled:true };
describe("operator-only reviewed owned audio commit",()=>{
  it("verifies downloaded bytes and commits only through a single transaction RPC",async()=>{
    const {db,rpc,download}=fakeDB();
    const result=await commitReviewedMusicAdmission(db,input);
    expect(result.admitted).toBe(true);
    expect(download).toHaveBeenCalledWith(receipt.storagePath);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("music_operator_admit_owned",expect.objectContaining({
      _owner:owner,_source:expect.objectContaining({authorized:true}),
      _asset:expect.objectContaining({kind:"file"}),
    }));
  });
  it("does not touch storage or RPC until an independent operator opens the gate",async()=>{
    const {db,rpc,download}=fakeDB();
    await expect(commitReviewedMusicAdmission(db,{...input,admissionEnabled:false})).rejects.toThrow("gate locked");
    await expect(commitReviewedMusicAdmission(db,{...input,operatorIdentity:owner})).rejects.toThrow("gate locked");
    expect(download).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects altered downloaded bytes before RPC",async()=>{
    const {db,rpc}=fakeDB(new TextEncoder().encode("tampered object, wrong size"));
    await expect(commitReviewedMusicAdmission(db,input)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
