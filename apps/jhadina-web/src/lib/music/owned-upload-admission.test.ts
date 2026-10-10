import { describe, expect, it } from "vitest";
import { planOwnedAudioUpload } from "./owned-upload-admission";
const owner="11111111-1111-4111-8111-111111111111";
const id="22222222-2222-4222-8222-222222222222";
const input={ filename:"My Own Song.mp3", mimeType:"audio/mpeg", sizeBytes:12000, rightsConfirmed:true };
describe("owner audio intake is not an automatic playback grant", () => {
  it("mints only an unpredictable owner-folder path with pending rights", () => {
    expect(planOwnedAudioUpload(owner,input,id)).toEqual({
      bucket:"music-owned",path:`${owner}/${id}.mp3`,mimeType:"audio/mpeg",
      sizeBytes:12000,status:"pending_rights_review",playbackAuthorized:false,
    });
  });
  it("rejects spoofed identities, unsupported types, oversized files and absent rights attestation", () => {
    expect(() => planOwnedAudioUpload("../../bob",input,id)).toThrow();
    expect(() => planOwnedAudioUpload(owner,{...input,rightsConfirmed:false},id)).toThrow();
    expect(() => planOwnedAudioUpload(owner,{...input,mimeType:"image/png"},id)).toThrow();
    expect(() => planOwnedAudioUpload(owner,{...input,filename:"fake.pdf"},id)).toThrow();
    expect(() => planOwnedAudioUpload(owner,{...input,sizeBytes:500*1024*1024},id)).toThrow();
  });
});
