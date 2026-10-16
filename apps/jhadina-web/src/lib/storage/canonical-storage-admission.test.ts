import {describe,expect,it} from "vitest"
import {assessCanonicalStorageTarget,requireCanonicalStorageTarget} from "./canonical-storage-admission"

const ref = "kqbkaozfjubkjevdfvic"
const endpoint = "https://" + ref + ".supabase.co/functions/v1/jhadina-memory-gateway"

describe("JH-CLOSE.03 durable storage identity admission",()=>{
  it("admits only a pinned canonical Supabase ref over HTTPS",()=>{
    expect(assessCanonicalStorageTarget({
      kind:"supabase",url:"https://"+ref+".supabase.co",expectedProjectRef:ref,
    })).toMatchObject({admitted:true,reason:"BOUND_SUPABASE"})
    expect(assessCanonicalStorageTarget({
      kind:"supabase",url:"https://ztjyewacsmttkzktnyxl.supabase.co",expectedProjectRef:ref,
    }).reason).toBe("MISMATCHED_SUPABASE_PROJECT")
    expect(assessCanonicalStorageTarget({
      kind:"supabase",url:"https://"+ref+".supabase.co",
    }).reason).toBe("UNPINNED_SUPABASE_PROJECT")
    expect(()=>requireCanonicalStorageTarget({
      kind:"supabase",url:"http://"+ref+".supabase.co",expectedProjectRef:ref,
    })).toThrow("INSECURE_TRANSPORT")
  })

  it("rejects a Supabase gateway pointing at another tenant or noncanonical fallback",()=>{
    expect(assessCanonicalStorageTarget({
      kind:"oidc_gateway",url:endpoint,expectedProjectRef:ref,
    })).toMatchObject({admitted:true,reason:"BOUND_SUPABASE"})
    expect(assessCanonicalStorageTarget({
      kind:"oidc_gateway",
      url:"https://ztjyewacsmttkzktnyxl.supabase.co/functions/v1/jhadina-memory-gateway",
      expectedProjectRef:ref,
    }).admitted).toBe(false)
  })

  it("requires an independently pinned HTTPS origin for portable memory gateways",()=>{
    expect(assessCanonicalStorageTarget({
      kind:"oidc_gateway",url:"https://homebase.example.test/v1/memory",
      expectedGatewayOrigin:"https://homebase.example.test",
    }).admitted).toBe(true)
    expect(assessCanonicalStorageTarget({
      kind:"oidc_gateway",url:"https://homebase.example.test/v1/memory",
    }).reason).toBe("UNPINNED_GATEWAY_ORIGIN")
    expect(assessCanonicalStorageTarget({
      kind:"oidc_gateway",url:"https://homebase.example.test/v1/memory",
      expectedGatewayOrigin:"https://attacker.example.test",
    }).admitted).toBe(false)
    expect(assessCanonicalStorageTarget({
      kind:"oidc_gateway",url:"https://user:password@homebase.example.test/v1/memory",
      expectedGatewayOrigin:"https://homebase.example.test",
    }).reason).toBe("INSECURE_TRANSPORT")
  })
})
