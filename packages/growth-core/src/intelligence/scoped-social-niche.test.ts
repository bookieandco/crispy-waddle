
import {describe,it,expect} from "vitest";
import {buildScopedSocialNicheProfile,type ScopedSocialNicheObservation} from "./scoped-social-niche.js";
const at="2026-10-11T20:00:00Z";
const scope={ownerUserId:"owner-a",brandId:"pupsonstuff",platform:"tiktok",nicheKey:"pets"};
const observation=(id:string,accountId="account-one"):ScopedSocialNicheObservation=>({
  id,ownerUserId:scope.ownerUserId,brandId:scope.brandId,accountId,
  platform:scope.platform,nicheKey:scope.nicheKey,
  observedAt:"2026-10-10T12:00:00Z",
  impressions:200,views:100,shares:10,conversions:2,evidenceRefs:["provider:"+id],
});
describe("SOCIAL-ID.06 account and niche separation",()=>{
  it("can combine same-brand accounts only when the owner+brand scope allows it",()=>{
    const p=buildScopedSocialNicheProfile({
      scope,observations:[observation("a"),observation("b","account-two")],asOf:at,
    });
    expect(p.sampleSize).toBe(2);
    expect(p.shareRatePerView).toBeCloseTo(.1);
    expect(p.conversionRatePerImpression).toBeCloseTo(.01);
    expect(p.authority).toBe("ANALYTICS_ONLY");
    expect(p.canModifyIdentity).toBe(false);
    const accountProfile=buildScopedSocialNicheProfile({
      scope:{...scope,accountId:"account-one"},observations:[observation("a")],asOf:at,
    });
    expect(accountProfile.accountId).toBe("account-one");
  });
  it.each([
    ["different owner",{ownerUserId:"owner-b"}],
    ["different brand same niche",{brandId:"atwood-bookie"}],
    ["different platform",{platform:"instagram"}],
    ["different niche",{nicheKey:"music"}],
  ])("refuses %s rather than accidentally pooling it",(_name,change)=>{
    expect(()=>buildScopedSocialNicheProfile({
      scope,observations:[observation("a"),{...observation("b"),...change}],asOf:at,
    })).toThrow("SOCIAL_NICHE_FOREIGN_SCOPE_REJECTED");
  });
  it("rejects another account when using account-specific scope",()=>{
    expect(()=>buildScopedSocialNicheProfile({
      scope:{...scope,accountId:"account-one"},
      observations:[observation("a"),observation("b","account-two")],asOf:at,
    })).toThrow("SOCIAL_NICHE_FOREIGN_SCOPE_REJECTED");
  });
  it("rejects dishonest, stale, future and unproven observations",()=>{
    const run=(x:ScopedSocialNicheObservation)=>buildScopedSocialNicheProfile({
      scope,observations:[x],asOf:at,
    });
    expect(()=>run({...observation("a"),impressions:-4})).toThrow("SOCIAL_NICHE_INVALID_METRICS");
    expect(()=>run({...observation("a"),views:Number.NaN})).toThrow("SOCIAL_NICHE_INVALID_METRICS");
    expect(()=>run({...observation("a"),evidenceRefs:[]})).toThrow("SOCIAL_NICHE_EVIDENCE_REQUIRED");
    expect(()=>run({...observation("a"),observedAt:"2026-12-01T00:00:00Z"})).toThrow("SOCIAL_NICHE_DATE_INVALID");
    expect(()=>run({...observation("a"),observedAt:"2026-01-01T00:00:00Z"})).toThrow("SOCIAL_NICHE_FRESH_OBSERVATIONS_REQUIRED");
  });
});
