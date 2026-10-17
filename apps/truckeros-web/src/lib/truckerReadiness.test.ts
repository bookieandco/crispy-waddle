import {describe,it,expect} from "vitest";
import {truckerReadiness} from "./truckerReadiness";
describe("honest Truckeros readiness",()=>{
  it("returns 503-shaped unavailable status rather than an invented live claim",()=>{
    const result=truckerReadiness("production");
    expect(result).toMatchObject({ready:false,status:"not_commissioned"});
    expect(result.limitations).toContain("NO_AUTHENTICATED_TENANT_RUNTIME");
  });
  it("allows isolated development preview but reports every missing gate",()=>{
    expect(truckerReadiness("development")).toMatchObject({ready:true,status:"development_preview"});
  });
});
