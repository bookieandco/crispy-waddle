import { describe, it, expect } from "vitest";
import { summarizeOwnedUploads } from "./owned-upload-inventory";

describe("private owner audio inventory", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("reports owner upload presence without asserting playback rights", () => {
    expect(summarizeOwnedUploads([{name:id+".mp3",created_at:"2026-10-10T10:00:00Z",metadata:{size:4096}}])).toEqual([{
      fileId:id,fileType:"mp3",bytes:4096,uploadedAt:"2026-10-10T10:00:00Z",
      status:"awaiting_independent_review",playbackAuthorized:false,
    }]);
  });
  it("ignores unrecognized objects, traversal names and duplicate listings", () => {
    const input=[{name:id+".mp3"},{name:"../bob/song.mp3"},{name:".env"},{name:id+".mp3"},
      {name:"private/something.mp3"},{name:"123.mp3"}];
    expect(summarizeOwnedUploads(input)).toHaveLength(1);
  });
});
