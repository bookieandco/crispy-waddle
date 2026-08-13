import { describe, expect, it } from "vitest";
import { emitPrompts } from "./emit.js";
import { isApproved } from "./types.js";
import type { Entity, ReferenceAsset, Shot } from "./types.js";

const baseShot = (overrides: Partial<Shot> = {}): Shot => ({ id:"shot-1", projectId:"proj-1", sceneScriptOrder:1, ordinal:1, shotType:"medium", durationSec:4, action:"Mara turns toward the window.", entityHandles:["mara"], status:"draft", ...overrides });
const entity = (id:string,...lockedTraits:string[]):Entity => ({id,name:id,lockedTraits});

describe("Director Control Extension",()=>{
 it("round-trips director controls",()=>{const shot=baseShot({director:{lens:"35mm",cameraMovement:"slow dolly in",framing:"medium close-up",lightingMood:"moody blue",performanceIntensity:"restrained",durationSeconds:4}}); expect(JSON.parse(JSON.stringify(shot)).director).toEqual(shot.director);});
 it("emits director instructions",()=>{const p=emitPrompts({shot:baseShot({director:{lens:"35mm",cameraMovement:"slow dolly in",durationSeconds:4}})}); expect(p.seedance).toContain("Director:"); expect(p.seedance).toContain("lens 35mm"); expect(p.seedance).toContain("duration 4s"); expect(p.higgsfield).toContain("camera movement slow dolly in");});
 it("omits director when absent",()=>{const p=emitPrompts({shot:baseShot()}); expect(p.seedance).not.toContain("Director:");});
 it("preserves locked traits",()=>{const p=emitPrompts({shot:baseShot(),entities:[entity("mara","red hair","scar over left eyebrow")]}); expect(p.seedance).toContain("Character traits: red hair, scar over left eyebrow");});
 it("preserves approval semantics",()=>{expect(isApproved(baseShot({status:"approved",director:{lens:"35mm"}}))).toBe(true); expect(isApproved(baseShot({status:"pending_approval",director:{lens:"35mm"}}))).toBe(false);});
 it("keeps legacy shots unchanged",()=>{const s=baseShot({entityHandles:[]}); expect(s.director).toBeUndefined(); expect(emitPrompts({shot:s}).seedance).toBe(s.action);});
 it("renders @material references and control type",()=>{const refs:ReferenceAsset[]=[{id:"pose",entityId:"mara",uri:"s3://refs/mara-pose.png",controlType:"pose",strength:.8}]; const p=emitPrompts({shot:baseShot(),refs}); expect(p.seedance).toContain("@material[mara]: pose control (strength 0.8) — s3://refs/mara-pose.png");});
 it("applies known look presets and ignores unknown ones",()=>{const known=emitPrompts({shot:baseShot({director:{lookPreset:"35mm-portrait"}})}); expect(known.seedance).toContain("Photographic treatment (35mm Film Portrait)"); const unknown=emitPrompts({shot:baseShot({director:{lookPreset:"unknown"}})}); expect(unknown.seedance).not.toContain("Photographic treatment");});
});
