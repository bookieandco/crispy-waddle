import {describe,expect,it} from "vitest";
import {evaluateMusicPrototypeRelease,MUSIC_PROTOTYPE_RELEASE_GATE_FIELDS}
  from "./music-prototype-release-gate";

describe("private music release truth gate",()=>{
  it("does not infer iPhone, restore or Drive proof from passing CI",()=>{
    const result=evaluateMusicPrototypeRelease({exactHeadCiPassed:true});
    expect(result.releaseApprovedByEvidence).toBe(false);
    expect(result.missing).toContain("isolatedRestoreSucceeded");
    expect(result.missing).toContain("physicalIphonePlaybackPassed");
    expect(result.missing).toContain("googleDriveArchiveReadbackVerified");
  });
  it("requires every independent operational receipt",()=>{
    const all=Object.fromEntries(MUSIC_PROTOTYPE_RELEASE_GATE_FIELDS.map(k=>[k,true]));
    expect(evaluateMusicPrototypeRelease(all).releaseApprovedByEvidence).toBe(true);
    for(const field of MUSIC_PROTOTYPE_RELEASE_GATE_FIELDS) {
      expect(evaluateMusicPrototypeRelease({...all,[field]:false})
        .releaseApprovedByEvidence).toBe(false);
    }
  });
});
