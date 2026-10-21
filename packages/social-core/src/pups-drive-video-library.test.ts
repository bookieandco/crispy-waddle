import { describe, expect, it } from "vitest";
import {
  indexPupsDriveVideos, proposePupsOriginalConcept,
  searchPupsDriveVideos, validatePupsDriveVideo,
  type PupsDriveVideo,
} from "./pups-drive-video-library.js";

const at = "2026-10-21T22:30:00.000Z";
// Synthetic fixtures only. Never check real owner IDs, filenames or Drive URLs into the public repo.
const example: PupsDriveVideo = {
  id: "private-opaque-1", ownerUserId: "owner-test", brand: "pupsonstuff",
  driveFileId: "syntheticFileId0001", filename: "sample-dog-reference.mp4",
  mimeType: "video/mp4", bytes: 32100, durationSeconds: 11.2,
  width: 720, height: 1280, hasAudio: true, observedAt: at,
  inspection: "metadata_only", inspectionEvidenceRefs: [], visualNotes: [],
  tags: ["dog", "vertical"], rightsState: "unknown", rightsEvidenceRefs: [],
  visibility: "owner_only",
};

describe("PUPSONSTUFF-SOCIAL.VIDEO.01–.05 source-only privacy and approval gates", () => {
  it(".01 accepts unverified rights as reference only and freezes metadata", () => {
    const video = validatePupsDriveVideo(example);
    expect(video.rightsState).toBe("unknown");
    expect(Object.isFrozen(video)).toBe(true);
    expect(Object.isFrozen(video.tags)).toBe(true);
  });
  it(".01 refuses visual claims without visual inspection evidence", () => {
    expect(() => validatePupsDriveVideo({
      ...example, visualNotes: ["dogs dancing"],
    })).toThrow("PUPS_VISUAL_CLAIM_UNINSPECTED");
    expect(() => validatePupsDriveVideo({
      ...example, inspection: "frames_reviewed", visualNotes: ["dog at piano"],
    })).toThrow("PUPS_INSPECTION_EVIDENCE_REQUIRED");
    expect(validatePupsDriveVideo({
      ...example, inspection: "frames_reviewed", visualNotes: ["dog at piano"],
      inspectionEvidenceRefs: ["inspection:test:1"],
    }).visualNotes).toEqual(["dog at piano"]);
  });
  it(".02 rejects bad format, duplicate IDs, impersonated owner and public visibility", () => {
    expect(() => validatePupsDriveVideo({
      ...example, filename: "private-file.exe",
    })).toThrow("PUPS_MP4_REQUIRED");
    expect(() => indexPupsDriveVideos("owner-test", [
      example, { ...example, id: "duplicate" },
    ])).toThrow("PUPS_DUPLICATE_SOURCE");
    expect(() => indexPupsDriveVideos("owner-test", [
      { ...example, ownerUserId: "other-owner" },
    ])).toThrow("PUPS_OWNER_SCOPE_DENIED");
    expect(() => validatePupsDriveVideo({
      ...example, visibility: "public" as PupsDriveVideo["visibility"],
    })).toThrow("PUPS_SOURCE_SCOPE_DENIED");
  });
  it(".02 only searches a previously owner-scoped catalog", () => {
    const catalog = indexPupsDriveVideos("owner-test", [example]);
    expect(searchPupsDriveVideos(catalog, "owner-test", "dog vertical")).toHaveLength(1);
    expect(searchPupsDriveVideos(catalog, "owner-test", "music")).toHaveLength(0);
    expect(() => searchPupsDriveVideos(catalog, "wrong-owner", "dog"))
      .toThrow("PUPS_OWNER_SCOPE_DENIED");
    expect(catalog.publicationAuthority).toBe("NONE");
  });
  it(".03 separates commercial rights proof from the existence of a video", () => {
    expect(() => validatePupsDriveVideo({
      ...example, rightsState: "licensed",
    })).toThrow("PUPS_RIGHTS_PROOF_REQUIRED");
    expect(validatePupsDriveVideo({
      ...example, rightsState: "licensed",
      rightsEvidenceRefs: ["license:test:1"],
    }).rightsState).toBe("licensed");
  });
  it(".03–.05 creates a text-only canonical concept with no reuse or publication authority", () => {
    const catalog = indexPupsDriveVideos("owner-test", [example]);
    const draft = proposePupsOriginalConcept({
      catalog, ownerUserId: "owner-test", sourceId: example.id,
      conceptId: "pups-demo-1", title: "The Pups CEO",
      hook: "Your dog runs the company now.",
      originalBeats: [
        "The dog enters a staged empty office set.",
        "A toy laptop shows a custom dog portrait.",
        "An employee respectfully asks the pup to approve the design.",
      ],
      cta: "Create a portrait of your dog.",
      createdAt: at,
    });
    expect(draft.project.brand).toBe("pupsonstuff");
    expect(draft.project.assets[0].mediaRefs).toEqual([]);
    expect(draft.project.assets[0].transformation).toBe("original");
    expect(draft.review).toBe("draft");
    expect(draft.publicationAuthority).toBe("NONE");
    expect(draft.sourceMediaReusable).toBe(false);
    expect(() => proposePupsOriginalConcept({
      catalog, ownerUserId: "attacker", sourceId: example.id,
      conceptId: "x", title: "x", hook: "x", originalBeats: ["one", "two", "three"],
      cta: "x", createdAt: at,
    })).toThrow("PUPS_OWNER_SCOPE_DENIED");
  });
});
