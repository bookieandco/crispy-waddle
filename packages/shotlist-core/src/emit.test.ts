import { describe, expect, it } from "vitest";
import { emitPrompts, higgsfieldTarget, seedanceTarget } from "./emit.js";
import { applyLookPreset, lookPresets } from "./polish.js";
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
    expect(withDirector.seedance).toContain("@material[mara]:");
    expect(withDirector.seedance).toContain("s3://refs/mara-01.png");
    expect(withoutDirector.seedance).toContain("@material[mara]:");
    expect(withoutDirector.seedance).toContain("s3://refs/mara-01.png");
    const referenceCount = (s: string) => (s.match(/s3:\/\/refs\/mara-01\.png/g) ?? []).length;
    expect(referenceCount(withDirector.seedance)).toBe(1);
    expect(referenceCount(withoutDirector.seedance)).toBe(1);
  });

  it("renders through the PromptTarget objects directly, not just emitPrompts", () => {
    const shot = baseShot({ director });
    expect(seedanceTarget.render({ shot })).toContain("Director:");
    expect(higgsfieldTarget.render({ shot })).toContain("Director:");
  });

  // Platform fidelity: Seedance 2.0 / Higgsfield expect reference material
  // as `@material[name]: description`, not a generic URI list.
  it("formats reference assets with the real @material[name] syntax on both targets", () => {
    const shot = baseShot({ entityHandles: ["mara"] });
    const refs = [ref("mara", "s3://refs/mara-01.png")];
    const seedanceOut = seedanceTarget.render({ shot, refs });
    const higgsfieldOut = higgsfieldTarget.render({ shot, refs });
    expect(seedanceOut).toMatch(/@material\[mara\]: .*s3:\/\/refs\/mara-01\.png/);
    expect(higgsfieldOut).toMatch(/@material\[mara\]: .*s3:\/\/refs\/mara-01\.png/);
  });

  it("surfaces ControlNet-style controlType on a reference instead of a generic label", () => {
    const shot = baseShot({ entityHandles: ["mara"] });
    const refs: ReferenceAsset[] = [
      { id: "pose-ref", entityId: "mara", uri: "s3://refs/mara-pose.png", controlType: "pose", strength: 0.8 },
    ];
    const out = seedanceTarget.render({ shot, refs });
    expect(out).toContain("@material[mara]: pose control (strength 0.8) — s3://refs/mara-pose.png");
  });

  it("falls back to kind/reference when controlType is absent (backward compatible)", () => {
    const shot = baseShot({ entityHandles: ["mara"] });
    const withKind: ReferenceAsset = { id: "r1", entityId: "mara", uri: "s3://refs/a.png", kind: "mood board" };
    const bare: ReferenceAsset = { id: "r2", entityId: "mara", uri: "s3://refs/b.png" };
    expect(seedanceTarget.render({ shot, refs: [withKind] })).toContain("@material[mara]: mood board —");
    expect(seedanceTarget.render({ shot, refs: [bare] })).toContain("@material[mara]: reference —");
  });

  // Bug fix: reference-asset matching used to only accept entityId as the
  // shot handle, while locked-trait matching already accepted id OR name —
  // an entity referenced by name lost its reference material silently.
  it("matches reference assets when the shot handle is the entity's name, not its id", () => {
    const shot = baseShot({ entityHandles: ["Mara"] }); // handle is the *name*
    const entities: Entity[] = [{ id: "e1", name: "Mara", lockedTraits: ["red hair"] }];
    const refs: ReferenceAsset[] = [{ id: "r1", entityId: "e1", uri: "s3://refs/mara.png" }]; // keyed by id
    const out = seedanceTarget.render({ shot, entities, refs });
    expect(out).toContain("Character traits: red hair"); // already worked before the fix
    expect(out).toContain("@material[e1]: reference — s3://refs/mara.png"); // was silently dropped before the fix
  });
});

describe("look preset polish pass", () => {
  it("leaves the prompt untouched with no preset requested", () => {
    const shot = baseShot();
    const prompts = emitPrompts({ shot });
    expect(prompts.seedance).toBe("Mara turns toward the window.");
    expect(prompts.seedance).not.toContain("Photographic treatment");
  });

  it("appends the named preset's photographic treatment to every target", () => {
    const shot = baseShot({ director: { ...director, lookPreset: "35mm-portrait" } });
    const prompts = emitPrompts({ shot });
    expect(prompts.seedance).toContain("Photographic treatment (35mm Film Portrait)");
    expect(prompts.seedance).toContain("Kodak Portra 400");
    expect(prompts.seedance).toContain("Avoid: avoid airbrushed or plastic-smooth skin");
    expect(prompts.higgsfield).toContain("Photographic treatment (35mm Film Portrait)");
  });

  it("degrades gracefully on an unrecognized preset id, no throw", () => {
    const shot = baseShot({ director: { lookPreset: "not-a-real-preset" } });
    expect(() => emitPrompts({ shot })).not.toThrow();
    expect(emitPrompts({ shot }).seedance).toBe("Mara turns toward the window.");
  });

  it("exposes every catalog preset through applyLookPreset", () => {
    for (const id of Object.keys(lookPresets)) {
      const result = applyLookPreset("base prompt", id);
      expect(result).toContain("base prompt");
      expect(result).toContain(lookPresets[id].label);
    }
  });

  it("does not require director fields other than lookPreset to apply the polish pass", () => {
    const shot = baseShot({ director: { lookPreset: "provia-standard" } });
    const prompts = emitPrompts({ shot });
    expect(prompts.seedance).not.toContain("Director:"); // no other director fields set
    expect(prompts.seedance).toContain("Photographic treatment (Provia / Standard)");
  });
});
