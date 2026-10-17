import {describe,it,expect} from "vitest"
import {createHmac} from "node:crypto"
import {verifyMakeSignature,normalizeMakeEnvelope,MAKE_DISALLOWED_AUTOMATIC_ACTIONS} from "./make-bridge"
import {connectionCopy,normalizeFeedCandidate} from "./connected-source-contract"
const now=1792270200000
const timestamp=String(now)
const secret="long-make-bridge-secret-that-is-unique"
const raw=JSON.stringify({ownerId:"00000000-0000-0000-0000-000000000001",deliveryId:"delivery_001",workflowId:"workflow_001",kind:"feed_candidate",candidate:{
 provider:"facebook_page",sourceAccount:"page_123",externalId:"post_456",
 title:"An observed post",summary:"Source-owned copy",occurredAt:"2026-10-17T18:00:00Z",
 url:"https://facebook.com/page_123/posts/post_456",
}})
const sig=(payload:string,stamp:string)=>"sha256="+createHmac("sha256",secret).update(stamp+"."+payload).digest("hex")

describe("Make automation is a candidate transport, not social account authority",()=>{
 it("validates timestamp-bound HMAC but rejects edits/replays outside freshness window",()=>{
  expect(verifyMakeSignature({rawBody:raw,timestamp,signature:sig(raw,timestamp),secret,nowMs:now})).toBe(true)
  expect(verifyMakeSignature({rawBody:raw+" ",timestamp,signature:sig(raw,timestamp),secret,nowMs:now})).toBe(false)
  expect(verifyMakeSignature({rawBody:raw,timestamp,signature:sig(raw,timestamp),secret,nowMs:now+600000})).toBe(false)
  expect(verifyMakeSignature({rawBody:raw,timestamp,signature:sig(raw,timestamp),secret:"short",nowMs:now})).toBe(false)
 })
 it("binds the owner to a single configured identity and quarantines delivery",()=>{
  const parsed=normalizeMakeEnvelope(JSON.parse(raw),"00000000-0000-0000-0000-000000000001")
  expect(parsed.candidate.sourceTrust).toBe("workflow_unverified")
  expect(parsed.candidate.bridge).toBe("make")
  expect(()=>normalizeMakeEnvelope(JSON.parse(raw),"another-owner")).toThrow("MAKE_OWNER_MISMATCH")
  expect(parsed.kind).toBe("feed_candidate")
 })
 it("rejects phishing-style localhost URLs, unsupported providers and future evidence",()=>{
  const sample=JSON.parse(raw).candidate
  expect(()=>normalizeFeedCandidate({...sample,url:"http://localhost/admin"},"make")).toThrow("FEED_URL_INVALID")
  expect(()=>normalizeFeedCandidate({...sample,provider:"unknown"},"make")).toThrow("FEED_PROVIDER_UNSUPPORTED")
  expect(()=>normalizeFeedCandidate({...sample,occurredAt:"2090-01-01T00:00:00Z"},"make")).toThrow("FEED_TIME_INVALID")
 })
 it("keeps spending, publishing and memory mutation outside bridge privileges",()=>{
  expect(MAKE_DISALLOWED_AUTOMATIC_ACTIONS).toContain("admit_memory")
  expect(MAKE_DISALLOWED_AUTOMATIC_ACTIONS).toContain("publication_approval")
  expect(MAKE_DISALLOWED_AUTOMATIC_ACTIONS).toContain("ad_spend")
  expect(connectionCopy({provider:"facebook_page",identityLabel:"Page",bridge:"make",state:"registered",grantedScopes:[],capability:"none"})).toContain("not yet verified")
 })
})
