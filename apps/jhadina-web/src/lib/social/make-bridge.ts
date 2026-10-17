import {createHmac,timingSafeEqual} from "node:crypto"
import {normalizeFeedCandidate,type ExternalFeedCandidate} from "./connected-source-contract"

/**
 * Optional Make.com inbound automation bridge.
 * A valid signature authenticates the configured workflow ONLY. It never proves
 * a Facebook/Instagram post is real or that the workflow can publish.
 */
export type MakeInboundEnvelope = {
  kind:"feed_candidate"
  deliveryId:string
  workflowId:string
  ownerId:string
  candidate:ExternalFeedCandidate
}
const idPattern=/^[a-zA-Z0-9:_-]{8,128}$/
const signaturePattern=/^sha256=([a-f0-9]{64})$/

export function verifyMakeSignature(input:{
  rawBody:string
  timestamp:string|null
  signature:string|null
  secret:string|undefined
  nowMs?:number
}):boolean {
  if(!input.secret || input.secret.length<32 ||
    !input.timestamp || !/^[0-9]{10,13}$/.test(input.timestamp) ||
    !input.signature)return false
  const matched=input.signature.match(signaturePattern)
  if(!matched)return false
  const stamp=Number(input.timestamp)
  const ms=input.timestamp.length===10?stamp*1000:stamp
  if(!Number.isSafeInteger(ms) || Math.abs((input.nowMs??Date.now())-ms)>5*60*1000)return false
  const expected=createHmac("sha256",input.secret).update(input.timestamp+"."+input.rawBody).digest()
  return timingSafeEqual(Buffer.from(matched[1],"hex"),expected)
}

export function normalizeMakeEnvelope(raw:unknown,expectedOwnerId:string):MakeInboundEnvelope {
  if(!raw || typeof raw!=="object" || Array.isArray(raw))throw Error("MAKE_EVENT_INVALID")
  const value=raw as Record<string,unknown>
  if(value.kind!=="feed_candidate")throw Error("MAKE_EVENT_KIND_UNSUPPORTED")
  if(typeof value.ownerId!=="string" || value.ownerId!==expectedOwnerId)throw Error("MAKE_OWNER_MISMATCH")
  if(typeof value.deliveryId!=="string" || !idPattern.test(value.deliveryId))throw Error("MAKE_DELIVERY_ID_INVALID")
  if(typeof value.workflowId!=="string" || !idPattern.test(value.workflowId))throw Error("MAKE_WORKFLOW_ID_INVALID")
  return {
    kind:"feed_candidate",ownerId:expectedOwnerId,
    deliveryId:value.deliveryId,workflowId:value.workflowId,
    candidate:normalizeFeedCandidate(value.candidate,"make"),
  }
}

/** Only explicit low-privilege workflows should be connected to Make. */
export const MAKE_ALLOWED_WORKFLOWS=Object.freeze([
  "read_only_feed_candidate",
  "social_analytics_receipt",
  "approved_workflow_delivery_receipt",
] as const)
export const MAKE_DISALLOWED_AUTOMATIC_ACTIONS=Object.freeze([
  "publication_approval","send_private_message","ad_spend",
  "place_trade","move_money","train_personality","admit_memory",
] as const)
