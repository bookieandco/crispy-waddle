import {describe,expect,it} from "vitest"
import {InMemoryActionLedger,InMemoryApprovalReceiptStore} from "@jhadina/action-core"
import {AyrshareProvider,type AyrshareProfileBinding} from "@jhadina/social-core"
import type {JhadinaIdentityVerifier} from "../auth/supabase-identity-verifier"
import type {AyrshareBindingVault} from "./ayrshare-binding-vault"
import {
  approveAndRecordAyrshareBinding,
  fingerprintAyrshareBinding,
  requestAyrshareBindingApproval,
} from "./ayrshare-binding-runtime"

const identityVerifier:JhadinaIdentityVerifier={
  async verify(){return{userId:"user-1",sessionId:"session-1"}},
}
const bindingInput={
  id:"linkedin-main",
  profileKey:"profile-secret",
  platform:"linkedin" as const,
  name:"Main LinkedIn",
  handle:"@main",
  evidenceRefs:["evidence:owner"],
}

describe("Ayrshare binding commissioning",()=>{
  it("requires an approval receipt bound to a hash of the exact credential",async()=>{
    const approvalStore=new InMemoryApprovalReceiptStore()
    const ledger=new InMemoryActionLedger()
    const writes:Array<{userId:string;binding:AyrshareProfileBinding}>=[]
    const vault:AyrshareBindingVault={
      async record(input){writes.push({userId:input.userId,binding:input.binding})},
      async list(){return[]},
      async get(){return undefined},
    }
    const providerFactory=(binding:AyrshareProfileBinding)=>new AyrshareProvider({
      apiKey:"api",
      bindings:[binding],
      fetcher:async()=>new Response(JSON.stringify({
        linkedin:{analytics:{followersCount:100}},
      }),{status:200,headers:{"content-type":"application/json"}}),
    })

    const requested=await requestAyrshareBindingApproval(bindingInput,{
      identityVerifier,approvalStore,ledger,vault,providerFactory,
      now:()=>new Date("2026-10-04T00:30:00.000Z"),
    })
    expect(requested.credentialStored).toBe(false)
    expect(JSON.stringify(requested)).not.toContain("profile-secret")

    const applied=await approveAndRecordAyrshareBinding({
      ...bindingInput,
      actionId:requested.actionId,
      approvalReceiptId:requested.approvalReceiptId,
    },{
      identityVerifier,approvalStore,ledger,vault,providerFactory,
      now:()=>new Date("2026-10-04T00:31:00.000Z"),
    })
    expect(applied).toMatchObject({
      credentialStored:true,
      approvalConsumed:true,
      provider:"ayrshare",
      providerProfileId:"linkedin-main",
      externalActionAuthorized:false,
      publishingAuthorized:false,
    })
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      userId:"user-1",
      binding:{id:"linkedin-main",profileKey:"profile-secret"},
    })
  })

  it("rejects credential mutation after approval if the profile key changes",async()=>{
    const approvalStore=new InMemoryApprovalReceiptStore()
    const ledger=new InMemoryActionLedger()
    const vault:AyrshareBindingVault={
      async record(){throw new Error("must not write")},
      async list(){return[]},
      async get(){return undefined},
    }
    const requested=await requestAyrshareBindingApproval(bindingInput,{
      identityVerifier,approvalStore,ledger,vault,
      now:()=>new Date(),
    })
    await expect(approveAndRecordAyrshareBinding({
      ...bindingInput,
      profileKey:"different-secret",
      actionId:requested.actionId,
      approvalReceiptId:requested.approvalReceiptId,
    },{
      identityVerifier,approvalStore,ledger,vault,
    })).rejects.toThrow("AYRSHARE_BINDING_APPROVAL_INVALID_OR_STALE")
  })

  it("fingerprints the secret without returning the raw key",()=>{
    const fingerprint=fingerprintAyrshareBinding(bindingInput)
    expect(fingerprint).toMatch(/^social-ayrshare-binding:v1:[a-f0-9]{64}$/)
    expect(fingerprint).not.toContain("profile-secret")
  })
})
