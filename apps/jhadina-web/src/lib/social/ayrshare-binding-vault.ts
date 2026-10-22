import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import type {
  AyrshareProfileBinding,
  SocialPlatform,
} from "@jhadina/social-core"
import { createServiceRoleClient } from "../supabase/service-role"

type BindingRow={
  provider_profile_id:string
  encrypted_profile_key:string
  platform:SocialPlatform
  display_name:string
  handle:string|null
  observed_at:string
}

export interface AyrshareBindingRecordInput{
  userId:string
  binding:AyrshareProfileBinding
  evidenceRefs:string[]
  observedAt?:string
}

export interface AyrshareBindingVault{
  record(input:AyrshareBindingRecordInput):Promise<void>
  list(userId:string):Promise<AyrshareProfileBinding[]>
  get(userId:string,providerProfileId:string):Promise<AyrshareProfileBinding|undefined>
}

export function encryptAyrshareProfileKey(value:string):string{
  const key=credentialKey()
  const iv=randomBytes(12)
  const cipher=createCipheriv("aes-256-gcm",key,iv)
  const encrypted=Buffer.concat([cipher.update(requireText(value,"profileKey"),"utf8"),cipher.final()])
  const tag=cipher.getAuthTag()
  return [iv,tag,encrypted].map(part=>part.toString("base64")).join(".")
}

export function decryptAyrshareProfileKey(value:string):string{
  const [iv,tag,data]=value.split(".")
  if(!iv||!tag||!data)throw new Error("AYRSHARE_PROFILE_KEY_CIPHERTEXT_INVALID")
  const decipher=createDecipheriv(
    "aes-256-gcm",
    credentialKey(),
    Buffer.from(iv,"base64"),
  )
  decipher.setAuthTag(Buffer.from(tag,"base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(data,"base64")),
    decipher.final(),
  ]).toString("utf8")
}

export function createAyrshareBindingVault():AyrshareBindingVault{
  return{
    async record(input){
      const client=createServiceRoleClient()
      if(!client)throw new Error("AYRSHARE_BINDING_VAULT_NOT_CONFIGURED")
      const userId=requireText(input.userId,"userId")
      const binding=normalizeBinding(input.binding)
      const evidenceRefs=uniqueEvidence(input.evidenceRefs)
      const observedAt=normalizeTimestamp(input.observedAt??new Date().toISOString())
      const{error}=await client
        .from("jhadina_social_ayrshare_bindings")
        .upsert({
          user_id:userId,
          provider_profile_id:binding.id,
          encrypted_profile_key:encryptAyrshareProfileKey(binding.profileKey),
          platform:binding.platform,
          display_name:binding.name,
          handle:binding.handle??null,
          evidence_refs:evidenceRefs,
          observed_at:observedAt,
          updated_at:new Date().toISOString(),
        },{
          onConflict:"user_id,provider_profile_id",
        })
      if(error)throw new Error(`AYRSHARE_BINDING_STORE_FAILED:${error.message}`)
    },

    async list(userId){
      const client=createServiceRoleClient()
      if(!client)throw new Error("AYRSHARE_BINDING_VAULT_NOT_CONFIGURED")
      const owner=requireText(userId,"userId")
      const{data,error}=await client
        .from("jhadina_social_ayrshare_bindings")
        .select("provider_profile_id,encrypted_profile_key,platform,display_name,handle,observed_at")
        .eq("user_id",owner)
        .order("observed_at",{ascending:true})
        .returns<BindingRow[]>()
      if(error)throw new Error(`AYRSHARE_BINDING_READ_FAILED:${error.message}`)
      return(data??[]).map(bindingFromRow)
    },

    async get(userId,providerProfileId){
      const client=createServiceRoleClient()
      if(!client)throw new Error("AYRSHARE_BINDING_VAULT_NOT_CONFIGURED")
      const owner=requireText(userId,"userId")
      const id=requireText(providerProfileId,"providerProfileId")
      const{data,error}=await client
        .from("jhadina_social_ayrshare_bindings")
        .select("provider_profile_id,encrypted_profile_key,platform,display_name,handle,observed_at")
        .eq("user_id",owner)
        .eq("provider_profile_id",id)
        .maybeSingle<BindingRow>()
      if(error)throw new Error(`AYRSHARE_BINDING_READ_FAILED:${error.message}`)
      return data?bindingFromRow(data):undefined
    },
  }
}

function bindingFromRow(row:BindingRow):AyrshareProfileBinding{
  return normalizeBinding({
    id:row.provider_profile_id,
    profileKey:decryptAyrshareProfileKey(row.encrypted_profile_key),
    platform:row.platform,
    name:row.display_name,
    handle:row.handle??undefined,
  })
}

function normalizeBinding(binding:AyrshareProfileBinding):AyrshareProfileBinding{
  const id=requireText(binding.id,"binding.id")
  const profileKey=requireText(binding.profileKey,"binding.profileKey")
  const name=requireText(binding.name,"binding.name")
  const platform=binding.platform
  if(![
    "facebook","instagram","tiktok","youtube","x","linkedin","threads",
    "bluesky","reddit","snapchat","tumblr","vk",
  ].includes(platform)){
    throw new Error("AYRSHARE_BINDING_PLATFORM_INVALID")
  }
  return{
    id,
    profileKey,
    platform,
    name,
    handle:binding.handle?.trim()||undefined,
  }
}

function credentialKey():Buffer{
  const raw=process.env.JHADINA_SOCIAL_CREDENTIAL_KEY?.trim()
  if(!raw)throw new Error("JHADINA_SOCIAL_CREDENTIAL_KEY_NOT_CONFIGURED")
  const value=Buffer.from(raw,"base64")
  if(value.length!==32)throw new Error("JHADINA_SOCIAL_CREDENTIAL_KEY_INVALID")
  return value
}

function uniqueEvidence(values:readonly string[]):string[]{
  const refs=[...new Set(values.map(value=>value.trim()).filter(Boolean))]
  if(!refs.length)throw new Error("AYRSHARE_BINDING_EVIDENCE_REQUIRED")
  return refs
}

function normalizeTimestamp(value:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed))throw new Error("AYRSHARE_BINDING_TIMESTAMP_INVALID")
  return new Date(parsed).toISOString()
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
