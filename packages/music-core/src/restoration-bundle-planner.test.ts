import { describe, expect, it } from "vitest";
import { planRestorationBundleParts } from "./restoration-bundle-planner.js";
const mb = 1024 * 1024;
describe("safe large DAW asset export planner", () => {
  it("creates independently bounded archive parts, preserving ordered original/stems", () => {
    const tracks=[{artifactId:"source"},{artifactId:"kick"},{artifactId:"snare"},{artifactId:"midi"}];
    const assets=[{id:"source",sizeBytes:70*mb},{id:"kick",sizeBytes:54*mb},
      {id:"snare",sizeBytes:42*mb},{id:"midi",sizeBytes:2*mb}];
    const result=planRestorationBundleParts(tracks,assets);
    expect(result.parts.map(p=>p.artifactIds)).toEqual([["source"],["kick","snare"],["midi"]]);
    expect(result.directArtifacts).toEqual([]);
    expect(result.parts.every(p=>p.sourceBytes<=96*mb)).toBe(true);
    expect(result.totalSourceBytes).toBe(168*mb);
  });
  it("places any single oversized recording on owner-scoped direct asset download", () => {
    const p=planRestorationBundleParts(
      [{artifactId:"large"},{artifactId:"midi"}],
      [{id:"large",sizeBytes:180*mb},{id:"midi",sizeBytes:1024}],
    );
    expect(p.directArtifacts).toEqual([{artifactId:"large",sourceBytes:180*mb}]);
    expect(p.parts[0]?.artifactIds).toEqual(["midi"]);
  });
  it("fails closed for unknown and spoofed sizes, duplicate ids, too many tracks", () => {
    expect(()=>planRestorationBundleParts([{artifactId:"a"}],[])).toThrow("UNVERIFIED");
    expect(()=>planRestorationBundleParts([{artifactId:"a"}],[{id:"a",sizeBytes:Infinity}])).toThrow("UNVERIFIED");
    expect(()=>planRestorationBundleParts([{artifactId:"a"},{artifactId:"a"}],[{id:"a",sizeBytes:5}])).toThrow("DUPLICATE");
    expect(()=>planRestorationBundleParts([{artifactId:"a"}],[{id:"a",sizeBytes:5}],0)).toThrow("LIMIT");
  });
});
