import { describe, expect, it } from "vitest";
import { addContentDerivative, contentLineage, createContentProject } from "./content-projects.js";

describe("content projects", () => {
  it("preserves one idea across derivative assets with lineage", () => {
    const project = createContentProject({
      id: "project-1",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:social",
      bigIdeaRef: "idea:human-origin",
      primaryJob: "useful",
      origin: "human_spoken",
      humanSourceRefs: ["voice-note:1"],
      evidenceRefs: ["evidence:1"],
      createdAt: "2026-09-22T12:00:00.000Z",
      anchor: {
        id: "asset-anchor",
        kind: "anchor_video",
        transformation: "original",
        text: "Anchor",
        mediaRefs: ["media:anchor"],
        evidenceRefs: ["evidence:1"],
      },
    });

    const withShort = addContentDerivative(project, {
      id: "asset-short",
      kind: "short_video",
      platform: "tiktok",
      transformation: "excerpted",
      parentAssetId: "asset-anchor",
      text: "Short",
      mediaRefs: ["media:short"],
      evidenceRefs: ["evidence:1"],
    }, "2026-09-22T12:10:00.000Z");

    expect(contentLineage(withShort, "asset-short")).toEqual(["asset-anchor", "asset-short"]);
    expect(withShort.bigIdeaRef).toBe(project.bigIdeaRef);
  });

  it("requires source evidence instead of allowing context-free filler", () => {
    expect(() => createContentProject({
      id: "project-1",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:social",
      bigIdeaRef: "idea:1",
      primaryJob: "reach",
      origin: "ai_generated",
      evidenceRefs: [],
      createdAt: "2026-09-22T12:00:00.000Z",
      anchor: {
        id: "asset-anchor",
        kind: "text_post",
        transformation: "original",
        text: "generic",
        mediaRefs: [],
        evidenceRefs: ["evidence:1"],
      },
    })).toThrow("SOCIAL_CONTENT_EVIDENCE_REQUIRED");
  });
});
