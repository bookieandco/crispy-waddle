import {createHash} from "node:crypto"
import {
  AyrshareProvider,
  assertSocialProviderPlatform,
  type AyrshareProfileBinding,
} from "@jhadina/social-core"
import type {ActionLedger,ApprovalReceiptStore} from "@jhadina/action-core"
import {createRequestIdentityVerifier} from "../auth/request-identity"
import type {JhadinaIdentityVerifier} from "../auth/supabase-identity-verifier"
import {
  createAyrshareBindingVault,
  type AyrshareBindingVault,
} from "./ayrshare-binding-vault"
import {createSupabaseSocialApprovalReceiptStore} from "./supabase-approval-receipt-store"
import {createSocialAuditLedger} from "./durable-audit-ledger"

export const AYRSHARE_BINDING_CAPABILITY="social.provider.credential.bind" as const

export interface AyrshareBindingApprovalInput{
  id:string
  profileKey:string
  platform:AyrshareProfileBinding["platform"]
  name:string
  handle?:string
  evidenceRefs:string[]
}

export interface AyrshareBindingRuntimeOverrides{
  identityVerifier?:JhadinaIdentityVerifier
  approvalStore?:ApprovalReceiptStore
  ledger?:ActionLedger
  vault?:AyrshareBindingVault
  providerFactory?:(binding:AyrshareProfileBinding)=>AyrshareProvider
  now?:()=>Date
}

export async function requestAyrshareBindingApproval(
  input:AyrshareBindingApprovalInput,
  overrides:AyrshareBindingRuntimeOverrides={},
){
  const deps=await runtime(overrides)
  const identity=await deps.identityVerifier.verify({})
  const binding=normalizeInput(input)
  const actionId=`social-ayrshare-binding:${crypto.randomUUID()}`
  const fingerprint=fingerprintBinding(binding)
  const receipt=await deps.approvalStore.createPending({
    actionId,
    userId:identity.userId,
    type:AYRSHARE_BINDING_CAPABILITY,
    fingerprint,
    expiresAt:new Date(deps.now().getTime()+5*60_000).toISOString(),
  })
  await deps.ledger.append({
    id:`${actionId}:approval-required`,
    actionId,
    userId:identity.userId,
    type:AYRSHARE_BINDING_CAPABILITY,
    status:"approval_required",
    timestamp:deps.now().toISOString(),
    metadata:{
      provider:"ayrshare",
      providerProfileId:binding.id,
      platform:binding.platform,
      fingerprint,
    },
  })
  return{
    actionId,
    approvalReceiptId:receipt.id,
    expiresAt:receipt.expiresAt,
    provider:"ayrshare" as const,
    providerProfileId:binding.id,
    platform:binding.platform,
    fingerprint,
    credentialStored:false as const,
    externalActionAuthorized:false as const,
      publishingAuthorized:false as const,
    }
  }catch(error){
    await deps.ledger.append({
      id:`${actionId}:failed:${crypto.randomUUID()}`,
      actionId,
      userId:identity.userId,
      type:AYRSHARE_BINDING_CAPABILITY,
      status:"failed",
      timestamp:deps.now().toISOString(),
      metadata:{
        provider:"ayrshare",
        providerProfileId:binding.id,
        platform:binding.platform,
        error:error instanceof Error?error.message:String(error),
      },
    })
    throw error
  }
}

