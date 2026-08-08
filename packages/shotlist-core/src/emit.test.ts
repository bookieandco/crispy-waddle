import { describe, expect, it } from "vitest";
import { emitPrompts, higgsfieldTarget, seedanceTarget } from "./emit.js";
import { isApproved } from "./types.js";
import type { DirectorControls, Entity, ReferenceAsset, Shot } from "./types.js";

const entity = (id: string, ...lockedTraits: string[]): Entity => ({ id, name: id, lockedTraits });
const ref = (entityId: string, uri: string): ReferenceAsset => ({ id: `${entityId}-ref`, entityId, uri });

const director: DirectorControls = {
  lens: "35mm",
  cameraMovement: "slow dolly in",
  framing: "medium close-up",
  lightingMood: "moody blue",
  performanceIntensity: "restrained",
  durationSeconds: 4,
};

const baseShot = (overrides: Partial<Shot> = {}): Shot => ({
  id: "shot-1",
  projectId: "proj-1",
  sceneScriptOrder: 1,
  ordinal: 1,
  shotType: "medium",
  durationSec: 4,
  action: "Mara turns toward the window.",
  entityHandles: ["mara"],
  status: "draft",
  ...overrides,
});

describe("Director Control Extension", () => {
  // 1. Director fields survive serialization.
  it("survives a JSON round-trip on the Shot", () => {
    const shot = baseShot({ director });
    const revived: Shot = JSON.parse(JSON.stringify(shot));
    expect(revived.director).toEqual(director);
  });

  it("survives a JSON round-trip when director is absent", () => {
    const shot = baseShot();
    const revived: Shot = JSON.parse(JSON.stringify(shot));
    expect(revived.director).toBeUndefined();
  });

  // 2. Prompt emitter includes director instructions.
  it("includes director instructions in every prompt target when present", () => {
    const shot = baseShot({ director });
    const prompts = emitPrompts({ shot });
    expect(prompts.seedance).toContain("Director:");
    expect(prompts.seedance).toContain("lens 35mm");
    expect(prompts.seedance).toContain("camera movement slow dolly in");
    expect(prompts.seedance).toContain("duration 4s");
    expect(prompts.higgsfield).toContain("Director:");
    expect(prompts.higgsfield).toContain("performance intensity restrained");
  });

  it("omits the director line entirely when absent, for both targets", () => {
    const shot = baseShot();
    const prompts = emitPrompts({ shot });
    expect(prompts.seedance).not.toContain("Director:");
    expect(prompts.higgsfield).not.toContain("Director:");
  });

  // 3. Existing locked traits continue working.
  it("keeps rendering locked entity traits with director controls present", () => {
    const shot = baseShot({ director, entityHandles: ["mara"] });
    const entities = [entity("mara", "red hair", "scar over left eyebrow")];
    const prompts = emitPrompts({ shot, entities });
    expect(prompts.seedance).toContain("Character traits: red hair, scar over left eyebrow");
    expect(prompts.higgsfield).toContain("traits(red hair; scar over left eyebrow)");
  });

  it("keeps rendering locked entity traits when director controls are absent", () => {
    const shot = baseShot({ entityHandles: ["mara"] });
    const entities = [entity("mara", "red hair")];
    const prompts = emitPrompts({ shot, entities });
    expect(prompts.seedance).toContain("Character traits: red hair");
  });

  // 4. Existing approval/canonical workflows are unchanged.
  it("leaves shot status/approval semantics untouched by director controls", () => {
    const withDirector = baseShot({ director, status: "approved" });
    const withoutDirector = baseShot({ status: "approved" });
    expect(isApproved(withDirector)).toBe(true);
    expect(isApproved(withoutDirector)).toBe(true);
    expect(isApproved(baseShot({ director, status: "pending_approval" }))).toBe(false);
  });

  it("keeps building a Shot without director unmodified (additive-only field)", () => {
    // A call site written before this extension existed still type-checks
    // and behaves identically: no `director` key at all.
    const legacyShot: Shot = {
      id: "shot-2",
      projectId: "proj-1",
      sceneScriptOrder: 2,
      ordinal: 2,
      shotType: "wide",
      durationSec: 6,
      action: "The crowd disperses.",
      entityHandles: [],
      status: "draft",
    };
    expect(legacyShot.director).toBeUndefined();
    expect(emitPrompts({ shot: legacyShot }).seedance).toBe("The crowd disperses.");
  });

  // 5. No duplicate memory or asset pathway is introduced.
  it("does not introduce a second reference-asset or entity pathway", () => {
    const shot = baseShot({ director, entityHandles: ["mara"] });
    const entities = [entity("mara", "red hair")];
    const refs = [ref("mara", "s3://refs/mara-01.png")];

    const withDirector = emitPrompts({ shot, entities, refs });
    const withoutDirector = emitPrompts({ shot: baseShot({ entityHandles: ["mara"] }), entities, refs });

    // Same single set of reference URIs and locked traits either way —
    // director controls add an instruction line, not a new lookup path.
    expect(withDirector.seedance).toContain("References: s3://refs/mara-01.png");
    expect(withoutDirector.seedance).toContain("References: s3://refs/mara-01.png");
    const referenceCount = (s: string) => (s.match(/s3:\/\/refs\/mara-01\.png/g) ?? []).length;
    expect(referenceCount(withDirector.seedance)).toBe(1);
    expect(referenceCount(withoutDirector.seedance)).toBe(1);
  });

  it("renders through the PromptTarget objects directly, not just emitPrompts", () => {
    const shot = baseShot({ director });
    expect(seedanceTarget.render({ shot })).toContain("Director:");
    expect(higgsfieldTarget.render({ shot })).toContain("Director:");
  });
});
