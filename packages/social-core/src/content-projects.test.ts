import { describe, expect, it } from "vitest";
import { addContentDerivative, bindContentAssetMedia, bindContentProjectCharacter, contentLineage, createContentProject } from "./content-projects.js";

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

  it("binds reviewed Director media without changing the content idea or lineage", () => {
    const project = createContentProject({
      id: "project-1",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:social",
      bigIdeaRef: "idea:1",
      primaryJob: "useful",
      origin: "human_written",
      humanSourceRefs: ["note:1"],
      evidenceRefs: ["evidence:1"],
      createdAt: "2026-09-22T12:00:00.000Z",
      anchor: {
        id: "asset-anchor",
        kind: "anchor_video",
        transformation: "original",
        text: "Produce this anchor in Director.",
        mediaRefs: [],
        evidenceRefs: ["evidence:1"],
      },
    });

    const bound = bindContentAssetMedia(
      project,
      "asset-anchor",
      ["https://media.example/director.mp4"],
      ["director-review:review-1", "director-asset:asset-1"],
      "2026-09-22T12:20:00.000Z",
    );

    expect(bound.bigIdeaRef).toBe(project.bigIdeaRef);
    expect(bound.assets[0].mediaRefs).toEqual(["https://media.example/director.mp4"]);
    expect(bound.assets[0].evidenceRefs).toContain("director-review:review-1");
  });

  it("binds a Social character and voice to the project lineage", () => {
    const project = createContentProject({
      id: "project-character",
      brand: "atwood-bookie",
      authorityPositionRef: "authority:atwood",
      pillarRef: "pillar:music",
      bigIdeaRef: "idea:identity",
      primaryJob: "reach",
      origin: "human_written",
      humanSourceRefs: ["note:atwood"],
      evidenceRefs: ["evidence:1"],
      createdAt: "2026-09-22T12:00:00.000Z",
      anchor: {
        id: "asset-anchor",
        kind: "short_video",
        platform: "tiktok",
        transformation: "original",
        text: "Anchor",
        mediaRefs: [],
        evidenceRefs: ["evidence:1"],
      },
    });

    const bound = bindContentProjectCharacter(project, {
      characterProfileRef: "character:atwood-bookie",
      voiceProfileRef: "brand-voice:atwood-bookie",
      evidenceRefs: ["character:atwood-bookie", "voice-profile:atwood-bookie"],
      updatedAt: "2026-09-22T12:05:00.000Z",
    });

    expect(bound.characterProfileRef).toBe("character:atwood-bookie");
    expect(bound.voiceProfileRef).toBe("brand-voice:atwood-bookie");
    expect(bound.evidenceRefs).toContain("character:atwood-bookie");
  });

  it("requires character and voice refs to travel as a pair", () => {
    expect(() => createContentProject({
      id: "project-character-invalid",
      brand: "atwood-bookie",
      authorityPositionRef: "authority:atwood",
      pillarRef: "pillar:music",
      bigIdeaRef: "idea:identity",
      primaryJob: "reach",
      origin: "human_written",
      characterProfileRef: "character:atwood-bookie",
      humanSourceRefs: ["note:atwood"],
      evidenceRefs: ["evidence:1"],
      createdAt: "2026-09-22T12:00:00.000Z",
      anchor: {
        id: "asset-anchor",
        kind: "short_video",
        transformation: "original",
        text: "Anchor",
        mediaRefs: [],
        evidenceRefs: ["evidence:1"],
      },
    })).toThrow("SOCIAL_CONTENT_CHARACTER_VOICE_PAIR_REQUIRED");
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

  it("preserves a speaker identity separately from the expression voice profile", () => {
    const project=createContentProject({
      id:"project-jhadina-speaker",
      brand:"jhadina",
      authorityPositionRef:"authority:jhadina",
      pillarRef:"pillar:social",
      bigIdeaRef:"idea:voice",
      primaryJob:"reach",
      origin:"human_written",
      characterProfileRef:"character:jhadina",
      voiceProfileRef:"brand-voice:jhadina",
      speakerIdentityRef:"voice:jhadina:canonical:v1",
      humanSourceRefs:["note:voice"],
      evidenceRefs:["evidence:voice"],
      createdAt:"2026-10-03T12:00:00.000Z",
      anchor:{
        id:"asset-voice",kind:"short_video",transformation:"original",
        text:"Jhadina narrates this.",mediaRefs:[],evidenceRefs:["evidence:voice"],
      },
    })
    expect(project.voiceProfileRef).toBe("brand-voice:jhadina")
    expect(project.speakerIdentityRef).toBe("voice:jhadina:canonical:v1")
  })

  it("does not allow a bare acoustic identity without character/expression context", () => {
    expect(()=>createContentProject({
      id:"project-bare-speaker",
      brand:"jhadina",
      authorityPositionRef:"authority:jhadina",
      pillarRef:"pillar:social",
      bigIdeaRef:"idea:voice",
      primaryJob:"reach",
      origin:"human_written",
      speakerIdentityRef:"voice:jhadina:canonical:v1",
      humanSourceRefs:["note:voice"],
      evidenceRefs:["evidence:voice"],
      createdAt:"2026-10-03T12:00:00.000Z",
      anchor:{
        id:"asset-voice",kind:"short_video",transformation:"original",
        text:"Invalid bare speaker.",mediaRefs:[],evidenceRefs:["evidence:voice"],
      },
    })).toThrow("SOCIAL_CONTENT_SPEAKER_REQUIRES_CHARACTER_VOICE")
  })

});