export async function approveAndRecordAyrshareBinding(
  input:AyrshareBindingApprovalInput&{
    actionId:string
    approvalReceiptId:string
  },
  overrides:AyrshareBindingRuntimeOverrides={},
){
  const deps=await runtime(overrides)
  const identity=await deps.identityVerifier.verify({})
  const binding=normalizeInput(input)
  const fingerprint=fingerprintBinding(binding)

  const actionId=requireText(input.actionId,"actionId")
  await deps.ledger.append({
    id:`${actionId}:started`,
    actionId,
    userId:identity.userId,
    type:AYRSHARE_BINDING_CAPABILITY,
    status:"started",
    timestamp:deps.now().toISOString(),
    metadata:{provider:"ayrshare",providerProfileId:binding.id,platform:binding.platform},
  })
  try{
    await deps.approvalStore.approve(input.approvalReceiptId,identity.userId)
    const consumed=await deps.approvalStore.consume(input.approvalReceiptId,{
      actionId,
      userId:identity.userId,
      type:AYRSHARE_BINDING_CAPABILITY,
      fingerprint,
    })
    if(!consumed)throw new Error("AYRSHARE_BINDING_APPROVAL_INVALID_OR_STALE")

    const provider=deps.providerFactory(binding)
    const verification=await provider.getAccountAnalytics({
      providerProfileId:binding.id,
      platform:binding.platform,
    })

    await deps.vault.record({
      userId:identity.userId,
      binding,
      evidenceRefs:[
        ...input.evidenceRefs,
        `provider:ayrshare:account-analytics:${binding.platform}`,
        `analyticsMetricKeys:${verification.rawMetricKeys.join(",")}`,
      ],
      observedAt:verification.observedAt,
    })

    await deps.ledger.append({
      id:`${actionId}:completed`,
      actionId,
      userId:identity.userId,
      type:AYRSHARE_BINDING_CAPABILITY,
      status:"completed",
      timestamp:deps.now().toISOString(),
      metadata:{provider:"ayrshare",providerProfileId:binding.id,platform:binding.platform},
    })

    return{
    provider:"ayrshare" as const,
    providerProfileId:binding.id,
    platform:binding.platform,
    verification:{
      observedAt:verification.observedAt,
      metricKeys:verification.rawMetricKeys,
    },
    credentialStored:true as const,
    approvalConsumed:true as const,
    externalActionAuthorized:false as const,
    publishingAuthorized:false as const,
  }
}

export function fingerprintAyrshareBinding(input:AyrshareBindingApprovalInput):string{
  return fingerprintBinding(normalizeInput(input))
}

async function runtime(overrides:AyrshareBindingRuntimeOverrides){
  return{
    identityVerifier:overrides.identityVerifier??await createRequestIdentityVerifier(),
    approvalStore:overrides.approvalStore??createSupabaseSocialApprovalReceiptStore(),
    ledger:overrides.ledger??await createSocialAuditLedger(),
    vault:overrides.vault??createAyrshareBindingVault(),
    providerFactory:overrides.providerFactory??((binding)=>new AyrshareProvider({bindings:[binding]})),
    now:overrides.now??(()=>new Date()),
  }
}

function normalizeInput(input:AyrshareBindingApprovalInput):AyrshareProfileBinding&AyrshareBindingApprovalInput{
  const evidenceRefs=[...new Set(input.evidenceRefs.map(value=>value.trim()).filter(Boolean))]
  if(!evidenceRefs.length)throw new Error("AYRSHARE_BINDING_EVIDENCE_REQUIRED")
  assertSocialProviderPlatform("ayrshare",input.platform)
  return{
    id:requireText(input.id,"binding.id"),
    profileKey:requireText(input.profileKey,"binding.profileKey"),
    platform:input.platform,
    name:requireText(input.name,"binding.name"),
    handle:input.handle?.trim()||undefined,
    evidenceRefs,
  }
}

function fingerprintBinding(input:AyrshareProfileBinding&AyrshareBindingApprovalInput):string{
  const keyHash=createHash("sha256").update(input.profileKey,"utf8").digest("hex")
  const payload=JSON.stringify({
    provider:"ayrshare",
    id:input.id,
    platform:input.platform,
    name:input.name,
    handle:input.handle??null,
    keyHash,
    evidenceRefs:[...input.evidenceRefs].sort(),
  })
  return `social-ayrshare-binding:v1:${createHash("sha256").update(payload).digest("hex")}`
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
